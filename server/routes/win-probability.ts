import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { winProbabilityService } from '../lib/win-probability';
import { featureEngineeringService } from '../lib/feature-engineering';
import { insertBidOutcomeSchema } from '@shared/schema';

const router = Router();

router.post('/predict/:projectId', async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;

    if (!projectId) {
      return res.status(400).json({ error: 'Project ID is required' });
    }

    const result = await winProbabilityService.predict(projectId);

    res.json({
      success: true,
      prediction: result,
    });
  } catch (error) {
    console.error('[WinProbability] Prediction error:', error);
    res.status(500).json({ 
      error: 'Failed to generate win probability prediction',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.get('/prediction/:projectId', async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;

    const prediction = await winProbabilityService.getLatestPrediction(projectId);

    if (!prediction) {
      return res.status(404).json({ 
        error: 'No prediction found for this project',
        message: 'Run a prediction first using POST /api/win-probability/predict/:projectId'
      });
    }

    res.json({
      success: true,
      prediction,
    });
  } catch (error) {
    console.error('[WinProbability] Get prediction error:', error);
    res.status(500).json({ 
      error: 'Failed to retrieve prediction',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.get('/history/:projectId', async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;

    const history = await winProbabilityService.getPredictionHistory(projectId);

    res.json({
      success: true,
      history,
      count: history.length,
    });
  } catch (error) {
    console.error('[WinProbability] Get history error:', error);
    res.status(500).json({ 
      error: 'Failed to retrieve prediction history',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.get('/features/:projectId', async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;

    const result = await featureEngineeringService.extractFeatures(projectId);

    res.json({
      success: true,
      features: result.features,
      metadata: result.metadata,
    });
  } catch (error) {
    console.error('[WinProbability] Feature extraction error:', error);
    res.status(500).json({ 
      error: 'Failed to extract features',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.get('/feature-importance', async (req: Request, res: Response) => {
  try {
    const importance = await featureEngineeringService.getFeatureImportance();

    res.json({
      success: true,
      featureImportance: importance,
    });
  } catch (error) {
    console.error('[WinProbability] Feature importance error:', error);
    res.status(500).json({ 
      error: 'Failed to get feature importance',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

const recordOutcomeSchema = insertBidOutcomeSchema.extend({
  userId: z.number().optional(),
});

router.post('/outcome/:projectId', async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    
    const validationResult = recordOutcomeSchema.safeParse({
      projectId,
      ...req.body,
    });

    if (!validationResult.success) {
      return res.status(400).json({ 
        error: 'Invalid request data',
        details: validationResult.error.errors
      });
    }

    const { outcome, bidAmount, winningBidAmount, competitorCount, outcomeFactors, clientFeedback, lessonsLearned, userId } = validationResult.data;

    await winProbabilityService.recordOutcome(
      projectId,
      outcome as 'won' | 'lost' | 'no_bid',
      {
        bidAmount,
        winningBidAmount,
        competitorCount,
        outcomeFactors,
        clientFeedback,
        lessonsLearned,
      },
      userId
    );

    res.json({
      success: true,
      message: 'Outcome recorded successfully',
    });
  } catch (error) {
    console.error('[WinProbability] Record outcome error:', error);
    res.status(500).json({ 
      error: 'Failed to record outcome',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.get('/metrics', async (req: Request, res: Response) => {
  try {
    const metrics = await winProbabilityService.getModelMetrics();

    res.json({
      success: true,
      metrics,
    });
  } catch (error) {
    console.error('[WinProbability] Get metrics error:', error);
    res.status(500).json({ 
      error: 'Failed to get model metrics',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.get('/stats', async (req: Request, res: Response) => {
  try {
    const stats = await winProbabilityService.getAggregateStats();

    res.json({
      success: true,
      stats,
    });
  } catch (error) {
    console.error('[WinProbability] Get stats error:', error);
    res.status(500).json({ 
      error: 'Failed to get aggregate statistics',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
