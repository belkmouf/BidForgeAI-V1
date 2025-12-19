import type { Express, Response, NextFunction, RequestHandler } from "express";
import { createServer, type Server } from "http";
import * as crypto from "crypto";
import { storage } from "./storage";
import { insertProjectSchema, insertDocumentSchema, users, documents, documentSummaries } from "@shared/schema";
import { hashPassword, generateAccessToken } from "./lib/auth";
import { db } from "./db";
import { eq, sql, and, isNull } from "drizzle-orm";
import { generateBidContent, refineBidContent, generateEmbedding } from "./lib/openai";
import { generateBidWithAnthropic, refineBidWithAnthropic } from "./lib/anthropic";
import { generateBidWithGemini, refineBidWithGemini } from "./lib/gemini";
import { generateBidWithDeepSeek, refineBidWithDeepSeek } from "./lib/deepseek";
import { generateBidWithGrok, refineBidWithGrok } from "./lib/grok";
import { ingestionService } from "./lib/ingestion";
import { documentSummarizationService } from "./lib/document-summarization";
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
import agentProgressRoutes from "./routes/agent-progress";
import { conflictRouter } from "./routes/conflicts";
import winProbabilityRoutes from "./routes/win-probability";
import teamRoutes from "./routes/team";
import auditRoutes from "./routes/audit";
import analyticsRoutes from "./routes/analytics";
import reportsRoutes from "./routes/reports";
import adminRoutes from "./routes/admin";
import v1Routes from "./routes/v1/index";
import documentSummaryRoutes from "./routes/document-summary";
import projectsRoutes from "./routes/projects";
import documentsRoutes from "./routes/documents";
import bidsRoutes from "./routes/bids";
import { fetchWebsiteInfo, batchFetchWebsiteInfo, getWebsiteInfoCache, saveWebsiteInfo, fetchAndSaveWebsiteInfo } from "./routes/website-info.js";
import { apiVersioning, API_VERSIONS, trackVersionUsage, VersionedRequest } from "./middleware/versioning";
import { authenticateToken, optionalAuth, AuthRequest } from "./middleware/auth";
import { requirePermission, requireRole, requireAdmin, PERMISSIONS } from "./middleware/rbac";
import { 
  sanitizeInstructions, 
  sanitizeTone, 
  sanitizeFeedback,
  InputSanitizationError 
} from './lib/sanitize';
import { calculateLMMCost } from './lib/pricing';
import { validateCompanyUserRole } from '@shared/schema';
import { generateBidTemplate, wrapContentInTemplate, getCompanyConfig, getUserBrandingConfig, type BidData, type TemplateOptions } from './lib/templates/bid-template-generator';
import { wrapContentInPremiumTemplate } from './lib/templates/gcc-premium-template';
import { sanitizeModelHtml } from './lib/ai-output';
import { pythonSketchClient } from './lib/pythonSketchClient';
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
const modelEnum = z.enum(['anthropic', 'gemini', 'deepseek', 'openai', 'grok']);

const generateBidSchema = z.object({
  instructions: z.string().min(1),
  tone: z.string().optional().default('professional'),
  model: modelEnum.optional().default('anthropic'),
  models: z.array(modelEnum).optional(),
});

// Process knowledge base document asynchronously
async function processKnowledgeBaseDocument(
  docId: number,
  companyId: number,
  filepath: string,
  fileType: string
): Promise<void> {
  try {
    const fs = await import('fs/promises');
    const path = await import('path');
    const fullPath = path.join(process.cwd(), filepath);
    const buffer = await fs.readFile(fullPath);
    
    let textContent = '';
    
    // Extract text based on file type
    if (fileType === 'txt') {
      textContent = buffer.toString('utf-8');
    } else if (fileType === 'pdf') {
      try {
        const pdfModule = await import('pdf-parse');
        const pdfParse = (pdfModule as any).default || (pdfModule as any);
        const { text } = await pdfParse(buffer);
        textContent = text || '';
      } catch (pdfError: any) {
        console.error('PDF parsing error:', pdfError);
        textContent = `[PDF content could not be extracted: ${pdfError.message}]`;
      }
    } else if (fileType === 'docx') {
      const mammoth = await import('mammoth');
      const result = await mammoth.extractRawText({ buffer });
      textContent = result.value;
    } else if (fileType === 'xlsx' || fileType === 'csv') {
      // For Excel/CSV files, use xlsx library for proper parsing
      const XLSXModule = await import('xlsx');
      const XLSX = XLSXModule.default || XLSXModule;
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const allText: string[] = [];
      
      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        const csvData = XLSX.utils.sheet_to_csv(sheet);
        allText.push(`Sheet: ${sheetName}\n${csvData}`);
      }
      textContent = allText.join('\n\n');
    }
    
    if (!textContent.trim()) {
      console.warn(`No text content extracted from document ${docId}`);
      // Mark document as processed with 0 chunks and error message
      await storage.updateKnowledgeBaseDocument(docId, companyId, {
        isProcessed: true,
        chunkCount: 0,
        content: '[No text content could be extracted from this document]'
      });
      return;
    }

    // Update document with extracted content
    await storage.updateKnowledgeBaseDocument(docId, companyId, {
      content: textContent.substring(0, 500000) // Limit to 500K chars
    });

    // Chunk the text using similar logic to document ingestion
    const { RecursiveCharacterTextSplitter } = await import('@langchain/textsplitters');
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });
    
    const chunks = await splitter.splitText(textContent);
    
    // Create embeddings and store chunks
    let chunkCount = 0;
    for (let i = 0; i < chunks.length; i++) {
      try {
        const embedding = await generateEmbedding(chunks[i]);
        
        await storage.createKnowledgeBaseChunk({
          documentId: docId,
          companyId,
          content: chunks[i],
          embedding,
          chunkIndex: i
        });
        chunkCount++;
      } catch (embeddingError) {
        console.error(`Error creating embedding for chunk ${i}:`, embeddingError);
      }
    }

    // Mark document as processed
    await storage.updateKnowledgeBaseDocument(docId, companyId, {
      isProcessed: true,
      chunkCount
    });

    console.log(`Processed knowledge base document ${docId}: ${chunkCount} chunks created`);
  } catch (error) {
    console.error(`Error processing knowledge base document ${docId}:`, error);
    throw error;
  }
}

const refineBidSchema = z.object({
  currentHtml: z.string().min(1),
  feedback: z.string().min(1),
  model: z.enum(['anthropic', 'gemini', 'deepseek', 'openai', 'grok']).optional().default('anthropic'),
});

const updateStatusSchema = z.object({
  status: z.enum(["Active", "Submitted", "Closed-Won", "Closed-Lost"]),
});

// Checklist item interface for AI generation
interface GeneratedChecklistItem {
  name: string;
  description: string;
  category: string;
  isRequired: boolean;
}

// GCC-specific document requirements by RFP type and region
const GCC_DOCUMENT_TEMPLATES: Record<string, GeneratedChecklistItem[]> = {
  government_uae: [
    { name: "RFP/ITB Document", description: "Complete Request for Proposal or Invitation to Bid document", category: "core_documents", isRequired: true },
    { name: "Commercial Registration (Trade License)", description: "Valid UAE trade license or commercial registration", category: "company_credentials", isRequired: true },
    { name: "TRN/VAT Registration Certificate", description: "Tax Registration Number certificate from UAE FTA", category: "company_credentials", isRequired: true },
    { name: "Company Profile", description: "Detailed company profile including capabilities and experience", category: "company_credentials", isRequired: true },
    { name: "Financial Statements (Audited)", description: "Latest audited financial statements (2-3 years)", category: "financials", isRequired: true },
    { name: "Bank Solvency Letter", description: "Bank letter confirming financial solvency", category: "financials", isRequired: true },
    { name: "Similar Project Experience", description: "Documentation of similar completed projects", category: "experience", isRequired: true },
    { name: "Technical Proposal", description: "Detailed technical approach and methodology", category: "proposals", isRequired: true },
    { name: "Commercial/Pricing Proposal", description: "Itemized pricing and commercial terms", category: "proposals", isRequired: true },
    { name: "Bid Bond/Security", description: "Bank guarantee or bid bond as per RFP requirements", category: "legal", isRequired: false },
    { name: "Power of Attorney", description: "POA for authorized signatory", category: "legal", isRequired: true },
    { name: "ISO Certifications", description: "Relevant ISO certifications (9001, 14001, 45001)", category: "certifications", isRequired: false },
  ],
  government_ksa: [
    { name: "RFP/Tender Document", description: "Complete Request for Proposal from government portal", category: "core_documents", isRequired: true },
    { name: "Commercial Registration (CR)", description: "Valid Saudi Commercial Registration certificate", category: "company_credentials", isRequired: true },
    { name: "GOSI Certificate", description: "General Organization for Social Insurance compliance certificate", category: "company_credentials", isRequired: true },
    { name: "Zakat & Income Tax Certificate", description: "ZATCA certificate for tax compliance", category: "company_credentials", isRequired: true },
    { name: "Saudization Certificate (Nitaqat)", description: "Ministry of Human Resources Nitaqat compliance", category: "company_credentials", isRequired: true },
    { name: "Company Profile", description: "Detailed company profile with local presence details", category: "company_credentials", isRequired: true },
    { name: "Financial Statements (Audited)", description: "Latest audited financial statements", category: "financials", isRequired: true },
    { name: "Bank Guarantee", description: "Bank guarantee as per tender requirements", category: "financials", isRequired: false },
    { name: "Similar Project Experience", description: "Documentation of similar completed projects in KSA", category: "experience", isRequired: true },
    { name: "Technical Proposal", description: "Detailed technical solution and methodology", category: "proposals", isRequired: true },
    { name: "Commercial Proposal", description: "Pricing and commercial terms in SAR", category: "proposals", isRequired: true },
    { name: "Pre-Qualification Certificate", description: "Vendor pre-qualification for relevant category", category: "certifications", isRequired: false },
  ],
  government_qatar: [
    { name: "RFP/Tender Document", description: "Complete tender document from procuring entity", category: "core_documents", isRequired: true },
    { name: "Commercial Registration", description: "Valid Qatar Commercial Registration (CR)", category: "company_credentials", isRequired: true },
    { name: "Tax Card", description: "Valid Qatar Tax Card", category: "company_credentials", isRequired: true },
    { name: "QFC License (if applicable)", description: "Qatar Financial Centre license if applicable", category: "company_credentials", isRequired: false },
    { name: "Company Profile", description: "Detailed company profile and capabilities", category: "company_credentials", isRequired: true },
    { name: "Financial Statements", description: "Latest audited financial statements", category: "financials", isRequired: true },
    { name: "Bank Letter of Good Standing", description: "Bank confirmation of good financial standing", category: "financials", isRequired: true },
    { name: "Project References", description: "References from similar completed projects", category: "experience", isRequired: true },
    { name: "Technical Proposal", description: "Technical approach and methodology", category: "proposals", isRequired: true },
    { name: "Financial Proposal", description: "Detailed pricing in QAR", category: "proposals", isRequired: true },
    { name: "Bid Bond", description: "Bid bond/security as per tender requirements", category: "legal", isRequired: false },
  ],
  private_sector: [
    { name: "RFP Document", description: "Request for Proposal or requirements document", category: "core_documents", isRequired: true },
    { name: "Company Profile", description: "Corporate profile and capabilities overview", category: "company_credentials", isRequired: true },
    { name: "Trade License/Registration", description: "Valid business registration", category: "company_credentials", isRequired: true },
    { name: "Technical Proposal", description: "Technical solution and approach", category: "proposals", isRequired: true },
    { name: "Commercial Proposal", description: "Pricing and commercial terms", category: "proposals", isRequired: true },
    { name: "Project References", description: "Relevant project experience and references", category: "experience", isRequired: true },
    { name: "Team CVs", description: "Key personnel CVs and qualifications", category: "experience", isRequired: false },
    { name: "Insurance Certificates", description: "Professional liability and other relevant insurance", category: "legal", isRequired: false },
  ],
};

// Generate checklist based on intake profile
async function generateChecklistForProfile(profile: {
  rfpType: string;
  contractValueRange: string;
  clientRegion: string;
  clientType: string;
  specialRequirements?: string | null;
}): Promise<GeneratedChecklistItem[]> {
  // Determine template key based on client type and region
  let templateKey = 'private_sector';
  
  if (profile.clientType === 'government' || profile.clientType === 'semi_government') {
    const region = profile.clientRegion.toLowerCase();
    if (region.includes('uae') || region.includes('dubai') || region.includes('abu_dhabi')) {
      templateKey = 'government_uae';
    } else if (region.includes('saudi') || region.includes('ksa')) {
      templateKey = 'government_ksa';
    } else if (region.includes('qatar')) {
      templateKey = 'government_qatar';
    } else {
      templateKey = 'government_uae'; // Default to UAE for other GCC
    }
  }
  
  const baseChecklist = [...(GCC_DOCUMENT_TEMPLATES[templateKey] || GCC_DOCUMENT_TEMPLATES.private_sector)];
  
  // Add value-based requirements for large contracts
  if (profile.contractValueRange === 'large' || profile.contractValueRange === 'enterprise') {
    baseChecklist.push(
      { name: "Performance Bond Details", description: "Performance guarantee requirements and terms", category: "financials", isRequired: true },
      { name: "Subcontractor Details", description: "Details of any subcontractors or partners", category: "experience", isRequired: false },
      { name: "Risk Management Plan", description: "Project risk assessment and mitigation strategy", category: "proposals", isRequired: true }
    );
  }
  
  // Add certifications based on RFP type
  if (profile.rfpType === 'it_services' || profile.rfpType === 'technology') {
    baseChecklist.push(
      { name: "ISO 27001 Certificate", description: "Information Security Management certification", category: "certifications", isRequired: false },
      { name: "Data Protection Compliance", description: "GDPR/local data protection compliance documentation", category: "legal", isRequired: false }
    );
  }
  
  if (profile.rfpType === 'construction' || profile.rfpType === 'infrastructure') {
    baseChecklist.push(
      { name: "Safety Records", description: "HSE safety records and incident statistics", category: "certifications", isRequired: true },
      { name: "Equipment List", description: "List of available equipment and resources", category: "experience", isRequired: true }
    );
  }
  
  return baseChecklist;
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // ==================== STATIC FILES ====================
  // Serve uploaded logos
  const path = await import('path');
  const express = await import('express');
  const fsPromises = await import('fs/promises');
  app.use('/uploads', express.default.static(path.join(process.cwd(), 'uploads')));
  
  // Download endpoint for analysis text files (no auth required - files are already project-scoped)
  app.get('/api/downloads/analysis/:filename', async (req, res) => {
    try {
      const filename = req.params.filename;
      // Sanitize filename to prevent directory traversal - match how files are saved
      // Keep spaces and alphanumeric chars, replace dangerous chars only
      const safeFilename = filename.replace(/[^\w\s.-]/g, '_').replace(/\.{2,}/g, '.').trim();
      const filePath = path.join(process.cwd(), 'uploads', 'analysis', safeFilename);
      
      // Check if file exists
      try {
        await fsPromises.access(filePath);
      } catch {
        return res.status(404).json({ error: 'File not found' });
      }
      
      // Set headers for download
      res.setHeader('Content-Type', 'text/plain');
      res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
      
      const fileContent = await fsPromises.readFile(filePath, 'utf-8');
      res.send(fileContent);
    } catch (error: any) {
      console.error('Download error:', error);
      res.status(500).json({ error: error.message });
    }
  });
  

  
  // ==================== API VERSIONING ====================
  // Apply API versioning middleware to all API routes
  app.use('/api', apiVersioning as any);
  
  // Version-specific routes
  app.use('/api/v1', v1Routes);
  
  // For backwards compatibility, also serve v1 routes on the base /api path
  // This maintains compatibility while allowing explicit versioning
  app.use('/api', ((req: VersionedRequest, res: Response, next: NextFunction) => {
    // Track version usage for analytics
    trackVersionUsage(req);
    next();
  }) as unknown as RequestHandler);
  
  // ==================== AUTHENTICATION ====================
  app.use('/api/auth', authRoutes);

  // ==================== DOCUMENT SUMMARY ====================
  app.use('/api', documentSummaryRoutes);

  // ==================== AI AGENTS ====================
  app.use('/api/agents', agentRoutes);
  app.use('/api/agent-progress', agentProgressRoutes);

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
  
  // ==================== WEBSITE INFORMATION ====================
  app.post('/api/website-info/fetch', authenticateToken, fetchWebsiteInfo);
  app.post('/api/website-info/batch', authenticateToken, batchFetchWebsiteInfo);
  app.get('/api/website-info/cache', authenticateToken, getWebsiteInfoCache);
  app.post('/api/website-info/save', authenticateToken, saveWebsiteInfo);
  app.post('/api/website-info/fetch-and-save', authenticateToken, fetchAndSaveWebsiteInfo);
  
  // ==================== PROJECTS ====================
  app.use('/api/projects', projectsRoutes);

  // ==================== DOCUMENTS ====================
  app.use('/api', documentsRoutes);

  // ==================== BIDS ====================
  app.use('/api', bidsRoutes);

  // ==================== CHECKLIST & VERIFICATION SYSTEM ====================

  // GET /api/projects/:id/intake-profile - Get project intake profile
  app.get("/api/projects/:id/intake-profile", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const projectId = req.params.id;
      const profile = await storage.getIntakeProfile(projectId);
      res.json(profile || null);
    } catch (error: any) {
      console.error('Get intake profile error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/projects/:id/intake-profile - Create/Update intake profile
  app.post("/api/projects/:id/intake-profile", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const projectId = req.params.id;
      const companyId = req.user?.companyId ?? null;
      
      // Verify project exists and belongs to user's company
      const project = await storage.getProject(projectId, companyId);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }

      const { rfpType, contractValueRange, clientRegion, clientType, submissionDeadline, projectDuration, specialRequirements } = req.body;

      // Check if profile already exists
      const existingProfile = await storage.getIntakeProfile(projectId);
      
      if (existingProfile) {
        const updated = await storage.updateIntakeProfile(projectId, {
          rfpType,
          contractValueRange,
          clientRegion,
          clientType,
          submissionDeadline: submissionDeadline ? new Date(submissionDeadline) : null,
          projectDuration,
          specialRequirements,
          isComplete: true,
        });
        res.json(updated);
      } else {
        const profile = await storage.createIntakeProfile({
          projectId,
          rfpType,
          contractValueRange,
          clientRegion,
          clientType,
          submissionDeadline: submissionDeadline ? new Date(submissionDeadline) : null,
          projectDuration,
          specialRequirements,
          isComplete: true,
        });
        res.json(profile);
      }

      // Update project intake status
      await storage.updateIntakeStatus(projectId, 'profile_created', companyId);
    } catch (error: any) {
      console.error('Create/Update intake profile error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/projects/:id/checklist - Get checklist items with progress
  app.get("/api/projects/:id/checklist", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const projectId = req.params.id;
      const checklist = await storage.getChecklistWithProgress(projectId);
      res.json(checklist);
    } catch (error: any) {
      console.error('Get checklist error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/projects/:id/checklist/generate - Generate checklist using AI based on intake profile
  app.post("/api/projects/:id/checklist/generate", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const projectId = req.params.id;
      const companyId = req.user?.companyId ?? null;
      
      // Verify project exists
      const project = await storage.getProject(projectId, companyId);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }

      // Get intake profile
      const profile = await storage.getIntakeProfile(projectId);
      if (!profile) {
        return res.status(400).json({ error: "Please complete the intake profile first" });
      }

      // Delete existing checklist items
      await storage.deleteChecklistItemsByProject(projectId);

      // Generate AI-powered checklist based on profile
      const checklistItems = await generateChecklistForProfile(profile);

      // Create checklist items
      const createdItems = await storage.createChecklistItems(
        checklistItems.map((item, index) => ({
          projectId,
          name: item.name,
          description: item.description,
          category: item.category,
          isRequired: item.isRequired,
          sortOrder: index,
          aiGenerated: true,
        }))
      );

      // Update project intake status
      await storage.updateIntakeStatus(projectId, 'documents_pending', companyId);

      res.json({
        items: createdItems,
        totalRequired: createdItems.filter(i => i.isRequired).length,
        uploadedCount: 0,
        verifiedCount: 0,
        completionPercentage: 0,
      });
    } catch (error: any) {
      console.error('Generate checklist error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // PATCH /api/checklist/:id - Update a checklist item
  app.patch("/api/checklist/:id", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid checklist item ID" });
      }

      const updates = req.body;
      const updated = await storage.updateChecklistItem(id, updates);
      
      if (!updated) {
        return res.status(404).json({ error: "Checklist item not found" });
      }
      
      res.json(updated);
    } catch (error: any) {
      console.error('Update checklist item error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/checklist/:id/link-document - Link a document to a checklist item
  app.post("/api/checklist/:id/link-document", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const checklistItemId = parseInt(req.params.id, 10);
      if (isNaN(checklistItemId)) {
        return res.status(400).json({ error: "Invalid checklist item ID" });
      }

      const { documentId, confidence } = req.body;
      if (!documentId) {
        return res.status(400).json({ error: "documentId is required" });
      }

      const updated = await storage.linkDocumentToChecklistItem(
        checklistItemId,
        documentId,
        confidence ?? 1.0
      );
      
      if (!updated) {
        return res.status(404).json({ error: "Checklist item not found" });
      }
      
      res.json(updated);
    } catch (error: any) {
      console.error('Link document to checklist error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/projects/:id/integrity-reports - Get all document integrity reports for a project
  app.get("/api/projects/:id/integrity-reports", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const projectId = req.params.id;
      const reports = await storage.getIntegrityReportsByProject(projectId);
      res.json(reports);
    } catch (error: any) {
      console.error('Get integrity reports error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/documents/:id/integrity-report - Get integrity report for a specific document
  app.get("/api/documents/:id/integrity-report", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const documentId = parseInt(req.params.id, 10);
      if (isNaN(documentId)) {
        return res.status(400).json({ error: "Invalid document ID" });
      }
      
      const report = await storage.getDocumentIntegrityReport(documentId);
      res.json(report || null);
    } catch (error: any) {
      console.error('Get integrity report error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/projects/:id/requirements - Get all requirements with coverage status
  app.get("/api/projects/:id/requirements", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const projectId = req.params.id;
      const requirements = await storage.getRequirementsWithCoverage(projectId);
      res.json(requirements);
    } catch (error: any) {
      console.error('Get requirements error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/projects/:id/requirements/extract - Extract requirements from project documents using AI
  app.post("/api/projects/:id/requirements/extract", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const projectId = req.params.id;
      const companyId = req.user?.companyId ?? null;
      
      const project = await storage.getProject(projectId, companyId);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      
      const documents = await storage.getDocuments(projectId);
      if (documents.length === 0) {
        return res.status(400).json({ error: "No documents found to extract requirements from" });
      }
      
      const documentsWithContent = documents.filter(doc => doc.content && doc.content.trim().length > 100);
      if (documentsWithContent.length === 0) {
        return res.status(400).json({ error: "No document content available for extraction" });
      }
      
      const documentContext = documentsWithContent.map(doc => {
        const content = doc.content?.substring(0, 15000) || '';
        return `--- Document: ${doc.filename} (ID: ${doc.id}) ---\n${content}`;
      }).join('\n\n');
      
      const extractionPrompt = `You are an expert RFP/tender analyst specializing in extracting requirements from bid documents.

Analyze the following documents and extract ALL requirements, obligations, and deliverables that a bidder must address. Focus on:
1. Mandatory requirements (must-have)
2. Evaluation criteria and scoring requirements
3. Technical specifications
4. Compliance requirements
5. Documentation requirements
6. Delivery/timeline requirements
7. Commercial/pricing requirements

For each requirement, provide:
- code: A unique short code (e.g., "REQ-001", "TECH-001", "COMP-001")
- title: A brief title for the requirement
- description: Full description of what is required
- category: One of: technical, compliance, commercial, administrative, documentation, legal
- priority: "critical" if explicitly mandatory, "high" if scoring-weighted, "medium" otherwise
- isMandatory: true if explicitly stated as mandatory/required, false otherwise
- sourceSection: The section name or header where this was found
- sourcePage: Approximate page number if discernible
- sourceText: The exact quote from the document (max 200 chars)
- evaluationPoints: Numeric points if mentioned (null otherwise)

Return a JSON array of requirements. Be thorough - extract ALL requirements, even implicit ones.

DOCUMENTS:
${documentContext}

Return ONLY a valid JSON array like:
[
  {
    "code": "REQ-001",
    "title": "Example Requirement",
    "description": "Full description...",
    "category": "technical",
    "priority": "critical",
    "isMandatory": true,
    "sourceSection": "Section 3.1",
    "sourcePage": 5,
    "sourceText": "The vendor shall provide...",
    "evaluationPoints": 10
  }
]`;

      const response = await generateBidWithAnthropic({
        instructions: extractionPrompt,
        context: '',
        tone: 'analytical',
      });
      
      let requirements: any[] = [];
      try {
        const jsonMatch = response.content.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          requirements = JSON.parse(jsonMatch[0]);
        }
      } catch (parseError) {
        console.error('Failed to parse AI requirements response:', parseError);
        return res.status(500).json({ error: "Failed to parse extracted requirements" });
      }
      
      if (!Array.isArray(requirements) || requirements.length === 0) {
        return res.status(200).json({ message: "No requirements found in documents", requirements: [] });
      }
      
      await storage.deleteProjectRequirementsByProject(projectId);
      
      const validCategories = ['technical', 'compliance', 'commercial', 'administrative', 'documentation', 'legal'];
      const validPriorities = ['critical', 'high', 'medium', 'low'];
      
      const requirementsToInsert = requirements.map((req, index) => ({
        projectId,
        code: req.code || `REQ-${String(index + 1).padStart(3, '0')}`,
        title: req.title || 'Untitled Requirement',
        description: req.description || null,
        category: validCategories.includes(req.category) ? req.category : 'technical',
        priority: validPriorities.includes(req.priority) ? req.priority : 'medium',
        sourceDocumentId: documentsWithContent.find(d => 
          req.sourceSection?.includes(d.filename) || req.sourceText?.includes(d.filename)
        )?.id || documentsWithContent[0].id,
        sourceSection: req.sourceSection || null,
        sourcePage: typeof req.sourcePage === 'number' ? req.sourcePage : null,
        sourceText: req.sourceText?.substring(0, 500) || null,
        isMandatory: req.isMandatory ?? true,
        evaluationPoints: typeof req.evaluationPoints === 'number' ? req.evaluationPoints : null,
      }));
      
      const createdRequirements = await storage.createProjectRequirements(requirementsToInsert);
      
      console.log(`Extracted ${createdRequirements.length} requirements for project ${projectId}`);
      res.json({ 
        message: `Successfully extracted ${createdRequirements.length} requirements`,
        requirements: createdRequirements,
      });
    } catch (error: any) {
      console.error('Extract requirements error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/projects/:id/verification-gates - Get all verification gates for a project
  app.get("/api/projects/:id/verification-gates", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const projectId = req.params.id;
      const gates = await storage.getVerificationGates(projectId);
      res.json(gates);
    } catch (error: any) {
      console.error('Get verification gates error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/projects/:id/verification-gates - Create or update a verification gate
  const verificationGateSchema = z.object({
    gateNumber: z.number().int().min(1).max(10),
    gateName: z.string().min(1).max(100),
    status: z.enum(['pending', 'passed', 'blocked', 'warning']),
    overallScore: z.number().min(0).max(100).optional().nullable(),
    checkResults: z.array(z.object({
      checkName: z.string(),
      passed: z.boolean(),
      score: z.number().optional(),
      message: z.string(),
      details: z.string().optional(),
      isMandatory: z.boolean().optional(),
    })).optional().default([]),
    issuesCount: z.number().int().min(0).optional().default(0),
    warningsCount: z.number().int().min(0).optional().default(0),
  });
  
  app.post("/api/projects/:id/verification-gates", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const projectId = req.params.id;
      
      const parsed = verificationGateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ 
          error: "Invalid gate data", 
          details: parsed.error.errors 
        });
      }
      
      const { gateNumber, gateName, status, overallScore, checkResults, issuesCount, warningsCount } = parsed.data;
      
      const gate = await storage.createOrUpdateVerificationGate({
        projectId,
        gateNumber,
        gateName,
        status,
        overallScore: overallScore ?? null,
        checkResults,
        issuesCount,
        warningsCount,
      });
      
      res.json(gate);
    } catch (error: any) {
      console.error('Create/update verification gate error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/projects/:id/verification-gates/:gateNumber/acknowledge - Acknowledge a verification gate
  app.post("/api/projects/:id/verification-gates/:gateNumber/acknowledge", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const projectId = req.params.id;
      const gateNumber = parseInt(req.params.gateNumber, 10);
      const userId = req.user?.userId;
      const { acknowledgeWithRisks } = req.body;

      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      const gate = await storage.acknowledgeGate(
        projectId,
        gateNumber,
        userId,
        acknowledgeWithRisks ?? false
      );
      
      if (!gate) {
        return res.status(404).json({ error: "Verification gate not found" });
      }
      
      res.json(gate);
    } catch (error: any) {
      console.error('Acknowledge gate error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ==================== DOCUMENT IMAGES ====================

  // GET /api/documents/image/:filename - Serve uploaded image files for preview
  app.get("/api/documents/image/:filename", async (req, res) => {
    try {
      const { filename } = req.params;
      
      // Sanitize filename to prevent directory traversal
      const safeFilename = path.basename(filename);
      const imagePath = path.join(process.cwd(), 'uploads', 'images', safeFilename);
      
      // Check if file exists
      try {
        await fsPromises.access(imagePath);
      } catch {
        return res.status(404).json({ error: "Image not found" });
      }
      
      // Get file extension and set appropriate content type
      const ext = path.extname(safeFilename).toLowerCase();
      const contentTypes: Record<string, string> = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
        '.bmp': 'image/bmp',
        '.tiff': 'image/tiff',
      };
      
      const contentType = contentTypes[ext] || 'application/octet-stream';
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 24 hours
      
      const imageBuffer = await fsPromises.readFile(imagePath);
      res.send(imageBuffer);
    } catch (error: any) {
      console.error('Error serving image:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ==================== DOCUMENT SUMMARIES ====================

  // GET /api/documents/:id/summary - Get summary for a specific document
  app.get("/api/documents/:id/summary", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const documentId = parseInt(req.params.id);
      const companyId = req.user?.companyId ?? null;

      // Verify document belongs to user's company
      const [doc] = await db
        .select({ projectId: documents.projectId })
        .from(documents)
        .where(eq(documents.id, documentId))
        .limit(1);

      if (!doc) {
        return res.status(404).json({ error: "Document not found" });
      }

      // Verify project belongs to company
      const project = await storage.getProject(doc.projectId, companyId);
      if (!project) {
        return res.status(403).json({ error: "Access denied" });
      }

      const summary = await documentSummarizationService.getSummary(documentId);

      if (!summary) {
        return res.status(404).json({ error: "Summary not found for this document" });
      }

      res.json(summary);
    } catch (error: any) {
      console.error('Error fetching document summary:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // PUT /api/documents/:id/summary - Update a document summary by document ID
  app.put("/api/documents/:id/summary", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const documentId = parseInt(req.params.id);
      const companyId = req.user?.companyId ?? null;
      const { summaryContent } = req.body;

      // Get document and verify ownership
      const [doc] = await db
        .select({ projectId: documents.projectId })
        .from(documents)
        .where(eq(documents.id, documentId))
        .limit(1);

      if (!doc) {
        return res.status(404).json({ error: "Document not found" });
      }

      // Verify project belongs to company
      const project = await storage.getProject(doc.projectId, companyId);
      if (!project) {
        return res.status(403).json({ error: "Access denied" });
      }

      // Get existing summary for this document
      const [existing] = await db
        .select({ id: documentSummaries.id })
        .from(documentSummaries)
        .where(eq(documentSummaries.documentId, documentId))
        .limit(1);

      if (!existing) {
        return res.status(404).json({ error: "Summary not found for this document" });
      }

      // Update summary
      await documentSummarizationService.updateSummary(existing.id, {
        summaryContent,
      });

      // Fetch updated summary
      const updated = await documentSummarizationService.getSummary(documentId);
      res.json(updated);
    } catch (error: any) {
      console.error('Error updating document summary:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // PUT /api/summaries/:id - Update a document summary
  app.put("/api/summaries/:id", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const summaryId = parseInt(req.params.id);
      const companyId = req.user?.companyId ?? null;
      const { summaryContent, structuredData } = req.body;

      // Get existing summary to verify ownership
      const [existing] = await db
        .select({
          id: documentSummaries.id,
          documentId: documentSummaries.documentId,
          projectId: documentSummaries.projectId,
        })
        .from(documentSummaries)
        .where(eq(documentSummaries.id, summaryId))
        .limit(1);

      if (!existing) {
        return res.status(404).json({ error: "Summary not found" });
      }

      // Verify project belongs to company
      const project = await storage.getProject(existing.projectId, companyId);
      if (!project) {
        return res.status(403).json({ error: "Access denied" });
      }

      // Update summary and regenerate chunks
      await documentSummarizationService.updateSummary(summaryId, {
        summaryContent,
        structuredData,
      });

      // Fetch updated summary
      const updated = await documentSummarizationService.getSummary(existing.documentId);

      res.json({
        success: true,
        message: "Summary updated and chunks regenerated",
        summary: updated,
      });
    } catch (error: any) {
      console.error('Error updating summary:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/projects/:id/summaries - Get all summaries for a project
  app.get("/api/projects/:id/summaries", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const projectId = req.params.id;
      const companyId = req.user?.companyId ?? null;

      // Verify project belongs to company
      const project = await storage.getProject(projectId, companyId);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }

      // Get all summaries with document info
      const summaries = await db
        .select({
          summary: documentSummaries,
          document: {
            id: documents.id,
            filename: documents.filename,
            uploadedAt: documents.uploadedAt,
          },
        })
        .from(documentSummaries)
        .innerJoin(documents, eq(documentSummaries.documentId, documents.id))
        .where(eq(documentSummaries.projectId, projectId));

      res.json(summaries);
    } catch (error: any) {
      console.error('Error fetching project summaries:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/projects/:id/generate-all-summaries - Generate summaries for all documents without summaries
  app.post("/api/projects/:id/generate-all-summaries", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const projectId = req.params.id;
      const companyId = req.user?.companyId ?? null;

      // Verify project belongs to company
      const project = await storage.getProject(projectId, companyId);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }

      // Get all documents without summaries
      const docsWithoutSummaries = await db
        .select({
          id: documents.id,
          filename: documents.filename,
        })
        .from(documents)
        .leftJoin(documentSummaries, eq(documents.id, documentSummaries.documentId))
        .where(and(
          eq(documents.projectId, projectId),
          isNull(documentSummaries.id)
        ));

      if (docsWithoutSummaries.length === 0) {
        return res.json({ 
          success: true, 
          message: "All documents already have summaries",
          generated: 0 
        });
      }

      // Generate summaries for each document
      const results = [];
      for (const doc of docsWithoutSummaries) {
        try {
          const result = await documentSummarizationService.summarizeDocument(doc.id);
          results.push({ documentId: doc.id, filename: doc.filename, success: true, ...result });
        } catch (error: any) {
          console.error(`Failed to generate summary for document ${doc.id}:`, error);
          results.push({ documentId: doc.id, filename: doc.filename, success: false, error: error.message });
        }
      }

      const successful = results.filter(r => r.success).length;
      res.json({
        success: true,
        message: `Generated ${successful} of ${docsWithoutSummaries.length} summaries`,
        generated: successful,
        results,
      });
    } catch (error: any) {
      console.error('Error generating project summaries:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/documents/:id/regenerate-summary - Manually trigger summary regeneration
  app.post("/api/documents/:id/regenerate-summary", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const documentId = parseInt(req.params.id);
      const companyId = req.user?.companyId ?? null;

      // Verify document access
      const [doc] = await db
        .select()
        .from(documents)
        .where(eq(documents.id, documentId))
        .limit(1);

      if (!doc) {
        return res.status(404).json({ error: "Document not found" });
      }

      const project = await storage.getProject(doc.projectId, companyId);
      if (!project) {
        return res.status(403).json({ error: "Access denied" });
      }

      // Delete existing summary if present
      await db
        .delete(documentSummaries)
        .where(eq(documentSummaries.documentId, documentId));

      // Regenerate
      const result = await documentSummarizationService.summarizeDocument(documentId);

      res.json({
        success: true,
        message: "Summary regenerated successfully",
        result,
      });
    } catch (error: any) {
      console.error('Error regenerating summary:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ==================== BID GENERATION ====================
  // Note: Bid routes are now in bids.ts
  // The following routes are kept here temporarily for reference:
  /*
  app.post("/api/projects/:id/generate", authenticateToken, async (req: AuthRequest, res) => {
    const generationStartTime = Date.now();
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

      // Use RAG with hybrid search to find most relevant document chunks
      console.log('Performing RAG search for relevant document context...');
      
      let context = '';
      let searchMethod = 'hybrid_rag';
      let chunksUsed = 0;
      
      try {
        // Generate embedding for the user's instructions to find semantically similar content
        const queryEmbedding = await generateEmbedding(sanitizedInstructions);
        
        // Hybrid search: combines vector similarity (70%) + full-text search (30%)
        // Searches both current project AND historical "Closed-Won" projects
        const relevantChunks = await storage.searchHybrid(
          sanitizedInstructions,
          queryEmbedding,
          projectId,
          companyId,
          20, // Get top 20 most relevant chunks
          { vectorWeight: 0.7, textWeight: 0.3 }
        );
        
        chunksUsed = relevantChunks.length;
        console.log(`Found ${chunksUsed} relevant chunks via hybrid RAG search`);
        
        let projectContext = '';
        if (relevantChunks.length > 0) {
          // Build context from the most relevant chunks
          projectContext = relevantChunks
            .map((chunk, i) => {
              const scoreInfo = `[Relevance: ${(chunk.score * 100).toFixed(1)}%]`;
              return `--- Relevant Project Section ${i + 1} ${scoreInfo} ---\n${chunk.content}`;
            })
            .join('\n\n');
        }
        
        // Also search company knowledge base for additional context
        let knowledgeBaseContext = '';
        if (companyId) {
          try {
            const kbChunks = await storage.searchKnowledgeBaseChunks(queryEmbedding, companyId, 10);
            if (kbChunks.length > 0) {
              console.log(`Found ${kbChunks.length} relevant knowledge base chunks`);
              knowledgeBaseContext = '\n\n--- COMPANY KNOWLEDGE BASE ---\n' + 
                kbChunks
                  .map((chunk, i) => `[Knowledge ${i + 1}] ${chunk.content}`)
                  .join('\n\n');
              chunksUsed += kbChunks.length;
            }
          } catch (kbError) {
            console.warn('Knowledge base search failed:', kbError);
          }
        }
        
        // Include sketch analysis data from project metadata
        let sketchAnalysisContext = '';
        const projectMetadata = project.metadata as Record<string, any> | null;
        if (projectMetadata?.sketchAnalysis && Array.isArray(projectMetadata.sketchAnalysis)) {
          const sketchResults = projectMetadata.sketchAnalysis;
          console.log(`Found ${sketchResults.length} sketch analysis results in project metadata`);
          
          sketchAnalysisContext = '\n\n--- SKETCH/DRAWING ANALYSIS (Use this technical data in the bid) ---\n';
          sketchAnalysisContext += sketchResults.map((sketch: any, i: number) => {
            const parts: string[] = [];
            
            // Handle both new schema (context_layer, technical_data) and legacy schema
            const contextLayer = sketch.context_layer || {};
            const technicalData = sketch.technical_data || {};
            const projectMeta = sketch.project_metadata || {};
            
            // Document type and description
            const docType = contextLayer.document_type || sketch.document_type || 'Technical Drawing';
            parts.push(`\n[Sketch ${i + 1}: ${docType}]`);
            
            if (contextLayer.description) {
              parts.push(`Description: ${contextLayer.description}`);
            }
            
            if (contextLayer.purpose) {
              parts.push(`Purpose: ${contextLayer.purpose}`);
            }
            
            // Project metadata
            if (projectMeta.project_title) {
              parts.push(`Project Title: ${projectMeta.project_title}`);
            }
            if (projectMeta.project_number) {
              parts.push(`Project Number: ${projectMeta.project_number}`);
            }
            if (projectMeta.status) {
              parts.push(`Status: ${projectMeta.status}`);
            }
            if (projectMeta.scale && projectMeta.scale !== 'NTS') {
              parts.push(`Scale: ${projectMeta.scale}`);
            }
            
            // Dimensions (handle both nested and flat structure)
            const dimensions = technicalData.dimensions || sketch.dimensions || [];
            if (dimensions.length > 0) {
              parts.push(`Dimensions:\n${dimensions.map((d: any) => 
                `  - ${d.label || d.type}: ${d.value} ${d.unit}${d.location ? ` (${d.location})` : ''}`
              ).join('\n')}`);
            }
            
            // Materials (handle both nested and flat structure)
            const materials = technicalData.materials || sketch.materials || [];
            if (materials.length > 0) {
              parts.push(`Materials:\n${materials.map((m: any) => {
                const name = m.component || m.name || 'Unknown';
                const spec = m.spec || m.specification || '';
                const grade = m.grade ? ` Grade: ${m.grade}` : '';
                const qty = m.quantity ? ` Qty: ${m.quantity} ${m.unit || ''}` : '';
                return `  - ${name}${spec ? `: ${spec}` : ''}${grade}${qty}`;
              }).join('\n')}`);
            }
            
            // Components (handle both nested and flat structure)
            const components = technicalData.components || sketch.components || [];
            if (components.length > 0) {
              parts.push(`Components:\n${components.map((c: any) => {
                const type = c.type || 'Component';
                const desc = c.description ? `: ${c.description}` : '';
                const size = c.size ? ` Size: ${c.size}` : '';
                const count = c.count ? ` x${c.count}` : '';
                const loc = c.location ? ` at ${c.location}` : '';
                const mat = c.material ? ` (${c.material})` : '';
                return `  - ${type}${desc}${size}${count}${loc}${mat}`;
              }).join('\n')}`);
            }
            
            // Quantities
            const quantities = technicalData.quantities || {};
            if (Object.keys(quantities).length > 0) {
              const qtyParts = [];
              if (quantities.concrete_volume_m3 > 0) qtyParts.push(`Concrete: ${quantities.concrete_volume_m3} m³`);
              if (quantities.steel_weight_kg > 0) qtyParts.push(`Steel: ${quantities.steel_weight_kg} kg`);
              if (quantities.foundation_count > 0) qtyParts.push(`Foundations: ${quantities.foundation_count}`);
              if (qtyParts.length > 0) parts.push(`Quantities: ${qtyParts.join(', ')}`);
            }
            
            // Specifications
            const specifications = sketch.specifications || [];
            if (specifications.length > 0) {
              parts.push(`Specifications:\n${specifications.map((s: string) => `  - ${s}`).join('\n')}`);
            }
            
            // Standards and codes
            const standards = sketch.standards || [];
            if (standards.length > 0) {
              parts.push(`Standards: ${standards.join(', ')}`);
            }
            
            const regionalCodes = sketch.regional_codes || [];
            if (regionalCodes.length > 0) {
              parts.push(`Regional Codes: ${regionalCodes.join(', ')}`);
            }
            
            // Annotations
            const annotations = sketch.annotations || [];
            if (annotations.length > 0) {
              parts.push(`Key Annotations: ${annotations.slice(0, 10).join(', ')}${annotations.length > 10 ? '...' : ''}`);
            }
            
            // Views included
            const views = sketch.views_included || [];
            if (views.length > 0) {
              parts.push(`Views: ${views.join(', ')}`);
            }
            
            // Notes and warnings
            if (sketch.notes) {
              parts.push(`Notes: ${sketch.notes}`);
            }
            
            const warnings = sketch.warnings || [];
            if (warnings.length > 0) {
              parts.push(`Warnings: ${warnings.join(', ')}`);
            }
            
            // Confidence score
            if (sketch.confidence_score) {
              parts.push(`Analysis Confidence: ${(sketch.confidence_score * 100).toFixed(0)}%`);
            }
            
            return parts.join('\n');
          }).join('\n\n');
          sketchAnalysisContext += '\n--- END SKETCH ANALYSIS ---';
        }
        
        context = projectContext + knowledgeBaseContext + sketchAnalysisContext;
      } catch (embeddingError: any) {
        // Fallback to direct document content if embedding fails
        console.warn('RAG search failed, falling back to direct document content:', embeddingError.message);
        searchMethod = 'document_content_fallback';
        
        const documents = await storage.listDocumentsByProject(projectId);
        context = documents
          .filter((doc: { content: string | null }) => doc.content && !doc.content.startsWith('[PDF content could not be extracted'))
          .map((doc: { filename: string; content: string | null }, i: number) => `[Document ${i + 1}: ${doc.filename}]\n${doc.content?.substring(0, 5000) || ''}`)
          .join('\n\n---\n\n');
        chunksUsed = documents.length;
      }

      const contextOrDefault = context || 'No document content available. Please provide project details in your instructions.';
      
      console.log(`Using ${chunksUsed} chunks/documents for bid generation via ${searchMethod}`);

      // Get branding config for professional template styling AND AI context
      // Prefer user-specific branding if available, otherwise fall back to company config
      const userId = req.user?.userId ?? null;
      const userBranding = await getUserBrandingConfig(userId);
      const companyConfigForTemplate = userBranding || await getCompanyConfig(companyId);
      
      // Build company profile context for the AI to use
      // This ensures the AI uses the user's actual company info, not placeholder data
      const companyProfileContext = `
--- YOUR COMPANY PROFILE (Use this for all company references) ---
Company Name: ${companyConfigForTemplate.name}
Tagline: ${companyConfigForTemplate.tagline}
Website: ${companyConfigForTemplate.website}
License Number: ${companyConfigForTemplate.licenseNumber || 'N/A'}

Address: ${companyConfigForTemplate.address}, ${companyConfigForTemplate.city}, ${companyConfigForTemplate.state} ${companyConfigForTemplate.zip}

Contact Representative:
- Name: ${companyConfigForTemplate.defaultRep.name}
- Title: ${companyConfigForTemplate.defaultRep.title}
- Phone: ${companyConfigForTemplate.defaultRep.phone}
- Email: ${companyConfigForTemplate.defaultRep.email}

IMPORTANT: When referencing "our company" or company contact information in the bid, 
use ONLY the above company profile information. Do NOT use any other company names 
or contact details from other sources.
--- END COMPANY PROFILE ---

`;

      // Combine company profile with document context
      const fullContext = companyProfileContext + contextOrDefault;

      const generationParams = {
        instructions: sanitizedInstructions,
        context: fullContext,
        tone: sanitizedTone,
      };
      
      // Check if multi-model comparison is requested
      if (models && models.length > 1) {
        console.log(`Multi-model comparison requested for: ${models.join(', ')}`);
        
        // Generate bids in parallel for all requested models
        const generatedBids = await Promise.all(
          models.map(async (modelName) => {
            try {
              const result = await generateBidWithModel(modelName, generationParams);
              const cleanedHtml = sanitizeModelHtml(result.content);
              // Wrap AI-generated content with premium GCC Gulf template
              const html = wrapContentInPremiumTemplate(
                cleanedHtml,
                project.name,
                project.clientName || 'Valued Client',
                {},
                companyConfigForTemplate
              );
              const lmmCost = calculateLMMCost(modelName, result.inputTokens, result.outputTokens);
              return { model: modelName, html, rawContent: cleanedHtml, success: true, inputTokens: result.inputTokens, outputTokens: result.outputTokens, lmmCost };
            } catch (error: any) {
              return { model: modelName, html: '', success: false, error: error.message, inputTokens: 0, outputTokens: 0, lmmCost: 0 };
            }
          })
        );
        
        // Save bids sequentially to avoid transaction conflicts
        const results = [];
        for (const genResult of generatedBids) {
          if (genResult.success && genResult.html) {
            try {
              const generationTimeSeconds = Math.round((Date.now() - generationStartTime) / 1000);
              const savedBid = await storage.createBid({
                projectId,
                companyId: companyId,
                userId: req.user?.userId,
                content: genResult.html,
                rawContent: genResult.rawContent,
                instructions: sanitizedInstructions,
                tone: sanitizedTone,
                model: genResult.model,
                searchMethod,
                chunksUsed,
                lmmCost: genResult.lmmCost,
                generationTimeSeconds,
              });
              results.push({ ...genResult, bidId: savedBid.id, version: savedBid.version });
            } catch (saveError: any) {
              results.push({ ...genResult, saveError: saveError.message });
            }
          } else {
            results.push(genResult);
          }
        }

        res.json({
          comparison: true,
          results,
          chunksUsed,
          searchMethod,
        });
      } else {
        // Single model generation (original behavior)
        const selectedModel = models?.[0] || model;
        const result = await generateBidWithModel(selectedModel, generationParams);
        const cleanedHtml = sanitizeModelHtml(result.content);
        
        // Wrap AI-generated content with premium GCC Gulf template
        const html = wrapContentInPremiumTemplate(
          cleanedHtml,
          project.name,
          project.clientName || 'Valued Client',
          {},
          companyConfigForTemplate
        );

        // Calculate real LMM cost based on actual token usage
        const lmmCost = calculateLMMCost(selectedModel, result.inputTokens, result.outputTokens);
        
        // Save the generated bid to database
        const generationTimeSeconds = Math.round((Date.now() - generationStartTime) / 1000);
        const savedBid = await storage.createBid({
          projectId,
          companyId: companyId,
          userId: req.user?.userId,
          content: html,
          rawContent: cleanedHtml,
          instructions: sanitizedInstructions,
          tone: sanitizedTone,
          model: selectedModel,
          searchMethod,
          chunksUsed,
          lmmCost,
          generationTimeSeconds,
        });

        console.log(`Bid saved with ID: ${savedBid.id}, version: ${savedBid.version}, LMM cost: $${lmmCost} (${result.inputTokens} input + ${result.outputTokens} output tokens)`);

        res.json({
          bid: savedBid,
          html,
          rawContent: cleanedHtml,
          chunksUsed,
          model: selectedModel,
          searchMethod,
          tokenUsage: {
            inputTokens: result.inputTokens,
            outputTokens: result.outputTokens,
            lmmCost,
          },
        });
      }
    } catch (error: any) {
      console.error('Generation error:', error);
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
      const userId = req.user?.userId ?? null;
      
      if (!content || !projectName || !clientName) {
        return res.status(400).json({ error: 'Content, projectName, and clientName are required' });
      }
      
      // Load user-specific branding if available, otherwise fall back to company config
      const userBranding = await getUserBrandingConfig(userId);
      const companyConfigData = userBranding || await getCompanyConfig(companyId);
      
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

  // Get LLM costs per project (requires authentication, company-scoped)
  app.get("/api/dashboard/project-costs", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const companyId = req.user?.companyId ?? null;
      
      // Get total LLM cost per project from bids table
      const result = await db.execute(sql`
        SELECT 
          b.project_id,
          COALESCE(SUM(b.lmm_cost), 0) as total_cost
        FROM bids b
        JOIN projects p ON b.project_id = p.id
        WHERE ${companyId !== null ? sql`p.company_id = ${companyId}` : sql`p.company_id IS NULL`}
        GROUP BY b.project_id
      `);
      
      // Convert to a map for easy lookup
      const costs: Record<string, number> = {};
      for (const row of result.rows as any[]) {
        costs[row.project_id] = parseFloat(row.total_cost) || 0;
      }
      
      res.json(costs);
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

  // ==================== COMPANY ADMIN ROUTES ====================

  // Get current company info (company_admin only)
  app.get("/api/company", authenticateToken, requireRole(['company_admin', 'admin', 'system_admin']), async (req: AuthRequest, res) => {
    try {
      const companyId = req.user?.companyId;
      if (!companyId) {
        return res.status(400).json({ error: "No company associated with this account" });
      }
      
      const company = await storage.getCompany(companyId);
      if (!company) {
        return res.status(404).json({ error: "Company not found" });
      }
      
      res.json({ company });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // List company users (company_admin only - company_user cannot see other users)
  app.get("/api/company/users", authenticateToken, requireRole(['company_admin', 'admin', 'system_admin']), async (req: AuthRequest, res) => {
    try {
      const companyId = req.user?.companyId;
      if (!companyId) {
        return res.status(400).json({ error: "No company associated with this account" });
      }
      
      const users = await storage.listCompanyUsers(companyId);
      res.json({ users });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Create invitation (company admin only)
  const createInviteSchema = z.object({
    email: z.string().email('Invalid email format'),
    role: z.enum(['company_admin', 'company_user', 'admin']).optional().default('company_user').transform((role) => {
      // Map old 'admin' role to new 'company_admin' for backward compatibility
      return role === 'admin' ? 'company_admin' : role;
    }),
  });

  app.post("/api/company/invites", authenticateToken, requireRole(['company_admin', 'admin', 'system_admin']), async (req: AuthRequest, res) => {
    try {
      const companyId = req.user?.companyId;
      const userId = req.user?.userId;
      
      if (!companyId || !userId) {
        return res.status(400).json({ error: "No company associated with this account" });
      }
      
      const { email, role } = createInviteSchema.parse(req.body);
      
      // Validate that role is company-scoped only
      if (!validateCompanyUserRole(role)) {
        return res.status(400).json({ error: "Invalid role. Only company_admin or company_user roles are allowed for company invitations" });
      }
      
      // Check if email already has pending invite
      const hasExisting = await storage.hasExistingInvite(email, companyId);
      if (hasExisting) {
        return res.status(400).json({ error: "An invitation is already pending for this email" });
      }
      
      // Generate unique invite code
      const inviteCode = crypto.randomBytes(32).toString('hex');
      
      // Set expiration to 7 days from now
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);
      
      const invite = await storage.createCompanyInvite({
        companyId,
        email,
        role,
        inviteCode,
        invitedBy: userId,
        expiresAt,
      });
      
      res.status(201).json({ 
        invite: {
          id: invite.id,
          email: invite.email,
          role: invite.role,
          inviteCode: invite.inviteCode,
          expiresAt: invite.expiresAt,
          createdAt: invite.createdAt,
        }
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid input', details: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  });

  // List pending invitations (company admin only)
  app.get("/api/company/invites", authenticateToken, requireRole(['company_admin', 'admin', 'system_admin']), async (req: AuthRequest, res) => {
    try {
      const companyId = req.user?.companyId;
      if (!companyId) {
        return res.status(400).json({ error: "No company associated with this account" });
      }
      
      const invites = await storage.listCompanyInvites(companyId);
      res.json({ invites });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Revoke invitation (admin only)
  app.delete("/api/company/invites/:inviteId", authenticateToken, requireRole(['admin']), async (req: AuthRequest, res) => {
    try {
      const companyId = req.user?.companyId;
      if (!companyId) {
        return res.status(400).json({ error: "No company associated with this account" });
      }
      
      const inviteId = parseInt(req.params.inviteId, 10);
      if (isNaN(inviteId)) {
        return res.status(400).json({ error: "Invalid invite ID" });
      }
      
      const success = await storage.revokeInvite(inviteId, companyId);
      if (!success) {
        return res.status(404).json({ error: "Invitation not found" });
      }
      
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Update user role (admin only)
  const updateRoleSchema = z.object({
    role: z.enum(['admin', 'manager', 'user', 'viewer']),
  });

  app.patch("/api/company/users/:userId/role", authenticateToken, requireRole(['company_admin', 'admin', 'system_admin']), async (req: AuthRequest, res) => {
    try {
      const companyId = req.user?.companyId;
      const currentUserId = req.user?.userId;
      
      if (!companyId) {
        return res.status(400).json({ error: "No company associated with this account" });
      }
      
      const targetUserId = parseInt(req.params.userId, 10);
      if (isNaN(targetUserId)) {
        return res.status(400).json({ error: "Invalid user ID" });
      }
      
      // Prevent admin from changing their own role
      if (targetUserId === currentUserId) {
        return res.status(400).json({ error: "Cannot change your own role" });
      }
      
      const { role } = updateRoleSchema.parse(req.body);
      
      const user = await storage.updateUserRole(targetUserId, companyId, role);
      if (!user) {
        return res.status(404).json({ error: "User not found in your company" });
      }
      
      res.json({ user: { id: user.id, email: user.email, name: user.name, role: user.role } });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid input', details: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  });

  // Deactivate user (company_admin or system_admin)
  app.post("/api/company/users/:userId/deactivate", authenticateToken, requireRole(['company_admin', 'system_admin']), async (req: AuthRequest, res) => {
    try {
      const companyId = req.user?.companyId;
      const currentUserId = req.user?.userId;
      const userRole = req.user?.role;
      
      if (!companyId && userRole !== 'system_admin') {
        return res.status(400).json({ error: "No company associated with this account" });
      }
      
      const targetUserId = parseInt(req.params.userId, 10);
      if (isNaN(targetUserId)) {
        return res.status(400).json({ error: "Invalid user ID" });
      }
      
      // Prevent user from deactivating themselves
      if (targetUserId === currentUserId) {
        return res.status(400).json({ error: "Cannot deactivate your own account" });
      }
      
      const success = await storage.deactivateUser(targetUserId, companyId!);
      if (!success) {
        return res.status(404).json({ error: "User not found" });
      }
      
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Reactivate user (company_admin or system_admin)
  app.post("/api/company/users/:userId/reactivate", authenticateToken, requireRole(['company_admin', 'system_admin']), async (req: AuthRequest, res) => {
    try {
      const companyId = req.user?.companyId;
      const userRole = req.user?.role;
      
      if (!companyId && userRole !== 'system_admin') {
        return res.status(400).json({ error: "No company associated with this account" });
      }
      
      const targetUserId = parseInt(req.params.userId, 10);
      if (isNaN(targetUserId)) {
        return res.status(400).json({ error: "Invalid user ID" });
      }
      
      const success = await storage.reactivateUser(targetUserId, companyId!);
      if (!success) {
        return res.status(404).json({ error: "User not found" });
      }
      
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Delete user permanently (company_admin or system_admin)
  app.delete("/api/company/users/:userId", authenticateToken, requireRole(['company_admin', 'system_admin']), async (req: AuthRequest, res) => {
    try {
      const companyId = req.user?.companyId;
      const currentUserId = req.user?.userId;
      const userRole = req.user?.role;
      
      if (!companyId && userRole !== 'system_admin') {
        return res.status(400).json({ error: "No company associated with this account" });
      }
      
      const targetUserId = parseInt(req.params.userId, 10);
      if (isNaN(targetUserId)) {
        return res.status(400).json({ error: "Invalid user ID" });
      }
      
      // Prevent user from deleting themselves
      if (targetUserId === currentUserId) {
        return res.status(400).json({ error: "Cannot delete your own account" });
      }
      
      const success = await storage.deleteUser(targetUserId, companyId!);
      if (!success) {
        return res.status(404).json({ error: "User not found" });
      }
      
      res.json({ success: true, message: "User permanently deleted" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Accept invitation (public route - no auth required)
  const acceptInviteSchema = z.object({
    inviteCode: z.string().min(1),
    password: z.string().min(8),
    name: z.string().min(1),
  });

  app.post("/api/invites/accept", async (req, res) => {
    try {
      const { inviteCode, password, name } = acceptInviteSchema.parse(req.body);
      
      // Get the invite
      const invite = await storage.getInviteByCode(inviteCode);
      if (!invite) {
        return res.status(404).json({ error: "Invitation not found" });
      }
      
      // Check if already accepted
      if (invite.status !== 'pending') {
        return res.status(400).json({ error: "This invitation has already been used or revoked" });
      }
      
      // Check if expired
      if (new Date() > invite.expiresAt) {
        return res.status(400).json({ error: "This invitation has expired" });
      }
      
      // Check if user already exists
      const [existingUser] = await db
        .select()
        .from(users)
        .where(eq(users.email, invite.email.toLowerCase()))
        .limit(1);
        
      if (existingUser) {
        return res.status(400).json({ error: "A user with this email already exists" });
      }
      
      // Create the user with company and role from invite
      const passwordHash = await hashPassword(password);
      const [newUser] = await db
        .insert(users)
        .values({
          email: invite.email.toLowerCase(),
          passwordHash,
          name,
          role: invite.role,
          companyId: invite.companyId,
        })
        .returning();
      
      // Mark invite as accepted
      await storage.acceptInvite(inviteCode);
      
      // Generate tokens for immediate login
      const accessToken = generateAccessToken({
        userId: newUser.id,
        email: newUser.email,
        role: newUser.role,
        companyId: newUser.companyId,
      });
      
      res.status(201).json({ 
        message: "Account created successfully",
        user: { 
          id: newUser.id, 
          email: newUser.email, 
          name: newUser.name, 
          role: newUser.role,
          companyId: newUser.companyId,
          onboardingStatus: newUser.onboardingStatus,
        },
        accessToken,
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid input', details: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  });

  // Get invite details by code (public - for accept page)
  app.get("/api/invites/:code", async (req, res) => {
    try {
      const invite = await storage.getInviteByCode(req.params.code);
      if (!invite) {
        return res.status(404).json({ error: "Invitation not found" });
      }
      
      // Get company name
      const company = await storage.getCompany(invite.companyId);
      
      res.json({ 
        invite: {
          email: invite.email,
          role: invite.role,
          status: invite.status,
          expiresAt: invite.expiresAt,
          companyName: company?.name || 'Unknown Company',
        }
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ==================== ONBOARDING ROUTES ====================

  // Get onboarding status
  app.get("/api/onboarding/status", authenticateToken, async (req: AuthRequest, res) => {
    try {
      if (!req.user?.userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const status = await storage.getUserOnboardingStatus(req.user.userId);
      if (!status) {
        return res.status(404).json({ error: "User not found" });
      }

      res.json(status);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Complete onboarding with branding profile
  app.post("/api/onboarding", authenticateToken, async (req: AuthRequest, res) => {
    try {
      if (!req.user?.userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const brandingSchema = z.object({
        companyName: z.string().min(2, "Company name must be at least 2 characters").max(100),
        tagline: z.string().max(200).optional().or(z.literal("")),
        websiteUrl: z.union([z.string().url(), z.literal("")]).optional(),
        primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Invalid hex color"),
        logoUrl: z.string().refine((val) => val === "" || val.startsWith("/") || /^https?:\/\//.test(val), "Invalid logo URL or path").optional().or(z.literal("")),
        aboutUs: z.string().max(1000).optional(),
        contactName: z.string().max(100).optional().or(z.literal("")),
        contactTitle: z.string().max(100).optional().or(z.literal("")),
        contactPhone: z.string().max(50).optional().or(z.literal("")),
        contactEmail: z.union([z.string().email(), z.literal("")]).optional(),
        streetAddress: z.string().max(200).optional().or(z.literal("")),
        city: z.string().max(100).optional().or(z.literal("")),
        state: z.string().max(50).optional().or(z.literal("")),
        zip: z.string().max(20).optional().or(z.literal("")),
        licenseNumber: z.string().max(50).optional().or(z.literal("")),
      });

      const validatedData = brandingSchema.parse(req.body);

      const user = await storage.completeOnboarding(req.user.userId, {
        companyName: validatedData.companyName,
        tagline: validatedData.tagline || undefined,
        websiteUrl: validatedData.websiteUrl || undefined,
        primaryColor: validatedData.primaryColor,
        logoUrl: validatedData.logoUrl || undefined,
        aboutUs: validatedData.aboutUs || undefined,
        contactName: validatedData.contactName || undefined,
        contactTitle: validatedData.contactTitle || undefined,
        contactPhone: validatedData.contactPhone || undefined,
        contactEmail: validatedData.contactEmail || undefined,
        streetAddress: validatedData.streetAddress || undefined,
        city: validatedData.city || undefined,
        state: validatedData.state || undefined,
        zip: validatedData.zip || undefined,
        licenseNumber: validatedData.licenseNumber || undefined,
      });

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      res.json({ 
        success: true, 
        message: "Onboarding completed successfully",
        onboardingStatus: user.onboardingStatus,
        brandingProfile: user.brandingProfile
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  });

  // Update branding profile (for existing users)
  app.patch("/api/branding", authenticateToken, async (req: AuthRequest, res) => {
    try {
      if (!req.user?.userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const brandingSchema = z.object({
        companyName: z.string().min(2, "Company name must be at least 2 characters").max(100),
        tagline: z.string().max(200).optional().or(z.literal("")),
        websiteUrl: z.union([z.string().url(), z.literal("")]).optional(),
        primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Invalid hex color"),
        logoUrl: z.string().optional().or(z.literal("")),
        aboutUs: z.string().max(1000).optional(),
        contactName: z.string().max(100).optional().or(z.literal("")),
        contactTitle: z.string().max(100).optional().or(z.literal("")),
        contactPhone: z.string().max(50).optional().or(z.literal("")),
        contactEmail: z.union([z.string().email(), z.literal("")]).optional(),
        streetAddress: z.string().max(200).optional().or(z.literal("")),
        city: z.string().max(100).optional().or(z.literal("")),
        state: z.string().max(50).optional().or(z.literal("")),
        zip: z.string().max(20).optional().or(z.literal("")),
        licenseNumber: z.string().max(50).optional().or(z.literal("")),
      });

      const validatedData = brandingSchema.parse(req.body);

      const user = await storage.completeOnboarding(req.user.userId, {
        companyName: validatedData.companyName,
        tagline: validatedData.tagline || undefined,
        websiteUrl: validatedData.websiteUrl || undefined,
        primaryColor: validatedData.primaryColor,
        logoUrl: validatedData.logoUrl || undefined,
        aboutUs: validatedData.aboutUs || undefined,
        contactName: validatedData.contactName || undefined,
        contactTitle: validatedData.contactTitle || undefined,
        contactPhone: validatedData.contactPhone || undefined,
        contactEmail: validatedData.contactEmail || undefined,
        streetAddress: validatedData.streetAddress || undefined,
        city: validatedData.city || undefined,
        state: validatedData.state || undefined,
        zip: validatedData.zip || undefined,
        licenseNumber: validatedData.licenseNumber || undefined,
      });

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      res.json({ 
        success: true, 
        message: "Branding updated successfully",
        brandingProfile: user.brandingProfile
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  });

  // Get current branding profile
  app.get("/api/branding", authenticateToken, async (req: AuthRequest, res) => {
    try {
      if (!req.user?.userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const status = await storage.getUserOnboardingStatus(req.user.userId);
      if (!status) {
        return res.status(404).json({ error: "User not found" });
      }

      res.json({ brandingProfile: status.brandingProfile || {} });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });


  // ==================== AI INSTRUCTIONS ====================

  // Get all AI instructions for company
  app.get("/api/ai-instructions", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const companyId = req.user?.companyId;
      if (!companyId) {
        return res.status(403).json({ error: "Company context required" });
      }

      let instructions = await storage.getAIInstructions(companyId);
      
      // If no instructions exist, create default ones
      if (instructions.length === 0) {
        const defaultInstructions = [
          {
            companyId,
            name: "Standard Bid Response",
            instructions: `IMPORTANT: Generate a bid response using ONLY the following data sources. Do NOT invent, assume, or hallucinate any information:

DATA SOURCES (Use ONLY these):
- Uploaded RFP/RFQ documents (project requirements, scope, specifications)
- Company profile information (name, certifications, experience, capabilities)
- Project details (name, client, location, dates)
- Historical bid data from similar past projects (if available)

STRICT RULES:
- Extract ALL requirements directly from the uploaded documents
- Use ONLY company information provided in the system
- If specific data is missing, mark it as [TO BE PROVIDED] - do NOT make up values
- Reference actual document content when addressing requirements
- Do NOT invent project timelines, costs, or specifications not in the source documents

BID STRUCTURE:
1. Executive Summary - Based on actual project scope from RFP
2. Company Qualifications - Use only verified company data
3. Technical Approach - Address specific RFP requirements
4. Project Timeline - Based on RFP timeline or mark [TO BE PROVIDED]
5. Safety & Quality Plans - Use company's actual certifications
6. Pricing - Based on RFP requirements or mark [TO BE PROVIDED]
7. Compliance Matrix - Map each RFP requirement to our response

Ensure every claim is traceable to source documents or company data.`,
            isDefault: true
          },
          {
            companyId,
            name: "Executive Summary Only",
            instructions: `Generate a concise executive summary for the bid proposal. Focus on:

1. Project Understanding - Demonstrate clear understanding of client needs from RFP
2. Key Value Proposition - Why we are the best choice
3. Relevant Experience - Brief mention of similar projects
4. Commitment - Our dedication to quality and timeline

Keep it to 1-2 pages maximum. Use professional tone.
Do NOT include pricing or detailed technical specifications.
Mark any missing information as [TO BE PROVIDED].`,
            isDefault: false
          }
        ];

        for (const instr of defaultInstructions) {
          await storage.createAIInstruction(instr);
        }
        
        instructions = await storage.getAIInstructions(companyId);
      }

      res.json({ instructions });
    } catch (error: any) {
      console.error('Error fetching AI instructions:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Create AI instruction
  app.post("/api/ai-instructions", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const companyId = req.user?.companyId;
      if (!companyId) {
        return res.status(403).json({ error: "Company context required" });
      }

      const { name, instructions, isDefault } = req.body;
      
      if (!name || !instructions) {
        return res.status(400).json({ error: "Name and instructions are required" });
      }

      const instruction = await storage.createAIInstruction({
        companyId,
        name,
        instructions,
        isDefault: isDefault || false
      });

      res.status(201).json({ instruction });
    } catch (error: any) {
      console.error('Error creating AI instruction:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Update AI instruction
  app.patch("/api/ai-instructions/:id", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const companyId = req.user?.companyId;
      if (!companyId) {
        return res.status(403).json({ error: "Company context required" });
      }

      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid instruction ID" });
      }

      const { name, instructions } = req.body;
      
      const instruction = await storage.updateAIInstruction(id, companyId, {
        name,
        instructions
      });

      if (!instruction) {
        return res.status(404).json({ error: "Instruction not found" });
      }

      res.json({ instruction });
    } catch (error: any) {
      console.error('Error updating AI instruction:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Delete AI instruction
  app.delete("/api/ai-instructions/:id", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const companyId = req.user?.companyId;
      if (!companyId) {
        return res.status(403).json({ error: "Company context required" });
      }

      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid instruction ID" });
      }

      // Check if this is the last instruction
      const allInstructions = await storage.getAIInstructions(companyId);
      if (allInstructions.length <= 1) {
        return res.status(400).json({ error: "Cannot delete the last instruction. At least one instruction must exist." });
      }

      const deleted = await storage.deleteAIInstruction(id, companyId);
      if (!deleted) {
        return res.status(404).json({ error: "Instruction not found" });
      }

      res.json({ success: true });
    } catch (error: any) {
      console.error('Error deleting AI instruction:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ==================== KNOWLEDGE BASE ====================

  // Get all knowledge base documents for company
  app.get("/api/knowledge-base", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const companyId = req.user?.companyId;
      if (!companyId) {
        return res.status(403).json({ error: "Company context required" });
      }

      const documents = await storage.getKnowledgeBaseDocuments(companyId);
      res.json({ documents });
    } catch (error: any) {
      console.error('Error fetching knowledge base documents:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Upload knowledge base document
  app.post("/api/knowledge-base/upload", authenticateToken, upload.single('file'), async (req: AuthRequest, res) => {
    try {
      const companyId = req.user?.companyId;
      if (!companyId) {
        return res.status(403).json({ error: "Company context required" });
      }

      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const allowedMimeTypes = [
        'text/csv',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/pdf',
        'text/plain',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel'
      ];

      if (!allowedMimeTypes.includes(req.file.mimetype)) {
        return res.status(400).json({ error: "File type not supported. Use CSV, DOCX, PDF, TXT, or Excel files." });
      }

      if (req.file.size > 10 * 1024 * 1024) {
        return res.status(400).json({ error: "File too large. Maximum size is 10MB." });
      }

      // Determine file type
      const extension = req.file.originalname.split('.').pop()?.toLowerCase() || 'unknown';
      const fileTypeMap: Record<string, string> = {
        'csv': 'csv',
        'docx': 'docx',
        'pdf': 'pdf',
        'txt': 'txt',
        'xlsx': 'xlsx',
        'xls': 'xlsx'
      };
      const fileType = fileTypeMap[extension] || 'unknown';

      // Save file to disk
      const filename = `kb_${companyId}_${Date.now()}.${extension}`;
      const filepath = `uploads/knowledge-base/${filename}`;
      
      const fs = await import('fs/promises');
      const path = await import('path');
      
      const uploadsDir = path.join(process.cwd(), 'uploads', 'knowledge-base');
      await fs.mkdir(uploadsDir, { recursive: true });
      await fs.writeFile(path.join(uploadsDir, filename), req.file.buffer);

      // Create document record
      const document = await storage.createKnowledgeBaseDocument({
        companyId,
        filename,
        originalName: req.file.originalname,
        fileType,
        fileSize: req.file.size,
        content: null,
        isProcessed: false,
        chunkCount: 0
      });

      // Process document asynchronously (extract text and create embeddings)
      // Fire and forget - don't block the response
      setImmediate(async () => {
        try {
          await processKnowledgeBaseDocument(document.id, companyId, filepath, fileType);
        } catch (err) {
          console.error('Error processing knowledge base document:', err);
          // Mark document as processed with 0 chunks if processing fails
          await storage.updateKnowledgeBaseDocument(document.id, companyId, {
            isProcessed: true,
            chunkCount: 0,
            content: `[Processing failed: ${err instanceof Error ? err.message : 'Unknown error'}]`
          });
        }
      });

      res.status(202).json({ document, message: 'Document uploaded, processing in background' });
    } catch (error: any) {
      console.error('Error uploading knowledge base document:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Delete knowledge base document
  app.delete("/api/knowledge-base/:id", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const companyId = req.user?.companyId;
      if (!companyId) {
        return res.status(403).json({ error: "Company context required" });
      }

      const docId = parseInt(req.params.id, 10);
      if (isNaN(docId)) {
        return res.status(400).json({ error: "Invalid document ID" });
      }

      // Get document to find file path
      const doc = await storage.getKnowledgeBaseDocument(docId, companyId);
      if (!doc) {
        return res.status(404).json({ error: "Document not found" });
      }

      // Delete file from disk
      try {
        const fs = await import('fs/promises');
        const path = await import('path');
        const filepath = path.join(process.cwd(), 'uploads', 'knowledge-base', doc.filename);
        await fs.unlink(filepath);
      } catch (e) {
        console.warn('Could not delete file from disk:', e);
      }

      // Delete from database (cascades to chunks)
      const deleted = await storage.deleteKnowledgeBaseDocument(docId, companyId);
      if (!deleted) {
        return res.status(404).json({ error: "Document not found" });
      }

      res.json({ success: true });
    } catch (error: any) {
      console.error('Error deleting knowledge base document:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ==================== TEMPLATES API ====================
  
  // List templates
  app.get("/api/templates", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const companyId = req.user?.companyId;
      if (!companyId) {
        return res.status(403).json({ error: "Company context required" });
      }
      const templates = await storage.getTemplates(companyId);
      res.json(templates);
    } catch (error: any) {
      console.error('Error listing templates:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get single template
  app.get("/api/templates/:id", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const companyId = req.user?.companyId;
      if (!companyId) {
        return res.status(403).json({ error: "Company context required" });
      }
      const templateId = parseInt(req.params.id, 10);
      if (isNaN(templateId)) {
        return res.status(400).json({ error: "Invalid template ID" });
      }
      const template = await storage.getTemplate(templateId, companyId);
      if (!template) {
        return res.status(404).json({ error: "Template not found" });
      }
      res.json(template);
    } catch (error: any) {
      console.error('Error getting template:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Create template
  app.post("/api/templates", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const companyId = req.user?.companyId;
      if (!companyId) {
        return res.status(403).json({ error: "Company context required" });
      }
      const { name, description, category, sections } = req.body;
      if (!name || !category) {
        return res.status(400).json({ error: "Name and category are required" });
      }
      const template = await storage.createTemplate({
        companyId,
        name,
        description: description || '',
        category,
        sections: sections || []
      });
      res.status(201).json(template);
    } catch (error: any) {
      console.error('Error creating template:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Update template
  app.put("/api/templates/:id", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const companyId = req.user?.companyId;
      if (!companyId) {
        return res.status(403).json({ error: "Company context required" });
      }
      const templateId = parseInt(req.params.id, 10);
      if (isNaN(templateId)) {
        return res.status(400).json({ error: "Invalid template ID" });
      }
      const { name, description, category, sections } = req.body;
      const template = await storage.updateTemplate(templateId, companyId, {
        name,
        description,
        category,
        sections
      });
      if (!template) {
        return res.status(404).json({ error: "Template not found" });
      }
      res.json(template);
    } catch (error: any) {
      console.error('Error updating template:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Delete template
  app.delete("/api/templates/:id", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const companyId = req.user?.companyId;
      if (!companyId) {
        return res.status(403).json({ error: "Company context required" });
      }
      const templateId = parseInt(req.params.id, 10);
      if (isNaN(templateId)) {
        return res.status(400).json({ error: "Invalid template ID" });
      }
      const deleted = await storage.deleteTemplate(templateId, companyId);
      if (!deleted) {
        return res.status(404).json({ error: "Template not found" });
      }
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error deleting template:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Template file upload - parse file and extract content for template
  app.post("/api/templates/upload", authenticateToken, upload.single('file'), async (req: AuthRequest, res) => {
    try {
      const companyId = req.user?.companyId;
      if (!companyId) {
        return res.status(403).json({ error: "Company context required" });
      }
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const { name, category, description } = req.body;
      if (!name || !category) {
        return res.status(400).json({ error: "Name and category are required" });
      }

      const buffer = req.file.buffer;
      const filename = req.file.originalname;
      const ext = filename.toLowerCase().split('.').pop() || '';
      
      let content = '';
      
      // Parse file based on type
      if (ext === 'pdf') {
        try {
          const { PDFParse } = await import('pdf-parse');
          const parser = new PDFParse({ data: buffer });
          const textResult = await parser.getText();
          content = typeof textResult === 'string' ? textResult : (textResult as any).text || String(textResult);
        } catch (e) {
          content = '[PDF content could not be extracted]';
        }
      } else if (ext === 'docx') {
        const mammoth = await import('mammoth');
        const result = await mammoth.extractRawText({ buffer });
        content = result.value || '';
      } else if (ext === 'html' || ext === 'htm') {
        content = buffer.toString('utf-8');
      } else if (ext === 'txt' || ext === 'csv') {
        content = buffer.toString('utf-8');
      } else if (ext === 'pptx') {
        const AdmZip = (await import('adm-zip')).default;
        const zip = new AdmZip(buffer);
        const entries = zip.getEntries();
        const textParts: string[] = [];
        for (const entry of entries) {
          if (entry.entryName.startsWith('ppt/slides/slide') && entry.entryName.endsWith('.xml')) {
            const xmlContent = entry.getData().toString('utf-8');
            const textMatches = xmlContent.match(/<a:t>([^<]*)<\/a:t>/g);
            if (textMatches) {
              textParts.push(textMatches.map(m => m.replace(/<\/?a:t>/g, '')).join(' '));
            }
          }
        }
        content = textParts.join('\n\n');
      } else {
        content = buffer.toString('utf-8');
      }

      const template = await storage.createTemplate({
        companyId,
        name,
        description: description || `Imported from ${filename}`,
        category,
        sections: [{ title: 'Imported Content', content: content.trim() }]
      });

      res.status(201).json(template);
    } catch (error: any) {
      console.error('Error uploading template file:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Upload company logo
  app.post("/api/upload/logo", authenticateToken, upload.single('file'), async (req: AuthRequest, res) => {
    try {
      if (!req.user?.userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
      if (!allowedTypes.includes(req.file.mimetype)) {
        return res.status(400).json({ error: "Invalid file type. Please upload an image (JPEG, PNG, GIF, WebP, or SVG)" });
      }

      if (req.file.size > 5 * 1024 * 1024) {
        return res.status(400).json({ error: "File too large. Maximum size is 5MB" });
      }

      const filename = `logo_${req.user.userId}_${Date.now()}.${req.file.originalname.split('.').pop()}`;
      const filepath = `uploads/logos/${filename}`;
      
      const fs = await import('fs/promises');
      const path = await import('path');
      
      const uploadsDir = path.join(process.cwd(), 'uploads', 'logos');
      await fs.mkdir(uploadsDir, { recursive: true });
      
      await fs.writeFile(path.join(uploadsDir, filename), req.file.buffer);
      
      const url = `/${filepath}`;
      
      res.json({ url, filename });
    } catch (error: any) {
      console.error('Logo upload error:', error);
      res.status(500).json({ error: "Failed to upload logo" });
    }
  });

  return httpServer;
}
