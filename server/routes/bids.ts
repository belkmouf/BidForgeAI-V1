import { Router } from 'express';
import { z } from 'zod';
import { storage } from '../storage';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { refineBidContent } from '../lib/openai';
import { refineBidWithAnthropic } from '../lib/anthropic';
import { refineBidWithGemini } from '../lib/gemini';
import { refineBidWithDeepSeek } from '../lib/deepseek';
import { refineBidWithGrok } from '../lib/grok';
import { 
  sanitizeInstructions, 
  sanitizeTone, 
  sanitizeFeedback,
  InputSanitizationError 
} from '../lib/sanitize';
import { calculateLMMCost } from '../lib/pricing';
import { sanitizeModelHtml } from '../lib/ai-output';
import { bidGenerationService } from '../lib/bid-generation-service';

const router = Router();

// Schemas
const modelEnum = z.enum(['anthropic', 'gemini', 'deepseek', 'openai', 'grok']);

const generateBidSchema = z.object({
  instructions: z.string().min(1),
  tone: z.string().optional().default('professional'),
  model: modelEnum.optional().default('deepseek'),
  models: z.array(modelEnum).optional(),
});

const refineBidSchema = z.object({
  currentHtml: z.string().min(1),
  feedback: z.string().min(1),
  model: z.enum(['anthropic', 'gemini', 'deepseek', 'openai', 'grok']).optional().default('deepseek'),
});

// Types
interface AIGenerationResult {
  content: string;
  inputTokens: number;
  outputTokens: number;
}

// Generate a bid using RAG (requires authentication + AI input sanitization, company-scoped)
// Supports multi-model comparison when 'models' array is provided
// OPTIMIZED: Uses unified bid generation service with caching and parallel execution
router.post("/projects/:id/generate", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { instructions, tone, model, models } = generateBidSchema.parse(req.body);
    const projectId = req.params.id;
    const companyId = req.user?.companyId ?? null;

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

    // Use unified bid generation service
    if (models && models.length > 1) {
      // Multi-model comparison
      const result = await bidGenerationService.generateBidComparison(
        {
          projectId,
          companyId,
          userId: req.user?.userId ?? null,
          instructions: sanitizedInstructions,
          tone: sanitizedTone,
          models,
        },
        {
          saveToDatabase: true,
          useCache: true,
        }
      );
      res.json(result);
    } else {
      // Single model generation
      const result = await bidGenerationService.generateBid(
        {
          projectId,
          companyId,
          userId: req.user?.userId ?? null,
          instructions: sanitizedInstructions,
          tone: sanitizedTone,
          model: models?.[0] || model,
        },
        {
          saveToDatabase: true,
          useCache: true,
        }
      );
      
      // Get the saved bid if it was saved
      const savedBid = result.bidId ? await storage.getBid(result.bidId, companyId) : null;
      
      res.json({
        bid: savedBid,
        html: result.html,
        rawContent: result.rawContent,
        chunksUsed: result.chunksUsed,
        model: result.model,
        searchMethod: result.searchMethod,
        tokenUsage: result.tokenUsage,
      });
    }
  } catch (error: any) {
    console.error('Generation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all bids for a project (requires authentication, company-scoped)
router.get("/projects/:id/bids", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const projectId = req.params.id;
    const companyId = req.user?.companyId ?? null;

    // Verify project exists and belongs to this company
    const project = await storage.getProject(projectId, companyId);
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    const bidsList = await storage.listBidsByProject(projectId, companyId);
    res.json({ bids: bidsList });
  } catch (error: any) {
    console.error('Error fetching bids:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get the latest bid for a project (requires authentication, company-scoped)
router.get("/projects/:id/bids/latest", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const projectId = req.params.id;
    const companyId = req.user?.companyId ?? null;

    // Verify project exists and belongs to this company
    const project = await storage.getProject(projectId, companyId);
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    const latestBid = await storage.getLatestBidForProject(projectId, companyId);
    if (!latestBid) {
      return res.status(404).json({ error: "No bids found for this project" });
    }

    res.json({ bid: latestBid });
  } catch (error: any) {
    console.error('Error fetching latest bid:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get a specific bid by ID (requires authentication, company-scoped)
router.get("/bids/:bidId", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const bidId = parseInt(req.params.bidId, 10);
    const companyId = req.user?.companyId ?? null;

    if (isNaN(bidId)) {
      return res.status(400).json({ error: "Invalid bid ID" });
    }

    const bid = await storage.getBid(bidId, companyId);
    if (!bid) {
      return res.status(404).json({ error: "Bid not found" });
    }

    res.json({ bid });
  } catch (error: any) {
    console.error('Error fetching bid:', error);
    res.status(500).json({ error: error.message });
  }
});

// Refine an existing bid (requires authentication + AI input sanitization)
router.post("/projects/:id/refine", authenticateToken, async (req: AuthRequest, res) => {
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
    let result: AIGenerationResult;
    switch (model) {
      case 'anthropic':
        result = await refineBidWithAnthropic({ currentHtml, feedback: sanitizedFeedback });
        break;
      case 'gemini':
        result = await refineBidWithGemini({ currentHtml, feedback: sanitizedFeedback });
        break;
      case 'deepseek':
        result = await refineBidWithDeepSeek({ currentHtml, feedback: sanitizedFeedback });
        break;
      case 'grok':
        result = await refineBidWithGrok({ currentHtml, feedback: sanitizedFeedback });
        break;
      case 'openai':
      default:
        result = await refineBidContent({ currentHtml, feedback: sanitizedFeedback });
        break;
    }
    
    // Sanitize AI output to remove any markdown code fences
    const cleanedHtml = sanitizeModelHtml(result.content);
    
    // Calculate real LMM cost
    const lmmCost = calculateLMMCost(model, result.inputTokens, result.outputTokens);

    res.json({ 
      html: cleanedHtml, 
      rawContent: cleanedHtml, 
      model,
      tokenUsage: {
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        lmmCost,
      }
    });
  } catch (error: any) {
    console.error('Refinement error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Generate share token for a bid (requires authentication)
router.post("/bids/:bidId/share", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const bidId = parseInt(req.params.bidId, 10);
    const companyId = req.user?.companyId ?? null;

    if (isNaN(bidId)) {
      return res.status(400).json({ error: "Invalid bid ID" });
    }

    const result = await storage.generateShareToken(bidId, companyId);
    if (!result) {
      return res.status(404).json({ error: "Bid not found" });
    }

    const shareUrl = `/share/${result.shareToken}`;
    res.json({ shareUrl, shareToken: result.shareToken });
  } catch (error: any) {
    console.error('Error generating share token:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get public bid by share token (NO authentication required)
router.get("/public/bids/:token", async (req, res) => {
  try {
    const token = req.params.token;
    
    if (!token || token.length !== 64) {
      return res.status(400).json({ error: "Invalid share token" });
    }

    const result = await storage.getBidByShareToken(token);
    if (!result) {
      return res.status(404).json({ error: "Bid not found or share link has expired" });
    }

    const { shareToken, ...safeBid } = result.bid;
    res.json({ 
      bid: safeBid, 
      projectName: result.project.name,
      clientName: result.project.clientName
    });
  } catch (error: any) {
    console.error('Error fetching public bid:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;

