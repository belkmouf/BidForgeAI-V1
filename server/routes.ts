import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertProjectSchema, insertDocumentSchema } from "@shared/schema";
import { generateBidContent, refineBidContent } from "./lib/openai";
import { generateBidWithAnthropic, refineBidWithAnthropic } from "./lib/anthropic";
import { generateBidWithGemini, refineBidWithGemini } from "./lib/gemini";
import { generateBidWithDeepSeek, refineBidWithDeepSeek } from "./lib/deepseek";
import { ingestionService } from "./lib/ingestion";
import { 
  analyzeRFP, 
  saveAnalysis, 
  getAnalysisForProject, 
  resolveAlert, 
  getAllVendors, 
  upsertVendor,
  seedVendorDatabase,
  generateMissingDocumentsMessage
} from "./lib/analysis";
import { 
  initWhatsApp, 
  sendTextMessage, 
  sendDocument,
  sendTemplateMessage,
  parseWebhookPayload, 
  getWebhookVerifyToken,
  isWhatsAppConfigured,
  verifyWebhookSignature,
  type WhatsAppWebhookPayload 
} from "./lib/whatsapp";
import authRoutes from "./routes/auth";
import agentRoutes from "./routes/agents";
import { conflictRouter } from "./routes/conflicts";
import winProbabilityRoutes from "./routes/win-probability";
import teamRoutes from "./routes/team";
import auditRoutes from "./routes/audit";
import analyticsRoutes from "./routes/analytics";
import reportsRoutes from "./routes/reports";
import adminRoutes from "./routes/admin";
import { authenticateToken, optionalAuth, AuthRequest } from "./middleware/auth";
import { requirePermission, requireRole, PERMISSIONS } from "./middleware/rbac";
import { 
  sanitizeInstructions, 
  sanitizeTone, 
  sanitizeFeedback,
  InputSanitizationError 
} from './lib/sanitize';
import { generateBidTemplate, wrapContentInTemplate, getCompanyConfig, type BidData, type TemplateOptions } from './lib/templates/bid-template-generator';
import multer from "multer";
import { z } from "zod";

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
  },
});

// Request schemas
const modelEnum = z.enum(['anthropic', 'gemini', 'deepseek', 'openai']);

const generateBidSchema = z.object({
  instructions: z.string().min(1),
  tone: z.string().optional().default('professional'),
  model: modelEnum.optional().default('anthropic'),
  models: z.array(modelEnum).optional(),
});

const refineBidSchema = z.object({
  currentHtml: z.string().min(1),
  feedback: z.string().min(1),
  model: z.enum(['anthropic', 'gemini', 'deepseek', 'openai']).optional().default('anthropic'),
});

const updateStatusSchema = z.object({
  status: z.enum(["Active", "Submitted", "Closed-Won", "Closed-Lost"]),
});

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // ==================== AUTHENTICATION ====================
  app.use('/api/auth', authRoutes);
  
  // ==================== AI AGENTS ====================
  app.use('/api/agents', agentRoutes);
  
  // ==================== CONFLICT DETECTION ====================
  app.use('/api/conflicts', conflictRouter);
  
  // ==================== WIN PROBABILITY ====================
  app.use('/api/win-probability', winProbabilityRoutes);
  
  // ==================== TEAM COLLABORATION ====================
  app.use('/api/team', teamRoutes);
  
  // ==================== AUDIT LOGS ====================
  app.use('/api/audit', auditRoutes);
  
  // ==================== ANALYTICS ====================
  app.use('/api/analytics', analyticsRoutes);
  
  // ==================== REPORTS ====================
  app.use('/api/reports', reportsRoutes);
  
  // ==================== ADMIN ====================
  app.use('/api/admin', adminRoutes);
  
  // ==================== PROJECTS ====================
  
  // Create a new project (requires authentication, company-scoped)
  app.post("/api/projects", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const data = insertProjectSchema.parse(req.body);
      const companyId = req.user?.companyId ?? null;
      const project = await storage.createProject(data, companyId);
      res.json(project);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // List all projects (requires authentication, company-scoped)
  app.get("/api/projects", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const companyId = req.user?.companyId ?? null;
      const projects = await storage.listProjects(companyId);
      res.json(projects);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get a specific project (requires authentication, company-scoped)
  app.get("/api/projects/:id", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const companyId = req.user?.companyId ?? null;
      const project = await storage.getProject(req.params.id, companyId);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      res.json(project);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Update project status (requires authentication, company-scoped)
  app.patch("/api/projects/:id/status", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { status } = updateStatusSchema.parse(req.body);
      const companyId = req.user?.companyId ?? null;
      const project = await storage.updateProjectStatus(req.params.id, status, companyId);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      res.json(project);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // ==================== DOCUMENTS ====================

  // Upload a document to a project with recursive file processing (requires authentication, company-scoped)
  app.post("/api/projects/:id/upload", authenticateToken, upload.single('file'), async (req: AuthRequest, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const projectId = req.params.id;
      const companyId = req.user?.companyId ?? null;
      
      // Verify project exists and belongs to this company
      const project = await storage.getProject(projectId, companyId);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }

      // Sanitize filename to prevent path traversal
      const originalName = req.file.originalname;
      const safeFilename = originalName.replace(/[^\w\s.-]/g, '_').replace(/\.{2,}/g, '.').trim();
      if (!safeFilename || safeFilename.length === 0) {
        return res.status(400).json({ error: 'Invalid filename' });
      }

      // Validate file size
      const maxSize = 50 * 1024 * 1024; // 50MB
      if (req.file.size > maxSize) {
        return res.status(400).json({ 
          error: `File too large. Maximum size is ${maxSize / 1024 / 1024}MB` 
        });
      }
      if (req.file.size === 0) {
        return res.status(400).json({ error: 'Empty file not allowed' });
      }

      // Validate file type
      const allowedExtensions = ['.pdf', '.msg', '.zip', '.txt', '.doc', '.docx'];
      const fileExt = safeFilename.toLowerCase().match(/\.[^.]*$/)?.[0] || '';
      
      if (!allowedExtensions.includes(fileExt)) {
        return res.status(400).json({ 
          error: `Unsupported file type. Allowed: ${allowedExtensions.join(', ')}` 
        });
      }

      // Process file with recursive extraction (ZIP→MSG→PDF chains)
      const processedFiles = await ingestionService.processFile(
        req.file.buffer,
        safeFilename,
        projectId
      );

      const totalChunks = processedFiles.reduce((sum, f) => sum + f.chunksCreated, 0);

      res.json({
        message: "File uploaded and processed successfully",
        filesProcessed: processedFiles.length,
        totalChunks,
        documents: processedFiles,
      });
    } catch (error: any) {
      console.error('Upload error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // List documents for a project (requires authentication)
  app.get("/api/projects/:id/documents", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const documents = await storage.listDocumentsByProject(req.params.id);
      res.json(documents);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Delete a document (requires authentication, company-scoped)
  app.delete("/api/documents/:documentId", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const documentId = parseInt(req.params.documentId, 10);
      if (isNaN(documentId)) {
        return res.status(400).json({ error: "Invalid document ID" });
      }

      const companyId = req.user?.companyId ?? null;
      
      // Verify document exists and belongs to this company's project
      const document = await storage.getDocument(documentId, companyId);
      if (!document) {
        return res.status(404).json({ error: "Document not found" });
      }

      // Delete the document and its chunks
      const deleted = await storage.deleteDocument(documentId, companyId);
      
      if (deleted) {
        res.json({ message: "Document deleted successfully" });
      } else {
        res.status(500).json({ error: "Failed to delete document" });
      }
    } catch (error: any) {
      console.error('Delete document error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ==================== BID GENERATION ====================

  // Helper function to generate bid with a specific model
  async function generateBidWithModel(
    modelName: string,
    params: { instructions: string; context: string; tone: string }
  ): Promise<string> {
    switch (modelName) {
      case 'anthropic':
        return generateBidWithAnthropic(params);
      case 'gemini':
        return generateBidWithGemini(params);
      case 'deepseek':
        return generateBidWithDeepSeek(params);
      case 'openai':
      default:
        return generateBidContent(params);
    }
  }

  // Generate a bid using RAG (requires authentication + AI input sanitization, company-scoped)
  // Supports multi-model comparison when 'models' array is provided
  app.post("/api/projects/:id/generate", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { instructions, tone, model, models } = generateBidSchema.parse(req.body);
      const projectId = req.params.id;
      const companyId = req.user?.companyId ?? null;

      // Verify project exists and belongs to this company
      const project = await storage.getProject(projectId, companyId);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }

      // Sanitize AI inputs to prevent prompt injection
      let sanitizedInstructions: string;
      let sanitizedTone: string;
      
      try {
        sanitizedInstructions = sanitizeInstructions(instructions);
        sanitizedTone = sanitizeTone(tone || 'professional');
      } catch (error) {
        if (error instanceof InputSanitizationError) {
          return res.status(400).json({ 
            error: 'Invalid input detected',
            reason: error.reason,
            message: error.message
          });
        }
        throw error;
      }

      // Get all documents from this project to build context
      console.log('Loading project documents for context...');
      const documents = await storage.getProjectDocuments(projectId);
      
      // Build context from document content (simplified - no embedding search)
      const context = documents
        .filter(doc => doc.content && !doc.content.startsWith('[PDF content could not be extracted'))
        .map((doc, i) => `[Document ${i + 1}: ${doc.filename}]\n${doc.content?.substring(0, 5000) || ''}`)
        .join('\n\n---\n\n');

      const contextOrDefault = context || 'No document content available. Please provide project details in your instructions.';
      
      console.log(`Using ${documents.length} documents for bid generation context`);

      const generationParams = {
        instructions: sanitizedInstructions,
        context: contextOrDefault,
        tone: sanitizedTone,
      };

      // Check if multi-model comparison is requested
      if (models && models.length > 1) {
        console.log(`Multi-model comparison requested for: ${models.join(', ')}`);
        
        // Generate bids in parallel for all requested models
        const results = await Promise.all(
          models.map(async (modelName) => {
            try {
              const html = await generateBidWithModel(modelName, generationParams);
              return { model: modelName, html, success: true };
            } catch (error: any) {
              return { model: modelName, html: '', success: false, error: error.message };
            }
          })
        );

        res.json({
          comparison: true,
          results,
          documentsUsed: documents.length,
          searchMethod: 'document_content',
        });
      } else {
        // Single model generation (original behavior)
        const selectedModel = models?.[0] || model;
        const html = await generateBidWithModel(selectedModel, generationParams);

        res.json({
          html,
          documentsUsed: documents.length,
          model: selectedModel,
          searchMethod: 'document_content',
        });
      }
    } catch (error: any) {
      console.error('Generation error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Refine an existing bid (requires authentication + AI input sanitization)
  app.post("/api/projects/:id/refine", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { currentHtml, feedback, model } = refineBidSchema.parse(req.body);

      // Sanitize feedback to prevent prompt injection
      let sanitizedFeedback: string;
      try {
        sanitizedFeedback = sanitizeFeedback(feedback);
      } catch (error) {
        if (error instanceof InputSanitizationError) {
          return res.status(400).json({ 
            error: 'Invalid feedback detected',
            reason: error.reason,
            message: error.message
          });
        }
        throw error;
      }

      // Refine using selected model with sanitized feedback
      let html: string;
      switch (model) {
        case 'anthropic':
          html = await refineBidWithAnthropic({ currentHtml, feedback: sanitizedFeedback });
          break;
        case 'gemini':
          html = await refineBidWithGemini({ currentHtml, feedback: sanitizedFeedback });
          break;
        case 'deepseek':
          html = await refineBidWithDeepSeek({ currentHtml, feedback: sanitizedFeedback });
          break;
        case 'openai':
        default:
          html = await refineBidContent({ currentHtml, feedback: sanitizedFeedback });
          break;
      }

      res.json({ html, model });
    } catch (error: any) {
      console.error('Refinement error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ==================== BID TEMPLATES ====================

  const bidTemplateSchema = z.object({
    projectName: z.string(),
    clientName: z.string(),
    projectDescription: z.string().optional(),
    scope: z.string().optional(),
    timeline: z.string().optional(),
    pricing: z.object({
      items: z.array(z.object({
        description: z.string(),
        amount: z.number(),
      })),
      subtotal: z.number(),
      contingency: z.number().optional(),
      total: z.number(),
    }).optional(),
    options: z.object({
      includeValuePropositions: z.boolean().optional(),
      includeTerms: z.boolean().optional(),
      includeCertifications: z.boolean().optional(),
      includeInsurance: z.boolean().optional(),
    }).optional(),
  });

  app.post("/api/templates/generate", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const data = bidTemplateSchema.parse(req.body);
      const companyId = req.user?.companyId ?? null;
      
      // Load company-specific config
      const companyConfigData = await getCompanyConfig(companyId);
      
      const bidData: BidData = {
        projectName: data.projectName,
        clientName: data.clientName,
        projectDescription: data.projectDescription,
        scope: data.scope,
        timeline: data.timeline,
        pricing: data.pricing,
      };
      
      const html = generateBidTemplate(bidData, data.options || {}, companyConfigData);
      
      res.json({ html });
    } catch (error: any) {
      console.error('Template generation error:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid template data', details: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/templates/wrap", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { content, projectName, clientName, options } = req.body;
      const companyId = req.user?.companyId ?? null;
      
      if (!content || !projectName || !clientName) {
        return res.status(400).json({ error: 'Content, projectName, and clientName are required' });
      }
      
      // Load company-specific config
      const companyConfigData = await getCompanyConfig(companyId);
      
      const html = wrapContentInTemplate(content, projectName, clientName, options || {}, companyConfigData);
      
      res.json({ html });
    } catch (error: any) {
      console.error('Template wrap error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ==================== DASHBOARD ====================

  // Get dashboard statistics (requires authentication, company-scoped)
  app.get("/api/dashboard/stats", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const companyId = req.user?.companyId ?? null;
      const stats = await storage.getDashboardStats(companyId);
      res.json(stats);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ==================== RFP ANALYSIS ====================

  // Seed vendor database on startup
  seedVendorDatabase().catch(console.error);

  // Run RFP analysis on a project (requires authentication, company-scoped)
  app.post("/api/projects/:id/analyze", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const projectId = req.params.id;
      const companyId = req.user?.companyId ?? null;
      
      const project = await storage.getProject(projectId, companyId);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }

      const documents = await storage.listDocumentsByProject(projectId);
      if (documents.length === 0) {
        return res.status(400).json({ error: "No documents uploaded. Please upload RFP documents first." });
      }

      const analysisResult = await analyzeRFP(projectId);
      const savedAnalysis = await saveAnalysis(projectId, analysisResult);

      res.json({
        success: true,
        analysis: {
          id: savedAnalysis.id,
          qualityScore: savedAnalysis.qualityScore,
          clarityScore: savedAnalysis.clarityScore,
          doabilityScore: savedAnalysis.doabilityScore,
          vendorRiskScore: savedAnalysis.vendorRiskScore,
          overallRiskLevel: savedAnalysis.overallRiskLevel,
          missingDocuments: savedAnalysis.missingDocuments,
          unclearRequirements: savedAnalysis.unclearRequirements,
          redFlags: savedAnalysis.redFlags,
          opportunities: savedAnalysis.opportunities,
          recommendations: savedAnalysis.recommendations,
          vendorName: savedAnalysis.vendorName,
          vendorPaymentRating: savedAnalysis.vendorPaymentRating,
          paymentHistory: savedAnalysis.paymentHistory,
          analyzedAt: savedAnalysis.analyzedAt,
        },
        alerts: analysisResult.alerts,
      });
    } catch (error: any) {
      console.error('Analysis error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get existing analysis for a project (requires authentication)
  app.get("/api/projects/:id/analysis", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { analysis, alerts } = await getAnalysisForProject(req.params.id);
      
      if (!analysis) {
        return res.status(404).json({ error: "No analysis found. Run analysis first." });
      }

      res.json({
        analysis: {
          id: analysis.id,
          qualityScore: analysis.qualityScore,
          clarityScore: analysis.clarityScore,
          doabilityScore: analysis.doabilityScore,
          vendorRiskScore: analysis.vendorRiskScore,
          overallRiskLevel: analysis.overallRiskLevel,
          missingDocuments: analysis.missingDocuments,
          unclearRequirements: analysis.unclearRequirements,
          redFlags: analysis.redFlags,
          opportunities: analysis.opportunities,
          recommendations: analysis.recommendations,
          vendorName: analysis.vendorName,
          vendorPaymentRating: analysis.vendorPaymentRating,
          paymentHistory: analysis.paymentHistory,
          analyzedAt: analysis.analyzedAt,
        },
        alerts: alerts.map(a => ({
          id: a.id,
          type: a.alertType,
          severity: a.severity,
          title: a.title,
          description: a.description,
          action: a.recommendedAction,
          isResolved: a.isResolved,
        })),
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Resolve an alert (requires authentication)
  app.post("/api/alerts/:id/resolve", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const alert = await resolveAlert(parseInt(req.params.id));
      res.json({ success: true, alert });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ==================== DECISION LOGS ====================

  // Get decision log for a project (Go/No-Go visualization)
  app.get("/api/projects/:id/decision-log", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const projectId = req.params.id;
      const companyId = req.user?.companyId ?? null;
      
      const project = await storage.getProject(projectId, companyId);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }

      const decisionLog = await storage.getDecisionLogByProject(projectId, companyId);
      if (!decisionLog) {
        return res.status(404).json({ error: "No decision log found. Run the analysis pipeline first." });
      }

      res.json({
        id: decisionLog.id,
        projectId: decisionLog.projectId,
        doabilityScore: decisionLog.doabilityScore,
        minDoabilityThreshold: decisionLog.minDoabilityThreshold,
        criticalRiskLevel: decisionLog.criticalRiskLevel,
        vendorRiskScore: decisionLog.vendorRiskScore,
        decision: decisionLog.decision,
        reason: decisionLog.reason,
        triggeredRule: decisionLog.triggeredRule,
        bidStrategy: decisionLog.bidStrategy,
        createdAt: decisionLog.createdAt,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get decision log history for a project
  app.get("/api/projects/:id/decision-log/history", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const projectId = req.params.id;
      const companyId = req.user?.companyId ?? null;
      
      const project = await storage.getProject(projectId, companyId);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }

      const history = await storage.getDecisionLogHistory(projectId, companyId);
      res.json(history);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ==================== VENDOR DATABASE ====================

  // Get all vendors (requires authentication)
  app.get("/api/vendors", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const vendors = await getAllVendors();
      res.json(vendors);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Add/update a vendor
  const vendorSchema = z.object({
    vendorName: z.string().min(1),
    averagePaymentDays: z.number().optional(),
    onTimePaymentRate: z.number().min(0).max(100).optional(),
    totalProjects: z.number().optional(),
    latePayments: z.number().optional(),
    disputedPayments: z.number().optional(),
    overallRating: z.string().optional(),
    paymentRating: z.string().optional(),
    communicationRating: z.string().optional(),
    industrySectors: z.array(z.string()).optional(),
    typicalProjectSize: z.string().optional(),
    geographicRegions: z.array(z.string()).optional(),
    notes: z.string().optional(),
  });

  // Add/update a vendor (requires authentication)
  app.post("/api/vendors", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const data = vendorSchema.parse(req.body);
      const vendor = await upsertVendor(data as any);
      res.json(vendor);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // ==================== WHATSAPP ====================

  // Initialize WhatsApp client on startup
  initWhatsApp();

  // Get WhatsApp configuration status
  app.get("/api/whatsapp/status", async (req, res) => {
    res.json({ 
      configured: isWhatsAppConfigured(),
      message: isWhatsAppConfigured() 
        ? 'WhatsApp is configured and ready' 
        : 'WhatsApp requires WA_PHONE_NUMBER_ID and CLOUD_API_ACCESS_TOKEN environment variables'
    });
  });

  // Webhook verification (GET) - Meta uses this to verify webhook
  app.get("/api/whatsapp/webhook", (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === getWebhookVerifyToken()) {
      console.log('WhatsApp webhook verified');
      res.status(200).send(challenge);
    } else {
      console.log('WhatsApp webhook verification failed');
      res.sendStatus(403);
    }
  });

  // Webhook handler (POST) - Receives messages from WhatsApp
  app.post("/api/whatsapp/webhook", (req, res) => {
    try {
      const signature = req.headers['x-hub-signature-256'] as string | undefined;
      const rawBody = JSON.stringify(req.body);
      
      if (!verifyWebhookSignature(rawBody, signature)) {
        console.error('WhatsApp webhook signature verification failed');
        return res.sendStatus(401);
      }

      const payload = req.body as WhatsAppWebhookPayload;
      const { messages, statuses } = parseWebhookPayload(payload);

      for (const message of messages) {
        console.log(`WhatsApp message from ${message.contactName || message.from}:`, 
          message.text?.body || `[${message.type}]`);
        
        if (message.type === 'text' && message.text?.body) {
          sendTextMessage(
            message.from, 
            `Thank you for your message. A team member will respond shortly.\n\n` +
            `BidForge AI - Intelligent Construction Bidding`
          ).catch(console.error);
        }
      }

      for (const status of statuses) {
        console.log(`WhatsApp message ${status.id}: ${status.status}`);
      }

      res.sendStatus(200);
    } catch (error) {
      console.error('WhatsApp webhook error:', error);
      res.sendStatus(200);
    }
  });

  // Send a text message
  const sendMessageSchema = z.object({
    to: z.string().min(10),
    message: z.string().min(1),
  });

  app.post("/api/whatsapp/send", authenticateToken, requirePermission(PERMISSIONS.WHATSAPP_SEND), async (req: AuthRequest, res) => {
    try {
      const { to, message } = sendMessageSchema.parse(req.body);
      const result = await sendTextMessage(to, message);
      
      if (result.success) {
        res.json({ success: true, messageId: result.messageId });
      } else {
        res.status(400).json({ success: false, error: result.error });
      }
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  });

  // Send a document
  const sendDocumentSchema = z.object({
    to: z.string().min(10),
    documentUrl: z.string().url(),
    filename: z.string().min(1),
    caption: z.string().optional(),
  });

  app.post("/api/whatsapp/send-document", authenticateToken, requirePermission(PERMISSIONS.WHATSAPP_SEND), async (req: AuthRequest, res) => {
    try {
      const { to, documentUrl, filename, caption } = sendDocumentSchema.parse(req.body);
      const result = await sendDocument(to, documentUrl, filename, caption);
      
      if (result.success) {
        res.json({ success: true, messageId: result.messageId });
      } else {
        res.status(400).json({ success: false, error: result.error });
      }
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  });

  // Send a template message
  const sendTemplateSchema = z.object({
    to: z.string().min(10),
    templateName: z.string().min(1),
    languageCode: z.string().optional().default('en_US'),
    components: z.array(z.any()).optional(),
  });

  app.post("/api/whatsapp/send-template", authenticateToken, requirePermission(PERMISSIONS.WHATSAPP_SEND), async (req: AuthRequest, res) => {
    try {
      const { to, templateName, languageCode, components } = sendTemplateSchema.parse(req.body);
      const result = await sendTemplateMessage(to, templateName, languageCode, components);
      
      if (result.success) {
        res.json({ success: true, messageId: result.messageId });
      } else {
        res.status(400).json({ success: false, error: result.error });
      }
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  });

  // ==================== MISSING DOCUMENTS REQUEST ====================
  
  // Generate AI message for missing documents request
  const generateMissingDocsMessageSchema = z.object({
    missingDocuments: z.array(z.string()).min(1),
    format: z.enum(['whatsapp', 'email']),
  });

  app.post("/api/projects/:id/generate-missing-docs-message", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { missingDocuments, format } = generateMissingDocsMessageSchema.parse(req.body);
      const companyId = req.user?.companyId ?? null;
      
      const project = await storage.getProject(req.params.id, companyId);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      
      const result = await generateMissingDocumentsMessage({
        projectName: project.name,
        clientName: project.clientName || 'Valued Client',
        missingDocuments,
        format,
      });
      
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });
  
  // Send missing documents request via WhatsApp
  const sendMissingDocsWhatsAppSchema = z.object({
    to: z.string().min(10),
    message: z.string().min(1),
  });

  app.post("/api/projects/:id/send-missing-docs-whatsapp", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { to, message } = sendMissingDocsWhatsAppSchema.parse(req.body);
      const companyId = req.user?.companyId ?? null;
      
      const project = await storage.getProject(req.params.id, companyId);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      
      // Send the user-provided message via WhatsApp
      const sendResult = await sendTextMessage(to, message);
      
      if (sendResult.success) {
        res.json({ 
          success: true, 
          messageId: sendResult.messageId,
          message: message 
        });
      } else {
        res.status(400).json({ success: false, error: sendResult.error });
      }
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  });

  return httpServer;
}
