import { Router } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { scopeToCompany } from '../middleware/rbac';
import { db } from '../db';
import {
  documents,
  documentMetadata,
  documentChunks,
  projectSummaries,
  rfpAnalyses,
} from '@shared/schema';
import { eq, sql, and } from 'drizzle-orm';
import {
  generateProjectSummary,
  updateProjectSummary,
  getProjectSummaryStats,
  calculateReadinessScore,
  extractEntitiesFromDocument,
} from '../lib/document-analysis';

const router = Router();

/**
 * GET /api/projects/:id/document-summary
 * Get comprehensive document summary for a project
 */
router.get(
  '/projects/:id/document-summary',
  authenticateToken,
  scopeToCompany,
  async (req: AuthRequest, res) => {
    try {
      const { id: projectId } = req.params;
      const companyId = req.user!.companyId;

      // Get all documents with metadata
      const documentsWithMetadata = await db
        .select({
          id: documents.id,
          filename: documents.filename,
          description: documents.description,
          content: documents.content,
          isProcessed: documents.isProcessed,
          uploadedAt: documents.uploadedAt,
          // Metadata
          pageCount: documentMetadata.pageCount,
          fileSize: documentMetadata.fileSize,
          fileType: documentMetadata.fileType,
          keyInformation: documentMetadata.keyInformation,
          extractedEntities: documentMetadata.extractedEntities,
          processingTimeMs: documentMetadata.processingTimeMs,
          processingStatus: documentMetadata.processingStatus,
        })
        .from(documents)
        .leftJoin(documentMetadata, eq(documents.id, documentMetadata.documentId))
        .where(eq(documents.projectId, projectId));

      // Get chunk counts per document
      const chunkCounts = await db
        .select({
          documentId: documentChunks.documentId,
          count: sql<number>`count(*)::int`.as('count'),
        })
        .from(documentChunks)
        .innerJoin(documents, eq(documentChunks.documentId, documents.id))
        .where(eq(documents.projectId, projectId))
        .groupBy(documentChunks.documentId);

      const chunkCountMap = Object.fromEntries(
        chunkCounts.map((c) => [c.documentId, c.count])
      );

      // Enhance documents with chunk counts
      const enhancedDocuments = documentsWithMetadata.map((doc) => ({
        ...doc,
        chunkCount: chunkCountMap[doc.id] || 0,
        status: doc.isProcessed ? 'processed' : 'processing',
      }));

      // Get or generate project summary
      let [summary] = await db
        .select()
        .from(projectSummaries)
        .where(eq(projectSummaries.projectId, projectId))
        .limit(1);

      // If no summary exists and documents are processed, generate one
      if (!summary && enhancedDocuments.every((d) => d.isProcessed)) {
        try {
          summary = await generateProjectSummary(projectId);
        } catch (error) {
          console.error('[DocumentSummary] Failed to generate summary:', error);
          // Continue without summary
        }
      }

      // Get stats
      const stats = await getProjectSummaryStats(projectId);

      // Get readiness score
      const readinessScore = await calculateReadinessScore(projectId);

      // Get analysis data if available
      const [analysis] = await db
        .select()
        .from(rfpAnalyses)
        .where(eq(rfpAnalyses.projectId, projectId))
        .limit(1);

      // Get conflict count (if conflicts table exists)
      // For now, we'll use 0 as placeholder
      const conflictCount = 0;

      // Get win probability (if available from analysis)
      const winProbability = 0; // Placeholder

      res.json({
        stats,
        readinessScore,
        documents: enhancedDocuments,
        projectSummary: summary || null,
        analysis: {
          coverageScore: summary?.coverageScore || 0,
          conflictCount,
          winProbability,
          riskLevel: analysis?.overallRiskLevel || 'Medium',
        },
      });
    } catch (error: any) {
      console.error('[DocumentSummary] Error:', error);
      res.status(500).json({ error: 'Failed to get document summary' });
    }
  }
);

/**
 * POST /api/projects/:id/generate-summary
 * Generate or regenerate project summary
 */
router.post(
  '/projects/:id/generate-summary',
  authenticateToken,
  scopeToCompany,
  async (req: AuthRequest, res) => {
    try {
      const { id: projectId } = req.params;

      const summary = await generateProjectSummary(projectId);

      res.json({ summary });
    } catch (error: any) {
      console.error('[DocumentSummary] Summary generation error:', error);
      res.status(500).json({ error: 'Failed to generate summary' });
    }
  }
);

/**
 * PATCH /api/projects/:id/summary
 * Update project summary (user edits)
 */
router.patch(
  '/projects/:id/summary',
  authenticateToken,
  scopeToCompany,
  async (req: AuthRequest, res) => {
    try {
      const { id: projectId } = req.params;
      const updates = req.body;

      const summary = await updateProjectSummary(projectId, updates);

      res.json({ summary });
    } catch (error: any) {
      console.error('[DocumentSummary] Summary update error:', error);
      res.status(500).json({ error: 'Failed to update summary' });
    }
  }
);

/**
 * POST /api/documents/:id/extract-entities
 * Extract entities from a specific document
 */
router.post(
  '/documents/:id/extract-entities',
  authenticateToken,
  scopeToCompany,
  async (req: AuthRequest, res) => {
    try {
      const { id: documentId } = req.params;

      const [doc] = await db
        .select()
        .from(documents)
        .where(eq(documents.id, parseInt(documentId)))
        .limit(1);

      if (!doc) {
        return res.status(404).json({ error: 'Document not found' });
      }

      if (!doc.content) {
        return res.status(400).json({ error: 'Document has no content' });
      }

      const startTime = Date.now();
      const { keyInformation, extractedEntities } = await extractEntitiesFromDocument(
        doc.content,
        doc.filename
      );
      const processingTimeMs = Date.now() - startTime;

      // Check if metadata exists
      const [existingMetadata] = await db
        .select()
        .from(documentMetadata)
        .where(eq(documentMetadata.documentId, doc.id))
        .limit(1);

      if (existingMetadata) {
        // Update
        await db
          .update(documentMetadata)
          .set({
            keyInformation,
            extractedEntities,
            processingTimeMs,
            processingStatus: 'completed',
            updatedAt: new Date(),
          })
          .where(eq(documentMetadata.documentId, doc.id));
      } else {
        // Insert
        await db.insert(documentMetadata).values({
          documentId: doc.id,
          keyInformation,
          extractedEntities,
          processingTimeMs,
          processingStatus: 'completed',
        });
      }

      res.json({
        keyInformation,
        extractedEntities,
        processingTimeMs,
      });
    } catch (error: any) {
      console.error('[DocumentSummary] Entity extraction error:', error);
      res.status(500).json({ error: 'Failed to extract entities' });
    }
  }
);

/**
 * GET /api/projects/:id/summary/export
 * Export project summary as PDF
 */
router.get(
  '/projects/:id/summary/export',
  authenticateToken,
  scopeToCompany,
  async (req: AuthRequest, res) => {
    try {
      const { id: projectId } = req.params;
      const format = req.query.format || 'pdf';

      const [summary] = await db
        .select()
        .from(projectSummaries)
        .where(eq(projectSummaries.projectId, projectId))
        .limit(1);

      if (!summary) {
        return res.status(404).json({ error: 'Project summary not found' });
      }

      // For now, return as JSON
      // TODO: Implement PDF generation using puppeteer or similar
      if (format === 'pdf') {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="project-summary-${projectId}.json"`);
        res.json(summary);
      } else {
        res.json(summary);
      }
    } catch (error: any) {
      console.error('[DocumentSummary] Export error:', error);
      res.status(500).json({ error: 'Failed to export summary' });
    }
  }
);

export default router;
