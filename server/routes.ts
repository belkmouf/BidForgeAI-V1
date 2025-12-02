import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertProjectSchema, insertDocumentSchema } from "@shared/schema";
import { generateEmbedding, generateBidContent, refineBidContent } from "./lib/openai";
import { generateBidWithAnthropic, refineBidWithAnthropic } from "./lib/anthropic";
import { generateBidWithGemini, refineBidWithGemini } from "./lib/gemini";
import { generateBidWithDeepSeek, refineBidWithDeepSeek } from "./lib/deepseek";
import { ingestionService } from "./lib/ingestion";
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
const generateBidSchema = z.object({
  instructions: z.string().min(1),
  tone: z.string().optional().default('professional'),
  model: z.enum(['openai', 'anthropic', 'gemini', 'deepseek']).optional().default('openai'),
});

const refineBidSchema = z.object({
  currentHtml: z.string().min(1),
  feedback: z.string().min(1),
  model: z.enum(['openai', 'anthropic', 'gemini', 'deepseek']).optional().default('openai'),
});

const updateStatusSchema = z.object({
  status: z.enum(["Active", "Submitted", "Closed-Won", "Closed-Lost"]),
});

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // ==================== PROJECTS ====================
  
  // Create a new project
  app.post("/api/projects", async (req, res) => {
    try {
      const data = insertProjectSchema.parse(req.body);
      const project = await storage.createProject(data);
      res.json(project);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // List all projects
  app.get("/api/projects", async (req, res) => {
    try {
      const projects = await storage.listProjects();
      res.json(projects);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get a specific project
  app.get("/api/projects/:id", async (req, res) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      res.json(project);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Update project status
  app.patch("/api/projects/:id/status", async (req, res) => {
    try {
      const { status } = updateStatusSchema.parse(req.body);
      const project = await storage.updateProjectStatus(req.params.id, status);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      res.json(project);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // ==================== DOCUMENTS ====================

  // Upload a document to a project with recursive file processing
  app.post("/api/projects/:id/upload", upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const projectId = req.params.id;
      
      // Verify project exists
      const project = await storage.getProject(projectId);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }

      // Validate file type
      const allowedExtensions = ['.pdf', '.msg', '.zip', '.txt', '.doc', '.docx'];
      const fileExt = req.file.originalname.toLowerCase().match(/\.[^.]*$/)?.[0] || '';
      
      if (!allowedExtensions.includes(fileExt)) {
        return res.status(400).json({ 
          error: `Unsupported file type. Allowed: ${allowedExtensions.join(', ')}` 
        });
      }

      // Process file with recursive extraction (ZIP→MSG→PDF chains)
      const processedFiles = await ingestionService.processFile(
        req.file.buffer,
        req.file.originalname,
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

  // List documents for a project
  app.get("/api/projects/:id/documents", async (req, res) => {
    try {
      const documents = await storage.listDocumentsByProject(req.params.id);
      res.json(documents);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ==================== BID GENERATION ====================

  // Generate a bid using RAG
  app.post("/api/projects/:id/generate", async (req, res) => {
    try {
      const { instructions, tone, model } = generateBidSchema.parse(req.body);
      const projectId = req.params.id;

      // Verify project exists
      const project = await storage.getProject(projectId);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }

      // Generate embedding for the instructions (always use OpenAI for embeddings)
      const queryEmbedding = await generateEmbedding(instructions);

      // Retrieve similar chunks using RAG
      const similarChunks = await storage.searchSimilarChunks(queryEmbedding, projectId, 10);

      // Build context from retrieved chunks
      const context = similarChunks
        .map((chunk, i) => `[Chunk ${i + 1}]: ${chunk.content}`)
        .join('\n\n');

      const contextOrDefault = context || 'No relevant context found from previous documents.';

      // Generate bid content using selected model
      let html: string;
      switch (model) {
        case 'anthropic':
          html = await generateBidWithAnthropic({ instructions, context: contextOrDefault, tone });
          break;
        case 'gemini':
          html = await generateBidWithGemini({ instructions, context: contextOrDefault, tone });
          break;
        case 'deepseek':
          html = await generateBidWithDeepSeek({ instructions, context: contextOrDefault, tone });
          break;
        case 'openai':
        default:
          html = await generateBidContent({ instructions, context: contextOrDefault, tone });
          break;
      }

      res.json({
        html,
        chunksUsed: similarChunks.length,
        model,
      });
    } catch (error: any) {
      console.error('Generation error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Refine an existing bid
  app.post("/api/projects/:id/refine", async (req, res) => {
    try {
      const { currentHtml, feedback, model } = refineBidSchema.parse(req.body);

      // Refine using selected model
      let html: string;
      switch (model) {
        case 'anthropic':
          html = await refineBidWithAnthropic({ currentHtml, feedback });
          break;
        case 'gemini':
          html = await refineBidWithGemini({ currentHtml, feedback });
          break;
        case 'deepseek':
          html = await refineBidWithDeepSeek({ currentHtml, feedback });
          break;
        case 'openai':
        default:
          html = await refineBidContent({ currentHtml, feedback });
          break;
      }

      res.json({ html, model });
    } catch (error: any) {
      console.error('Refinement error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ==================== DASHBOARD ====================

  // Get dashboard statistics
  app.get("/api/dashboard/stats", async (req, res) => {
    try {
      const stats = await storage.getDashboardStats();
      res.json(stats);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
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

  app.post("/api/whatsapp/send", async (req, res) => {
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

  app.post("/api/whatsapp/send-document", async (req, res) => {
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

  app.post("/api/whatsapp/send-template", async (req, res) => {
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

  return httpServer;
}
