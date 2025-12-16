import { Router } from 'express';
import { db } from '../db';
import { 
  projects, 
  bidOutcomes, 
  winProbabilityPredictions,
  rfpAnalyses,
  documents,
  users,
  teamActivity,
  auditLogs,
  dashboardConfigs,
  insertDashboardConfigSchema,
  updateDashboardConfigSchema,
  DashboardWidget
} from '@shared/schema';
import { eq, and, sql, gte, lte, desc, count } from 'drizzle-orm';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';

const router = Router();

// Get overall company metrics (requires admin, manager, or user role)
router.get('/overview', authenticateToken, requireRole(['admin', 'manager', 'user']), async (req: AuthRequest, res) => {
  try {
    const { days = '30' } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days as string));

    // Project counts by status
    const projectStats = await db
      .select({
        status: projects.status,
        count: sql<number>`count(*)`,
      })
      .from(projects)
      .groupBy(projects.status);

    // Win/Loss statistics
    const outcomeStats = await db
      .select({
        outcome: bidOutcomes.outcome,
        count: sql<number>`count(*)`,
      })
      .from(bidOutcomes)
      .groupBy(bidOutcomes.outcome);

    // Total documents processed
    const [docStats] = await db
      .select({
        total: sql<number>`count(*)`,
        processed: sql<number>`count(*) filter (where is_processed = true)`,
      })
      .from(documents);

    // Active users (users with activity in period)
    const [userStats] = await db
      .select({
        total: sql<number>`count(distinct user_id)`,
      })
      .from(auditLogs)
      .where(gte(auditLogs.createdAt, startDate));

    // Calculate win rate
    const wonCount = outcomeStats.find(o => o.outcome === 'won')?.count || 0;
    const lostCount = outcomeStats.find(o => o.outcome === 'lost')?.count || 0;
    const totalBids = Number(wonCount) + Number(lostCount);
    const winRate = totalBids > 0 ? (Number(wonCount) / totalBids) * 100 : 0;

    // Average prediction accuracy
    const [predictionAccuracy] = await db
      .select({
        avgProbability: sql<number>`avg(probability)`,
        count: sql<number>`count(*)`,
      })
      .from(winProbabilityPredictions);

    res.json({
      periodDays: parseInt(days as string),
      projects: {
        total: projectStats.reduce((sum, p) => sum + Number(p.count), 0),
        byStatus: Object.fromEntries(projectStats.map(p => [p.status, Number(p.count)])),
      },
      bidding: {
        totalBids,
        won: Number(wonCount),
        lost: Number(lostCount),
        winRate: Math.round(winRate * 10) / 10,
      },
      documents: {
        total: Number(docStats?.total || 0),
        processed: Number(docStats?.processed || 0),
      },
      users: {
        activeInPeriod: Number(userStats?.total || 0),
      },
      predictions: {
        total: Number(predictionAccuracy?.count || 0),
        averageProbability: Math.round((predictionAccuracy?.avgProbability || 0) * 100),
      },
    });
  } catch (error: any) {
    console.error('Error fetching overview:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get trend data over time (requires admin, manager, or user role)
router.get('/trends', authenticateToken, requireRole(['admin', 'manager', 'user']), async (req: AuthRequest, res) => {
  try {
    const { days = '30', interval = 'day' } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days as string));

    // Projects created over time
    const projectTrends = await db
      .select({
        date: sql<string>`date(${projects.createdAt})`,
        count: sql<number>`count(*)`,
      })
      .from(projects)
      .where(gte(projects.createdAt, startDate))
      .groupBy(sql`date(${projects.createdAt})`)
      .orderBy(sql`date(${projects.createdAt})`);

    // Bid outcomes over time
    const outcomeTrends = await db
      .select({
        date: sql<string>`date(${bidOutcomes.recordedAt})`,
        outcome: bidOutcomes.outcome,
        count: sql<number>`count(*)`,
      })
      .from(bidOutcomes)
      .where(gte(bidOutcomes.recordedAt, startDate))
      .groupBy(sql`date(${bidOutcomes.recordedAt})`, bidOutcomes.outcome)
      .orderBy(sql`date(${bidOutcomes.recordedAt})`);

    // Activity trends
    const activityTrends = await db
      .select({
        date: sql<string>`date(${auditLogs.createdAt})`,
        count: sql<number>`count(*)`,
      })
      .from(auditLogs)
      .where(gte(auditLogs.createdAt, startDate))
      .groupBy(sql`date(${auditLogs.createdAt})`)
      .orderBy(sql`date(${auditLogs.createdAt})`);

    // Win probability predictions over time
    const predictionTrends = await db
      .select({
        date: sql<string>`date(${winProbabilityPredictions.predictionDate})`,
        avgProbability: sql<number>`avg(probability)`,
        count: sql<number>`count(*)`,
      })
      .from(winProbabilityPredictions)
      .where(gte(winProbabilityPredictions.predictionDate, startDate))
      .groupBy(sql`date(${winProbabilityPredictions.predictionDate})`)
      .orderBy(sql`date(${winProbabilityPredictions.predictionDate})`);

    res.json({
      periodDays: parseInt(days as string),
      projects: projectTrends.map(t => ({ date: t.date, count: Number(t.count) })),
      outcomes: outcomeTrends.map(t => ({ 
        date: t.date, 
        outcome: t.outcome, 
        count: Number(t.count) 
      })),
      activity: activityTrends.map(t => ({ date: t.date, count: Number(t.count) })),
      predictions: predictionTrends.map(t => ({
        date: t.date,
        avgProbability: Math.round((t.avgProbability || 0) * 100),
        count: Number(t.count),
      })),
    });
  } catch (error: any) {
    console.error('Error fetching trends:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get team performance metrics
router.get('/team-performance', authenticateToken, requireRole(['admin', 'manager']), async (req: AuthRequest, res) => {
  try {
    const { days = '30' } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days as string));

    // Activity by user
    const userActivity = await db
      .select({
        userId: auditLogs.userId,
        userEmail: auditLogs.userEmail,
        actionCount: sql<number>`count(*)`,
      })
      .from(auditLogs)
      .where(gte(auditLogs.createdAt, startDate))
      .groupBy(auditLogs.userId, auditLogs.userEmail)
      .orderBy(sql`count(*) desc`)
      .limit(10);

    // Get user names
    const userIds = userActivity.map(u => u.userId).filter(Boolean);
    const userNames = userIds.length > 0
      ? await db
          .select({ id: users.id, name: users.name })
          .from(users)
          .where(sql`${users.id} = ANY(${userIds})`)
      : [];
    const nameMap = new Map(userNames.map(u => [u.id, u.name]));

    // Top contributors (by comments/activity)
    const topContributors = await db
      .select({
        userId: teamActivity.userId,
        activityCount: sql<number>`count(*)`,
      })
      .from(teamActivity)
      .where(gte(teamActivity.createdAt, startDate))
      .groupBy(teamActivity.userId)
      .orderBy(sql`count(*) desc`)
      .limit(5);

    res.json({
      periodDays: parseInt(days as string),
      userActivity: userActivity.map(u => ({
        userId: u.userId,
        email: u.userEmail,
        name: u.userId ? nameMap.get(u.userId) : null,
        actionCount: Number(u.actionCount),
      })),
      topContributors: topContributors.map(c => ({
        userId: c.userId,
        activityCount: Number(c.activityCount),
      })),
    });
  } catch (error: any) {
    console.error('Error fetching team performance:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get client analytics (requires admin, manager, or user role)
router.get('/clients', authenticateToken, requireRole(['admin', 'manager', 'user']), async (req: AuthRequest, res) => {
  try {
    // Projects by client
    const clientStats = await db
      .select({
        clientName: projects.clientName,
        projectCount: sql<number>`count(*)`,
        activeCount: sql<number>`count(*) filter (where status = 'Active')`,
        wonCount: sql<number>`count(*) filter (where status = 'Closed-Won')`,
        lostCount: sql<number>`count(*) filter (where status = 'Closed-Lost')`,
      })
      .from(projects)
      .groupBy(projects.clientName)
      .orderBy(sql`count(*) desc`)
      .limit(20);

    res.json({
      clients: clientStats.map(c => ({
        name: c.clientName,
        projects: Number(c.projectCount),
        active: Number(c.activeCount),
        won: Number(c.wonCount),
        lost: Number(c.lostCount),
        winRate: (Number(c.wonCount) + Number(c.lostCount)) > 0
          ? Math.round((Number(c.wonCount) / (Number(c.wonCount) + Number(c.lostCount))) * 100)
          : null,
      })),
    });
  } catch (error: any) {
    console.error('Error fetching client analytics:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get analysis insights (requires admin, manager, or user role)
router.get('/analysis-insights', authenticateToken, requireRole(['admin', 'manager', 'user']), async (req: AuthRequest, res) => {
  try {
    const { days = '90' } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days as string));

    // Average scores from analyses
    const [avgScores] = await db
      .select({
        avgQuality: sql<number>`avg(quality_score)`,
        avgDoability: sql<number>`avg(doability_score)`,
        avgClarity: sql<number>`avg(clarity_score)`,
        avgVendorRisk: sql<number>`avg(vendor_risk_score)`,
        count: sql<number>`count(*)`,
      })
      .from(rfpAnalyses)
      .where(gte(rfpAnalyses.analyzedAt, startDate));

    // Risk level distribution
    const riskDistribution = await db
      .select({
        riskLevel: rfpAnalyses.overallRiskLevel,
        count: sql<number>`count(*)`,
      })
      .from(rfpAnalyses)
      .where(gte(rfpAnalyses.analyzedAt, startDate))
      .groupBy(rfpAnalyses.overallRiskLevel);

    // Analyses over time
    const analysisTrends = await db
      .select({
        date: sql<string>`date(${rfpAnalyses.analyzedAt})`,
        count: sql<number>`count(*)`,
        avgDoability: sql<number>`avg(doability_score)`,
      })
      .from(rfpAnalyses)
      .where(gte(rfpAnalyses.analyzedAt, startDate))
      .groupBy(sql`date(${rfpAnalyses.analyzedAt})`)
      .orderBy(sql`date(${rfpAnalyses.analyzedAt})`);

    res.json({
      periodDays: parseInt(days as string),
      averageScores: {
        quality: Math.round((avgScores?.avgQuality || 0)),
        doability: Math.round((avgScores?.avgDoability || 0)),
        clarity: Math.round((avgScores?.avgClarity || 0)),
        vendorRisk: Math.round((avgScores?.avgVendorRisk || 0)),
      },
      totalAnalyses: Number(avgScores?.count || 0),
      riskDistribution: Object.fromEntries(
        riskDistribution.map(r => [r.riskLevel || 'Unknown', Number(r.count)])
      ),
      trends: analysisTrends.map(t => ({
        date: t.date,
        count: Number(t.count),
        avgDoability: Math.round(t.avgDoability || 0),
      })),
    });
  } catch (error: any) {
    console.error('Error fetching analysis insights:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== DASHBOARD CONFIGURATION ====================

// Default widgets for new users
const DEFAULT_WIDGETS: DashboardWidget[] = [
  { id: 'win-rate-1', type: 'win_rate_gauge', title: 'Win Rate', position: { x: 0, y: 0 }, size: { width: 1, height: 1 } },
  { id: 'trends-1', type: 'monthly_trends', title: 'Monthly Trends', position: { x: 1, y: 0 }, size: { width: 2, height: 1 } },
  { id: 'outcomes-1', type: 'recent_outcomes', title: 'Recent Outcomes', position: { x: 0, y: 1 }, size: { width: 1, height: 1 } },
  { id: 'clients-1', type: 'client_performance', title: 'Top Clients', position: { x: 1, y: 1 }, size: { width: 1, height: 1 } },
  { id: 'project-type-1', type: 'project_type_breakdown', title: 'By Project Type', position: { x: 2, y: 1 }, size: { width: 1, height: 1 } },
];

// Get user's dashboard config (creates default if none exists)
router.get('/dashboard-config', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    // Try to get existing config
    let [config] = await db
      .select()
      .from(dashboardConfigs)
      .where(eq(dashboardConfigs.userId, userId))
      .limit(1);

    // Create default config if none exists
    if (!config) {
      [config] = await db
        .insert(dashboardConfigs)
        .values({
          userId,
          companyId: req.user?.companyId || null,
          name: 'My Dashboard',
          isDefault: true,
          widgets: DEFAULT_WIDGETS,
          dateRange: '30d',
        })
        .returning();
    }

    res.json(config);
  } catch (error: any) {
    console.error('Error fetching dashboard config:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update user's dashboard config
router.put('/dashboard-config', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const parsed = updateDashboardConfigSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid configuration', details: parsed.error.flatten() });
    }

    // Find existing config
    const [existing] = await db
      .select()
      .from(dashboardConfigs)
      .where(eq(dashboardConfigs.userId, userId))
      .limit(1);

    if (!existing) {
      // Create new config
      const [config] = await db
        .insert(dashboardConfigs)
        .values({
          userId,
          companyId: req.user?.companyId || null,
          ...parsed.data,
        })
        .returning();
      return res.json(config);
    }

    // Update existing
    const [config] = await db
      .update(dashboardConfigs)
      .set({
        ...parsed.data,
        updatedAt: new Date(),
      })
      .where(eq(dashboardConfigs.id, existing.id))
      .returning();

    res.json(config);
  } catch (error: any) {
    console.error('Error updating dashboard config:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get bid amounts and revenue statistics
router.get('/revenue-stats', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { days = '90' } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days as string));

    // Revenue by outcome
    const revenueStats = await db
      .select({
        outcome: bidOutcomes.outcome,
        totalAmount: sql<number>`coalesce(sum(bid_amount), 0)`,
        avgAmount: sql<number>`coalesce(avg(bid_amount), 0)`,
        count: sql<number>`count(*)`,
      })
      .from(bidOutcomes)
      .where(gte(bidOutcomes.recordedAt, startDate))
      .groupBy(bidOutcomes.outcome);

    // Monthly revenue trends
    const monthlyRevenue = await db
      .select({
        month: sql<string>`to_char(${bidOutcomes.recordedAt}, 'YYYY-MM')`,
        wonAmount: sql<number>`coalesce(sum(case when outcome = 'won' then bid_amount else 0 end), 0)`,
        totalBidAmount: sql<number>`coalesce(sum(bid_amount), 0)`,
        wonCount: sql<number>`count(*) filter (where outcome = 'won')`,
        lostCount: sql<number>`count(*) filter (where outcome = 'lost')`,
      })
      .from(bidOutcomes)
      .where(gte(bidOutcomes.recordedAt, startDate))
      .groupBy(sql`to_char(${bidOutcomes.recordedAt}, 'YYYY-MM')`)
      .orderBy(sql`to_char(${bidOutcomes.recordedAt}, 'YYYY-MM')`);

    res.json({
      periodDays: parseInt(days as string),
      byOutcome: revenueStats.map(r => ({
        outcome: r.outcome,
        totalAmount: Math.round(Number(r.totalAmount)),
        avgAmount: Math.round(Number(r.avgAmount)),
        count: Number(r.count),
      })),
      monthly: monthlyRevenue.map(m => ({
        month: m.month,
        wonAmount: Math.round(Number(m.wonAmount)),
        totalBidAmount: Math.round(Number(m.totalBidAmount)),
        wonCount: Number(m.wonCount),
        lostCount: Number(m.lostCount),
        winRate: (Number(m.wonCount) + Number(m.lostCount)) > 0
          ? Math.round((Number(m.wonCount) / (Number(m.wonCount) + Number(m.lostCount))) * 100)
          : 0,
      })),
    });
  } catch (error: any) {
    console.error('Error fetching revenue stats:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get project type breakdown
router.get('/project-types', authenticateToken, async (req: AuthRequest, res) => {
  try {
    // Get project counts and win rates by project type (using client name as proxy)
    const typeStats = await db
      .select({
        projectType: projects.projectType,
        total: sql<number>`count(*)`,
        active: sql<number>`count(*) filter (where status = 'Active')`,
        won: sql<number>`count(*) filter (where status = 'Closed-Won')`,
        lost: sql<number>`count(*) filter (where status = 'Closed-Lost')`,
      })
      .from(projects)
      .groupBy(projects.projectType)
      .orderBy(sql`count(*) desc`);

    res.json({
      types: typeStats.map(t => ({
        type: t.projectType || 'Unspecified',
        total: Number(t.total),
        active: Number(t.active),
        won: Number(t.won),
        lost: Number(t.lost),
        winRate: (Number(t.won) + Number(t.lost)) > 0
          ? Math.round((Number(t.won) / (Number(t.won) + Number(t.lost))) * 100)
          : null,
      })),
    });
  } catch (error: any) {
    console.error('Error fetching project types:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
