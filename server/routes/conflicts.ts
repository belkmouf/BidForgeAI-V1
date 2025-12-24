import { Router, Response } from 'express';
import { z } from 'zod';
import { conflictDetectionService } from '../lib/conflict-detection';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { requirePermission, PERMISSIONS } from '../middleware/rbac';
import { conflictTypeEnum, conflictSeverityEnum, conflictStatusEnum, updateConflictStatusSchema } from '@shared/schema';
import { storage } from '../storage';

const router = Router();

const runDetectionSchema = z.object({
  detectSemantic: z.boolean().optional().default(true),
  detectNumeric: z.boolean().optional().default(true),
  semanticThreshold: z.number().min(0).max(1).optional().default(0.85),
});

router.post(
  '/:projectId/detect',
  authenticateToken,
  requirePermission(PERMISSIONS.ANALYSIS_RUN),
  async (req: AuthRequest, res: Response) => {
    try {
      const { projectId } = req.params;
      const companyId = req.user?.companyId ?? null;
      
      // Verify project belongs to user's company
      const project = await storage.getProject(projectId, companyId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }
      
      const validatedBody = runDetectionSchema.parse(req.body);

      const result = await conflictDetectionService.runDetection(projectId, {
        detectSemantic: validatedBody.detectSemantic,
        detectNumeric: validatedBody.detectNumeric,
        semanticThreshold: validatedBody.semanticThreshold,
      });

      res.json({
        message: 'Conflict detection completed',
        ...result,
      });
    } catch (error) {
      console.error('[ConflictRoutes] Detection error:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid request body', details: error.errors });
      }
      res.status(500).json({ error: 'Failed to run conflict detection' });
    }
  }
);

router.get(
  '/:projectId',
  authenticateToken,
  requirePermission(PERMISSIONS.ANALYSIS_VIEW),
  async (req: AuthRequest, res: Response) => {
    try {
      const { projectId } = req.params;
      const companyId = req.user?.companyId ?? null;
      
      // Verify project belongs to user's company
      const project = await storage.getProject(projectId, companyId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }
      
      const { type, severity, status } = req.query;

      const filters: {
        type?: z.infer<typeof conflictTypeEnum>;
        severity?: z.infer<typeof conflictSeverityEnum>;
        status?: string;
      } = {};

      if (type && typeof type === 'string') {
        const parsed = conflictTypeEnum.safeParse(type);
        if (parsed.success) filters.type = parsed.data;
      }
      if (severity && typeof severity === 'string') {
        const parsed = conflictSeverityEnum.safeParse(severity);
        if (parsed.success) filters.severity = parsed.data;
      }
      if (status && typeof status === 'string') {
        const parsed = conflictStatusEnum.safeParse(status);
        if (parsed.success) filters.status = parsed.data;
      }

      const conflicts = await conflictDetectionService.getConflicts(projectId, filters);

      res.json({ conflicts, count: conflicts.length });
    } catch (error) {
      console.error('[ConflictRoutes] Get conflicts error:', error);
      res.status(500).json({ error: 'Failed to get conflicts' });
    }
  }
);

router.get(
  '/:projectId/stats',
  authenticateToken,
  requirePermission(PERMISSIONS.ANALYSIS_VIEW),
  async (req: AuthRequest, res: Response) => {
    try {
      const { projectId } = req.params;
      const companyId = req.user?.companyId ?? null;
      
      // Verify project belongs to user's company
      const project = await storage.getProject(projectId, companyId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }
      
      const stats = await conflictDetectionService.getConflictStats(projectId);

      res.json(stats);
    } catch (error) {
      console.error('[ConflictRoutes] Get stats error:', error);
      res.status(500).json({ error: 'Failed to get conflict stats' });
    }
  }
);

router.patch(
  '/:projectId/:conflictId',
  authenticateToken,
  requirePermission(PERMISSIONS.ANALYSIS_RUN),
  async (req: AuthRequest, res: Response) => {
    try {
      const { projectId, conflictId } = req.params;
      const companyId = req.user?.companyId ?? null;
      
      // Verify project belongs to user's company
      const project = await storage.getProject(projectId, companyId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }
      
      const validatedBody = updateConflictStatusSchema.parse(req.body);

      const updated = await conflictDetectionService.updateConflictStatus(
        parseInt(conflictId, 10),
        projectId,
        validatedBody.status,
        req.user?.userId,
        validatedBody.resolution
      );

      if (!updated) {
        return res.status(404).json({ error: 'Conflict not found or does not belong to this project' });
      }

      res.json({ message: 'Conflict updated', conflict: updated });
    } catch (error) {
      console.error('[ConflictRoutes] Update conflict error:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid request body', details: error.errors });
      }
      res.status(500).json({ error: 'Failed to update conflict' });
    }
  }
);

router.post(
  '/:projectId/:conflictId/resolve',
  authenticateToken,
  requirePermission(PERMISSIONS.ANALYSIS_RUN),
  async (req: AuthRequest, res: Response) => {
    try {
      const { projectId, conflictId } = req.params;
      const companyId = req.user?.companyId ?? null;
      
      // Verify project belongs to user's company
      const project = await storage.getProject(projectId, companyId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }
      
      const { resolution } = req.body;

      if (!resolution || typeof resolution !== 'string') {
        return res.status(400).json({ error: 'Resolution text is required' });
      }

      const updated = await conflictDetectionService.updateConflictStatus(
        parseInt(conflictId, 10),
        projectId,
        'resolved',
        req.user?.userId,
        resolution
      );

      if (!updated) {
        return res.status(404).json({ error: 'Conflict not found or does not belong to this project' });
      }

      res.json({ message: 'Conflict resolved', conflict: updated });
    } catch (error) {
      console.error('[ConflictRoutes] Resolve conflict error:', error);
      res.status(500).json({ error: 'Failed to resolve conflict' });
    }
  }
);

router.post(
  '/:projectId/:conflictId/dismiss',
  authenticateToken,
  requirePermission(PERMISSIONS.ANALYSIS_RUN),
  async (req: AuthRequest, res: Response) => {
    try {
      const { projectId, conflictId } = req.params;
      const companyId = req.user?.companyId ?? null;
      
      // Verify project belongs to user's company
      const project = await storage.getProject(projectId, companyId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }
      
      const { reason } = req.body;

      const updated = await conflictDetectionService.updateConflictStatus(
        parseInt(conflictId, 10),
        projectId,
        'dismissed',
        req.user?.userId,
        reason
      );

      if (!updated) {
        return res.status(404).json({ error: 'Conflict not found or does not belong to this project' });
      }

      res.json({ message: 'Conflict dismissed', conflict: updated });
    } catch (error) {
      console.error('[ConflictRoutes] Dismiss conflict error:', error);
      res.status(500).json({ error: 'Failed to dismiss conflict' });
    }
  }
);

const bulkUpdateSchema = z.object({
  conflictIds: z.array(z.number()).min(1),
  status: conflictStatusEnum,
});

router.post(
  '/:projectId/bulk-update',
  authenticateToken,
  requirePermission(PERMISSIONS.ANALYSIS_RUN),
  async (req: AuthRequest, res: Response) => {
    try {
      const { projectId } = req.params;
      const companyId = req.user?.companyId ?? null;
      
      const project = await storage.getProject(projectId, companyId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }
      
      const validatedBody = bulkUpdateSchema.parse(req.body);
      const { conflictIds, status } = validatedBody;

      let updatedCount = 0;
      for (const conflictId of conflictIds) {
        const updated = await conflictDetectionService.updateConflictStatus(
          conflictId,
          projectId,
          status,
          req.user?.userId
        );
        if (updated) updatedCount++;
      }

      res.json({ 
        message: `${updatedCount} conflict(s) updated to ${status}`,
        updatedCount 
      });
    } catch (error) {
      console.error('[ConflictRoutes] Bulk update error:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid request body', details: error.errors });
      }
      res.status(500).json({ error: 'Failed to bulk update conflicts' });
    }
  }
);

export { router as conflictRouter };
