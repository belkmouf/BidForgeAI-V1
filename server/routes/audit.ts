import { Router } from 'express';
import { db } from '../db';
import { auditLogs, users, projects, type InsertAuditLog } from '@shared/schema';
import { eq, and, desc, sql, gte, lte, or, ilike } from 'drizzle-orm';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { z } from 'zod';

const router = Router();

// Audit action types
export const AUDIT_ACTIONS = {
  // Auth actions
  USER_LOGIN: 'user.login',
  USER_LOGOUT: 'user.logout',
  USER_REGISTER: 'user.register',
  PASSWORD_CHANGE: 'user.password_change',
  
  // Project actions
  PROJECT_CREATE: 'project.create',
  PROJECT_UPDATE: 'project.update',
  PROJECT_DELETE: 'project.delete',
  PROJECT_STATUS_CHANGE: 'project.status_change',
  
  // Document actions
  DOCUMENT_UPLOAD: 'document.upload',
  DOCUMENT_DELETE: 'document.delete',
  DOCUMENT_PROCESS: 'document.process',
  
  // Bid actions
  BID_GENERATE: 'bid.generate',
  BID_REFINE: 'bid.refine',
  BID_EXPORT: 'bid.export',
  
  // Analysis actions
  ANALYSIS_RUN: 'analysis.run',
  ANALYSIS_VIEW: 'analysis.view',
  
  // Team actions
  TEAM_MEMBER_ADD: 'team.member_add',
  TEAM_MEMBER_REMOVE: 'team.member_remove',
  TEAM_ROLE_CHANGE: 'team.role_change',
  
  // Admin actions
  USER_CREATE: 'admin.user_create',
  USER_UPDATE: 'admin.user_update',
  USER_DELETE: 'admin.user_delete',
  SETTINGS_UPDATE: 'admin.settings_update',
} as const;

// Helper to log audit events
export async function logAuditEvent(
  action: string,
  resourceType: string,
  req: AuthRequest,
  options: {
    resourceId?: string;
    projectId?: string;
    details?: Record<string, any>;
  } = {}
): Promise<void> {
  try {
    const logEntry: InsertAuditLog = {
      userId: req.user?.userId,
      userEmail: req.user?.email,
      action,
      resourceType,
      resourceId: options.resourceId,
      projectId: options.projectId,
      details: options.details || {},
      ipAddress: req.ip || req.socket?.remoteAddress,
      userAgent: req.headers['user-agent'],
    };

    await db.insert(auditLogs).values(logEntry);
  } catch (error) {
    console.error('Failed to log audit event:', error);
  }
}

// Query schema for filtering audit logs
const auditQuerySchema = z.object({
  action: z.string().optional(),
  resourceType: z.string().optional(),
  userId: z.string().transform(Number).optional(),
  projectId: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  search: z.string().optional(),
  limit: z.string().transform(Number).default('100'),
  offset: z.string().transform(Number).default('0'),
});

// Get audit logs (admin/manager only)
router.get('/', authenticateToken, requireRole(['admin', 'manager']), async (req: AuthRequest, res) => {
  try {
    const query = auditQuerySchema.parse(req.query);
    const conditions: any[] = [];

    if (query.action) {
      conditions.push(eq(auditLogs.action, query.action));
    }
    if (query.resourceType) {
      conditions.push(eq(auditLogs.resourceType, query.resourceType));
    }
    if (query.userId) {
      conditions.push(eq(auditLogs.userId, query.userId));
    }
    if (query.projectId) {
      conditions.push(eq(auditLogs.projectId, query.projectId));
    }
    if (query.startDate) {
      conditions.push(gte(auditLogs.createdAt, new Date(query.startDate)));
    }
    if (query.endDate) {
      conditions.push(lte(auditLogs.createdAt, new Date(query.endDate)));
    }
    if (query.search) {
      conditions.push(or(
        ilike(auditLogs.action, `%${query.search}%`),
        ilike(auditLogs.userEmail || '', `%${query.search}%`)
      ));
    }

    const logs = await db
      .select({
        id: auditLogs.id,
        userId: auditLogs.userId,
        userEmail: auditLogs.userEmail,
        action: auditLogs.action,
        resourceType: auditLogs.resourceType,
        resourceId: auditLogs.resourceId,
        projectId: auditLogs.projectId,
        details: auditLogs.details,
        ipAddress: auditLogs.ipAddress,
        createdAt: auditLogs.createdAt,
        userName: users.name,
      })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.userId, users.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(auditLogs.createdAt))
      .limit(query.limit)
      .offset(query.offset);

    // Get total count for pagination
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(auditLogs)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    res.json({
      logs,
      pagination: {
        total: Number(count),
        limit: query.limit,
        offset: query.offset,
      },
    });
  } catch (error: any) {
    console.error('Error fetching audit logs:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get audit log by ID
router.get('/:id', authenticateToken, requireRole(['admin', 'manager']), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    
    const [log] = await db
      .select({
        id: auditLogs.id,
        userId: auditLogs.userId,
        userEmail: auditLogs.userEmail,
        action: auditLogs.action,
        resourceType: auditLogs.resourceType,
        resourceId: auditLogs.resourceId,
        projectId: auditLogs.projectId,
        details: auditLogs.details,
        ipAddress: auditLogs.ipAddress,
        userAgent: auditLogs.userAgent,
        createdAt: auditLogs.createdAt,
        userName: users.name,
      })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.userId, users.id))
      .where(eq(auditLogs.id, parseInt(id)));

    if (!log) {
      return res.status(404).json({ error: 'Audit log not found' });
    }

    res.json(log);
  } catch (error: any) {
    console.error('Error fetching audit log:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get audit statistics
router.get('/stats/summary', authenticateToken, requireRole(['admin', 'manager']), async (req: AuthRequest, res) => {
  try {
    const { days = '30' } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days as string));

    // Actions by type
    const actionStats = await db
      .select({
        action: auditLogs.action,
        count: sql<number>`count(*)`,
      })
      .from(auditLogs)
      .where(gte(auditLogs.createdAt, startDate))
      .groupBy(auditLogs.action)
      .orderBy(sql`count(*) desc`);

    // Actions by user
    const userStats = await db
      .select({
        userId: auditLogs.userId,
        userEmail: auditLogs.userEmail,
        count: sql<number>`count(*)`,
      })
      .from(auditLogs)
      .where(gte(auditLogs.createdAt, startDate))
      .groupBy(auditLogs.userId, auditLogs.userEmail)
      .orderBy(sql`count(*) desc`)
      .limit(10);

    // Actions by day
    const dailyStats = await db
      .select({
        date: sql<string>`date(${auditLogs.createdAt})`,
        count: sql<number>`count(*)`,
      })
      .from(auditLogs)
      .where(gte(auditLogs.createdAt, startDate))
      .groupBy(sql`date(${auditLogs.createdAt})`)
      .orderBy(sql`date(${auditLogs.createdAt})`);

    // Total count
    const [{ total }] = await db
      .select({ total: sql<number>`count(*)` })
      .from(auditLogs)
      .where(gte(auditLogs.createdAt, startDate));

    res.json({
      totalEvents: Number(total),
      periodDays: parseInt(days as string),
      byAction: actionStats,
      byUser: userStats,
      byDay: dailyStats,
    });
  } catch (error: any) {
    console.error('Error fetching audit stats:', error);
    res.status(500).json({ error: error.message });
  }
});

// Export audit logs (admin only)
router.get('/export/csv', authenticateToken, requireRole(['admin']), async (req: AuthRequest, res) => {
  try {
    const query = auditQuerySchema.parse({ ...req.query, limit: '10000' });
    const conditions: any[] = [];

    if (query.startDate) {
      conditions.push(gte(auditLogs.createdAt, new Date(query.startDate)));
    }
    if (query.endDate) {
      conditions.push(lte(auditLogs.createdAt, new Date(query.endDate)));
    }

    const logs = await db
      .select()
      .from(auditLogs)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(auditLogs.createdAt))
      .limit(10000);

    // Generate CSV
    const headers = ['ID', 'Timestamp', 'User Email', 'Action', 'Resource Type', 'Resource ID', 'Project ID', 'IP Address', 'Details'];
    const rows = logs.map(log => [
      log.id,
      log.createdAt.toISOString(),
      log.userEmail || '',
      log.action,
      log.resourceType,
      log.resourceId || '',
      log.projectId || '',
      log.ipAddress || '',
      JSON.stringify(log.details),
    ]);

    const csv = [headers.join(','), ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=audit-logs-${new Date().toISOString().split('T')[0]}.csv`);
    res.send(csv);
  } catch (error: any) {
    console.error('Error exporting audit logs:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
