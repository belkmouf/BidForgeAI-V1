import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertProjectSchema, insertDocumentSchema } from "@shared/schema";
import { generateEmbedding, generateBidContent, refineBidContent } from "./lib/openai";
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
});

const refineBidSchema = z.object({
  currentHtml: z.string().min(1),
  feedback: z.string().min(1),
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

  // Upload a document to a project
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

      // For now, we'll store basic file info
      // In a full implementation, you'd process PDF/MSG/ZIP files here
      const content = req.file.buffer.toString('utf-8', 0, Math.min(req.file.size, 10000));
      
      const document = await storage.createDocument({
        projectId,
        filename: req.file.originalname,
        content,
        isProcessed: true, // Mark as processed for now
      });

      // Generate embedding for the content (simplified - in production, chunk the content)
      try {
        const embedding = await generateEmbedding(content);
        await storage.createDocumentChunk({
          documentId: document.id,
          content: content.substring(0, 2000), // First 2000 chars
          chunkIndex: 0,
          embedding: embedding as any,
        });
      } catch (embeddingError) {
        console.error('Failed to generate embedding:', embeddingError);
      }

      res.json({
        message: "File uploaded and processed successfully",
        document,
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
      const { instructions, tone } = generateBidSchema.parse(req.body);
      const projectId = req.params.id;

      // Verify project exists
      const project = await storage.getProject(projectId);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }

      // Generate embedding for the instructions
      const queryEmbedding = await generateEmbedding(instructions);

      // Retrieve similar chunks using RAG
      const similarChunks = await storage.searchSimilarChunks(queryEmbedding, projectId, 10);

      // Build context from retrieved chunks
      const context = similarChunks
        .map((chunk, i) => `[Chunk ${i + 1}]: ${chunk.content}`)
        .join('\n\n');

      // Generate bid content using OpenAI
      const html = await generateBidContent({
        instructions,
        context: context || 'No relevant context found from previous documents.',
        tone,
      });

      res.json({
        html,
        chunksUsed: similarChunks.length,
      });
    } catch (error: any) {
      console.error('Generation error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Refine an existing bid
  app.post("/api/projects/:id/refine", async (req, res) => {
    try {
      const { currentHtml, feedback } = refineBidSchema.parse(req.body);

      const html = await refineBidContent({
        currentHtml,
        feedback,
      });

      res.json({ html });
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
