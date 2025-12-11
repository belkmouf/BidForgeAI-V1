import { Router } from 'express';
import { db } from '../db';
import { users, roles, userRoles, auditLogs, projects, documents } from '@shared/schema';
import { eq, sql, desc, count } from 'drizzle-orm';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { hashPassword } from '../lib/auth';
import { z } from 'zod';

const router = Router();

// ==================== USER MANAGEMENT ====================

// Get all users (system_admin only)
router.get('/users', authenticateToken, requireRole(['system_admin']), async (req: AuthRequest, res) => {
  try {
    const allUsers = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        role: users.role,
        isActive: users.isActive,
        createdAt: users.createdAt,
        lastLoginAt: users.lastLoginAt,
      })
      .from(users)
      .orderBy(desc(users.createdAt));

    res.json(allUsers);
  } catch (error: any) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get user by ID (system_admin only)
router.get('/users/:id', authenticateToken, requireRole(['system_admin']), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        role: users.role,
        isActive: users.isActive,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
        lastLoginAt: users.lastLoginAt,
      })
      .from(users)
      .where(eq(users.id, parseInt(id)));

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error: any) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create new user (system_admin only)
const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().optional(),
  role: z.enum(['system_admin', 'system_user', 'company_admin', 'company_user']).default('company_user'),
});

router.post('/users', authenticateToken, requireRole(['system_admin']), async (req: AuthRequest, res) => {
  try {
    const data = createUserSchema.parse(req.body);

    // Check if user exists
    const [existing] = await db
      .select()
      .from(users)
      .where(eq(users.email, data.email));

    if (existing) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    const passwordHash = await hashPassword(data.password);

    const [newUser] = await db
      .insert(users)
      .values({
        email: data.email,
        passwordHash,
        name: data.name,
        role: data.role,
      })
      .returning({
        id: users.id,
        email: users.email,
        name: users.name,
        role: users.role,
        createdAt: users.createdAt,
      });

    res.status(201).json(newUser);
  } catch (error: any) {
    console.error('Error creating user:', error);
    res.status(400).json({ error: error.message });
  }
});

// Update user (system_admin only)
const updateUserSchema = z.object({
  name: z.string().optional(),
  role: z.enum(['system_admin', 'system_user', 'company_admin', 'company_user']).optional(),
  isActive: z.boolean().optional(),
});

router.patch('/users/:id', authenticateToken, requireRole(['system_admin']), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const data = updateUserSchema.parse(req.body);

    const [updated] = await db
      .update(users)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(users.id, parseInt(id)))
      .returning({
        id: users.id,
        email: users.email,
        name: users.name,
        role: users.role,
        isActive: users.isActive,
      });

    if (!updated) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(updated);
  } catch (error: any) {
    console.error('Error updating user:', error);
    res.status(400).json({ error: error.message });
  }
});

// Reset user password (admin only)
router.post('/users/:id/reset-password', authenticateToken, requireRole(['system_admin']), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { password } = z.object({ password: z.string().min(8) }).parse(req.body);

    const passwordHash = await hashPassword(password);

    const [updated] = await db
      .update(users)
      .set({
        passwordHash,
        updatedAt: new Date(),
      })
      .where(eq(users.id, parseInt(id)))
      .returning({ id: users.id });

    if (!updated) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ success: true, message: 'Password reset successfully' });
  } catch (error: any) {
    console.error('Error resetting password:', error);
    res.status(400).json({ error: error.message });
  }
});

// Delete user (admin only)
router.delete('/users/:id', authenticateToken, requireRole(['system_admin']), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    // Prevent self-deletion
    if (req.user?.userId === parseInt(id)) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    const [deleted] = await db
      .delete(users)
      .where(eq(users.id, parseInt(id)))
      .returning({ id: users.id });

    if (!deleted) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== SYSTEM STATS ====================

router.get('/stats', authenticateToken, requireRole(['system_admin']), async (req: AuthRequest, res) => {
  try {
    // User stats
    const [userStats] = await db
      .select({
        total: sql<number>`count(*)`,
        active: sql<number>`count(*) filter (where is_active = true)`,
        admins: sql<number>`count(*) filter (where role = 'admin')`,
        managers: sql<number>`count(*) filter (where role = 'manager')`,
      })
      .from(users);

    // Project stats
    const [projectStats] = await db
      .select({
        total: sql<number>`count(*)`,
        active: sql<number>`count(*) filter (where status = 'Active')`,
        won: sql<number>`count(*) filter (where status = 'Closed-Won')`,
      })
      .from(projects);

    // Document stats
    const [docStats] = await db
      .select({
        total: sql<number>`count(*)`,
        processed: sql<number>`count(*) filter (where is_processed = true)`,
      })
      .from(documents);

    // Activity stats (last 24h)
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [activityStats] = await db
      .select({
        last24h: sql<number>`count(*)`,
      })
      .from(auditLogs)
      .where(sql`${auditLogs.createdAt} > ${dayAgo}`);

    res.json({
      users: {
        total: Number(userStats?.total || 0),
        active: Number(userStats?.active || 0),
        admins: Number(userStats?.admins || 0),
        managers: Number(userStats?.managers || 0),
      },
      projects: {
        total: Number(projectStats?.total || 0),
        active: Number(projectStats?.active || 0),
        won: Number(projectStats?.won || 0),
      },
      documents: {
        total: Number(docStats?.total || 0),
        processed: Number(docStats?.processed || 0),
      },
      activity: {
        last24h: Number(activityStats?.last24h || 0),
      },
    });
  } catch (error: any) {
    console.error('Error fetching system stats:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== API CONFIGURATION STATUS ====================

// Get API configuration status (checks if environment variables are set)
router.get('/api-status', authenticateToken, requireRole(['system_admin']), async (req: AuthRequest, res) => {
  try {
    const status = {
      openai: {
        configured: !!process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
        hasCustomBaseUrl: !!process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
      },
      anthropic: {
        configured: !!process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY,
        hasCustomBaseUrl: !!process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
      },
      gemini: {
        configured: !!process.env.AI_INTEGRATIONS_GEMINI_API_KEY,
        hasCustomBaseUrl: !!process.env.AI_INTEGRATIONS_GEMINI_BASE_URL,
      },
      database: {
        configured: !!process.env.DATABASE_URL,
      },
      whatsapp: {
        configured: !!(process.env.WA_PHONE_NUMBER_ID && process.env.CLOUD_API_ACCESS_TOKEN),
      },
    };

    res.json(status);
  } catch (error: any) {
    console.error('Error checking API status:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== ROLES MANAGEMENT ====================

// Get all roles (system_admin only)
router.get('/roles', authenticateToken, requireRole(['system_admin']), async (req: AuthRequest, res) => {
  try {
    const allRoles = await db.select().from(roles).orderBy(roles.name);
    res.json(allRoles);
  } catch (error: any) {
    console.error('Error fetching roles:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create role
router.post('/roles', authenticateToken, requireRole(['system_admin']), async (req: AuthRequest, res) => {
  try {
    const { name, permissions, description } = req.body;

    const [role] = await db
      .insert(roles)
      .values({
        name,
        permissions: permissions || [],
        description,
      })
      .returning();

    res.status(201).json(role);
  } catch (error: any) {
    console.error('Error creating role:', error);
    res.status(400).json({ error: error.message });
  }
});

export default router;
