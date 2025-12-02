import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertProjectSchema, insertDocumentSchema } from "@shared/schema";
import { generateEmbedding, generateBidContent, refineBidContent } from "./lib/openai";
import { generateBidWithAnthropic, refineBidWithAnthropic } from "./lib/anthropic";
import { generateBidWithGemini, refineBidWithGemini } from "./lib/gemini";
import { generateBidWithDeepSeek, refineBidWithDeepSeek } from "./lib/deepseek";
import { ingestionService } from "./lib/ingestion";
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

  return httpServer;
}
