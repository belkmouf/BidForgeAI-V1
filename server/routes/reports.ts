import { Router } from 'express';
import { db } from '../db';
import { 
  projects, 
  bidOutcomes, 
  winProbabilityPredictions,
  rfpAnalyses,
  documents,
  auditLogs,
  teamActivity
} from '@shared/schema';
import { eq, and, sql, gte, lte, desc } from 'drizzle-orm';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { logAuditEvent, AUDIT_ACTIONS } from './audit';

const router = Router();

// Generate project summary report (JSON format for frontend to convert)
router.get('/project/:projectId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { projectId } = req.params;

    // Get project details
    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, projectId));

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Get documents
    const projectDocs = await db
      .select()
      .from(documents)
      .where(eq(documents.projectId, projectId));

    // Get latest analysis
    const [analysis] = await db
      .select()
      .from(rfpAnalyses)
      .where(eq(rfpAnalyses.projectId, projectId))
      .orderBy(desc(rfpAnalyses.analyzedAt))
      .limit(1);

    // Get win probability prediction
    const [prediction] = await db
      .select()
      .from(winProbabilityPredictions)
      .where(eq(winProbabilityPredictions.projectId, projectId))
      .orderBy(desc(winProbabilityPredictions.predictionDate))
      .limit(1);

    // Get bid outcome if exists
    const [outcome] = await db
      .select()
      .from(bidOutcomes)
      .where(eq(bidOutcomes.projectId, projectId))
      .orderBy(desc(bidOutcomes.recordedAt))
      .limit(1);

    // Get activity
    const activities = await db
      .select()
      .from(teamActivity)
      .where(eq(teamActivity.projectId, projectId))
      .orderBy(desc(teamActivity.createdAt))
      .limit(20);

    const report = {
      generatedAt: new Date().toISOString(),
      project: {
        id: project.id,
        name: project.name,
        clientName: project.clientName,
        status: project.status,
        createdAt: project.createdAt,
      },
      documents: {
        total: projectDocs.length,
        processed: projectDocs.filter(d => d.isProcessed).length,
        list: projectDocs.map(d => ({
          filename: d.filename,
          uploadedAt: d.uploadedAt,
          processed: d.isProcessed,
        })),
      },
      analysis: analysis ? {
        analyzedAt: analysis.analyzedAt,
        scores: {
          quality: analysis.qualityScore,
          doability: analysis.doabilityScore,
          clarity: analysis.clarityScore,
          vendorRisk: analysis.vendorRiskScore,
        },
        riskLevel: analysis.overallRiskLevel,
        redFlags: analysis.redFlags,
        opportunities: analysis.opportunities,
        recommendations: analysis.recommendations,
      } : null,
      winProbability: prediction ? {
        probability: Math.round(prediction.probability * 100),
        confidence: Math.round(prediction.confidence * 100),
        predictedAt: prediction.predictionDate,
        riskFactors: prediction.riskFactors,
        strengthFactors: prediction.strengthFactors,
        recommendations: prediction.recommendations,
      } : null,
      outcome: outcome ? {
        result: outcome.outcome,
        bidAmount: outcome.bidAmount,
        winningBidAmount: outcome.winningBidAmount,
        competitorCount: outcome.competitorCount,
        recordedAt: outcome.recordedAt,
      } : null,
      recentActivity: activities.map(a => ({
        type: a.activityType,
        description: a.description,
        createdAt: a.createdAt,
      })),
    };

    // Log the export
    await logAuditEvent(AUDIT_ACTIONS.BID_EXPORT, 'project_report', req, {
      projectId,
      details: { format: 'json' },
    });

    res.json(report);
  } catch (error: any) {
    console.error('Error generating project report:', error);
    res.status(500).json({ error: error.message });
  }
});

// Generate company-wide analytics report (requires admin, manager, or user role)
router.get('/analytics', authenticateToken, requireRole(['admin', 'manager', 'user']), async (req: AuthRequest, res) => {
  try {
    const { startDate, endDate } = req.query;
    const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate as string) : new Date();

    // Project statistics
    const projectStats = await db
      .select({
        status: projects.status,
        count: sql<number>`count(*)`,
      })
      .from(projects)
      .where(and(
        gte(projects.createdAt, start),
        lte(projects.createdAt, end)
      ))
      .groupBy(projects.status);

    // Win/Loss statistics
    const outcomeStats = await db
      .select({
        outcome: bidOutcomes.outcome,
        count: sql<number>`count(*)`,
        avgBidAmount: sql<number>`avg(bid_amount)`,
      })
      .from(bidOutcomes)
      .where(and(
        gte(bidOutcomes.recordedAt, start),
        lte(bidOutcomes.recordedAt, end)
      ))
      .groupBy(bidOutcomes.outcome);

    // Analysis statistics
    const [analysisStats] = await db
      .select({
        count: sql<number>`count(*)`,
        avgQuality: sql<number>`avg(quality_score)`,
        avgDoability: sql<number>`avg(doability_score)`,
        avgClarity: sql<number>`avg(clarity_score)`,
        avgVendorRisk: sql<number>`avg(vendor_risk_score)`,
      })
      .from(rfpAnalyses)
      .where(and(
        gte(rfpAnalyses.analyzedAt, start),
        lte(rfpAnalyses.analyzedAt, end)
      ));

    // Client breakdown
    const clientStats = await db
      .select({
        clientName: projects.clientName,
        projectCount: sql<number>`count(*)`,
      })
      .from(projects)
      .where(and(
        gte(projects.createdAt, start),
        lte(projects.createdAt, end)
      ))
      .groupBy(projects.clientName)
      .orderBy(sql`count(*) desc`)
      .limit(10);

    // Calculate win rate
    const wonCount = outcomeStats.find(o => o.outcome === 'won')?.count || 0;
    const lostCount = outcomeStats.find(o => o.outcome === 'lost')?.count || 0;
    const totalBids = Number(wonCount) + Number(lostCount);
    const winRate = totalBids > 0 ? (Number(wonCount) / totalBids) * 100 : 0;

    const report = {
      generatedAt: new Date().toISOString(),
      period: {
        startDate: start.toISOString(),
        endDate: end.toISOString(),
      },
      summary: {
        totalProjects: projectStats.reduce((sum, p) => sum + Number(p.count), 0),
        totalBids,
        winRate: Math.round(winRate * 10) / 10,
        won: Number(wonCount),
        lost: Number(lostCount),
      },
      projectsByStatus: Object.fromEntries(
        projectStats.map(p => [p.status, Number(p.count)])
      ),
      bidOutcomes: outcomeStats.map(o => ({
        outcome: o.outcome,
        count: Number(o.count),
        avgBidAmount: o.avgBidAmount ? Math.round(o.avgBidAmount) : null,
      })),
      analysisMetrics: analysisStats ? {
        totalAnalyses: Number(analysisStats.count),
        averageScores: {
          quality: Math.round(analysisStats.avgQuality || 0),
          doability: Math.round(analysisStats.avgDoability || 0),
          clarity: Math.round(analysisStats.avgClarity || 0),
          vendorRisk: Math.round(analysisStats.avgVendorRisk || 0),
        },
      } : null,
      topClients: clientStats.map(c => ({
        name: c.clientName,
        projects: Number(c.projectCount),
      })),
    };

    res.json(report);
  } catch (error: any) {
    console.error('Error generating analytics report:', error);
    res.status(500).json({ error: error.message });
  }
});

// Generate audit report (admin or manager only)
router.get('/audit', authenticateToken, requireRole(['admin', 'manager']), async (req: AuthRequest, res) => {
  try {

    const { startDate, endDate } = req.query;
    const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate as string) : new Date();

    // Get audit logs
    const logs = await db
      .select()
      .from(auditLogs)
      .where(and(
        gte(auditLogs.createdAt, start),
        lte(auditLogs.createdAt, end)
      ))
      .orderBy(desc(auditLogs.createdAt))
      .limit(1000);

    // Action summary
    const actionSummary = await db
      .select({
        action: auditLogs.action,
        count: sql<number>`count(*)`,
      })
      .from(auditLogs)
      .where(and(
        gte(auditLogs.createdAt, start),
        lte(auditLogs.createdAt, end)
      ))
      .groupBy(auditLogs.action)
      .orderBy(sql`count(*) desc`);

    // User activity summary
    const userSummary = await db
      .select({
        userEmail: auditLogs.userEmail,
        count: sql<number>`count(*)`,
      })
      .from(auditLogs)
      .where(and(
        gte(auditLogs.createdAt, start),
        lte(auditLogs.createdAt, end)
      ))
      .groupBy(auditLogs.userEmail)
      .orderBy(sql`count(*) desc`)
      .limit(10);

    const report = {
      generatedAt: new Date().toISOString(),
      period: {
        startDate: start.toISOString(),
        endDate: end.toISOString(),
      },
      totalEvents: logs.length,
      actionBreakdown: actionSummary.map(a => ({
        action: a.action,
        count: Number(a.count),
      })),
      topUsers: userSummary.map(u => ({
        email: u.userEmail,
        actions: Number(u.count),
      })),
      events: logs.map(log => ({
        id: log.id,
        timestamp: log.createdAt,
        user: log.userEmail,
        action: log.action,
        resourceType: log.resourceType,
        resourceId: log.resourceId,
        ipAddress: log.ipAddress,
      })),
    };

    res.json(report);
  } catch (error: any) {
    console.error('Error generating audit report:', error);
    res.status(500).json({ error: error.message });
  }
});

// Export projects as CSV (requires admin, manager, or user role)
router.get('/export/projects/csv', authenticateToken, requireRole(['admin', 'manager', 'user']), async (req: AuthRequest, res) => {
  try {
    const allProjects = await db
      .select()
      .from(projects)
      .orderBy(desc(projects.createdAt));

    // Generate CSV
    const headers = ['ID', 'Name', 'Client', 'Status', 'Created At'];
    const rows = allProjects.map(p => [
      p.id,
      p.name,
      p.clientName,
      p.status,
      p.createdAt.toISOString(),
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=projects-${new Date().toISOString().split('T')[0]}.csv`);
    res.send(csv);
  } catch (error: any) {
    console.error('Error exporting projects:', error);
    res.status(500).json({ error: error.message });
  }
});

// Export bid outcomes as CSV (requires admin, manager, or user role)
router.get('/export/outcomes/csv', authenticateToken, requireRole(['admin', 'manager', 'user']), async (req: AuthRequest, res) => {
  try {
    const outcomes = await db
      .select({
        id: bidOutcomes.id,
        projectId: bidOutcomes.projectId,
        outcome: bidOutcomes.outcome,
        bidAmount: bidOutcomes.bidAmount,
        winningBidAmount: bidOutcomes.winningBidAmount,
        competitorCount: bidOutcomes.competitorCount,
        recordedAt: bidOutcomes.recordedAt,
        projectName: projects.name,
        clientName: projects.clientName,
      })
      .from(bidOutcomes)
      .leftJoin(projects, eq(bidOutcomes.projectId, projects.id))
      .orderBy(desc(bidOutcomes.recordedAt));

    const headers = ['ID', 'Project', 'Client', 'Outcome', 'Bid Amount', 'Winning Amount', 'Competitors', 'Recorded At'];
    const rows = outcomes.map(o => [
      o.id,
      o.projectName || '',
      o.clientName || '',
      o.outcome,
      o.bidAmount || '',
      o.winningBidAmount || '',
      o.competitorCount || '',
      o.recordedAt.toISOString(),
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=bid-outcomes-${new Date().toISOString().split('T')[0]}.csv`);
    res.send(csv);
  } catch (error: any) {
    console.error('Error exporting outcomes:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
