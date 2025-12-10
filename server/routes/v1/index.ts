import { Router } from 'express';
import { VersionedRequest } from '../../middleware/versioning.js';
import authRouter from '../auth.js';
import { authenticateToken } from '../../middleware/auth.js';

const router = Router();

// Health check endpoint for v1
router.get('/health', (req: VersionedRequest, res) => {
  res.json({
    status: 'healthy',
    version: req.apiVersion,
    timestamp: new Date().toISOString(),
    services: {
      database: 'healthy',
      cache: 'healthy', 
      ai_models: 'healthy'
    }
  });
});

// Authentication routes (v1)
router.use('/auth', authRouter);

// Projects routes (v1)
router.get('/projects', authenticateToken, (req: VersionedRequest, res) => {
  // V1 specific implementation
  res.json({
    projects: [],
    message: 'API v1.0.0 - Projects endpoint',
    version: req.apiVersion
  });
});

// Bids routes (v1)  
router.get('/projects/:id/bids', authenticateToken, (req: VersionedRequest, res) => {
  // V1 specific implementation
  res.json({
    bids: [],
    projectId: req.params.id,
    message: 'API v1.0.0 - Bids endpoint', 
    version: req.apiVersion
  });
});

// API documentation endpoint
router.get('/docs', (req: VersionedRequest, res) => {
  res.json({
    version: req.apiVersion,
    documentation: {
      swagger: `/docs/api/v1/swagger.json`,
      postman: `/docs/api/v1/postman-collection.json`,
      online: `/docs/api/v1`,
    },
    endpoints: {
      auth: '/api/v1/auth',
      projects: '/api/v1/projects',
      bids: '/api/v1/projects/:id/bids',
      health: '/api/v1/health'
    },
    deprecation: req.deprecationWarning ? {
      warning: req.deprecationWarning,
      migrationGuide: '/docs/api/migration',
      currentVersion: '1.0.0'
    } : undefined
  });
});

export default router;