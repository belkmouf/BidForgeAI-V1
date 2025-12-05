import { Router } from 'express';
import { db } from '../db';
import { 
  projectTeamMembers, 
  userPresence, 
  teamActivity,
  projectComments,
  users,
  projects,
  insertProjectTeamMemberSchema,
  insertProjectCommentSchema,
  updateProjectCommentSchema,
  type ProjectTeamMember,
  type TeamActivity,
  type ProjectComment
} from '@shared/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { z } from 'zod';

const router = Router();

async function isProjectMember(userId: number, projectId: string): Promise<boolean> {
  const [member] = await db
    .select()
    .from(projectTeamMembers)
    .where(and(
      eq(projectTeamMembers.projectId, projectId),
      eq(projectTeamMembers.userId, userId)
    ));
  return !!member;
}

async function canEditProject(userId: number, projectId: string): Promise<boolean> {
  const [member] = await db
    .select()
    .from(projectTeamMembers)
    .where(and(
      eq(projectTeamMembers.projectId, projectId),
      eq(projectTeamMembers.userId, userId),
      sql`${projectTeamMembers.role} in ('owner', 'editor')`
    ));
  return !!member;
}

// ==================== TEAM MEMBERS ====================

// Get team members for a project (requires project membership or admin)
router.get('/projects/:projectId/members', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { projectId } = req.params;
    const userId = req.user!.userId;
    const userRole = req.user!.role;
    
    // Check authorization - must be admin or project member
    if (userRole !== 'admin' && userRole !== 'manager') {
      const isMember = await isProjectMember(userId, projectId);
      if (!isMember) {
        return res.status(403).json({ error: 'Access denied - not a project member' });
      }
    }
    
    const members = await db
      .select({
        id: projectTeamMembers.id,
        projectId: projectTeamMembers.projectId,
        userId: projectTeamMembers.userId,
        role: projectTeamMembers.role,
        addedAt: projectTeamMembers.addedAt,
        lastAccessedAt: projectTeamMembers.lastAccessedAt,
        userName: users.name,
        userEmail: users.email,
      })
      .from(projectTeamMembers)
      .innerJoin(users, eq(projectTeamMembers.userId, users.id))
      .where(eq(projectTeamMembers.projectId, projectId))
      .orderBy(desc(projectTeamMembers.addedAt));

    res.json(members);
  } catch (error: any) {
    console.error('Error fetching team members:', error);
    res.status(500).json({ error: error.message });
  }
});

// Add team member to project (requires owner/editor role or admin)
router.post('/projects/:projectId/members', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { projectId } = req.params;
    const userId = req.user!.userId;
    const userRole = req.user!.role;
    
    // Check authorization - must be admin or project owner/editor
    if (userRole !== 'admin') {
      const hasAccess = await canEditProject(userId, projectId);
      if (!hasAccess) {
        return res.status(403).json({ error: 'Only project owners or editors can add team members' });
      }
    }
    
    const data = insertProjectTeamMemberSchema.parse({ ...req.body, projectId });
    
    // Check if user is already a member
    const [existing] = await db
      .select()
      .from(projectTeamMembers)
      .where(and(
        eq(projectTeamMembers.projectId, projectId),
        eq(projectTeamMembers.userId, data.userId)
      ));

    if (existing) {
      return res.status(400).json({ error: 'User is already a team member' });
    }

    const [member] = await db
      .insert(projectTeamMembers)
      .values({
        projectId,
        userId: data.userId,
        role: data.role || 'viewer',
        addedBy: req.user?.userId,
      })
      .returning();

    // Log activity
    await db.insert(teamActivity).values({
      projectId,
      userId: req.user!.userId,
      activityType: 'member_added',
      description: `Added a new team member`,
      metadata: { addedUserId: data.userId, role: data.role },
    });

    res.status(201).json(member);
  } catch (error: any) {
    console.error('Error adding team member:', error);
    res.status(400).json({ error: error.message });
  }
});

// Update team member role (requires owner role or admin)
router.patch('/projects/:projectId/members/:memberId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { projectId, memberId } = req.params;
    const userId = req.user!.userId;
    const userRole = req.user!.role;
    
    // Check authorization - must be admin or project owner
    if (userRole !== 'admin') {
      const [member] = await db
        .select()
        .from(projectTeamMembers)
        .where(and(
          eq(projectTeamMembers.projectId, projectId),
          eq(projectTeamMembers.userId, userId),
          eq(projectTeamMembers.role, 'owner')
        ));
      if (!member) {
        return res.status(403).json({ error: 'Only project owners can change member roles' });
      }
    }
    
    const { role } = z.object({ role: z.enum(['owner', 'editor', 'viewer']) }).parse(req.body);

    const [updated] = await db
      .update(projectTeamMembers)
      .set({ role })
      .where(and(
        eq(projectTeamMembers.id, parseInt(memberId)),
        eq(projectTeamMembers.projectId, projectId)
      ))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: 'Team member not found' });
    }

    res.json(updated);
  } catch (error: any) {
    console.error('Error updating team member:', error);
    res.status(400).json({ error: error.message });
  }
});

// Remove team member (requires owner/editor role or admin)
router.delete('/projects/:projectId/members/:memberId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { projectId, memberId } = req.params;
    const userId = req.user!.userId;
    const userRole = req.user!.role;
    
    // Check authorization - must be admin or project owner/editor
    if (userRole !== 'admin') {
      const hasAccess = await canEditProject(userId, projectId);
      if (!hasAccess) {
        return res.status(403).json({ error: 'Only project owners or editors can remove team members' });
      }
    }

    const [deleted] = await db
      .delete(projectTeamMembers)
      .where(and(
        eq(projectTeamMembers.id, parseInt(memberId)),
        eq(projectTeamMembers.projectId, projectId)
      ))
      .returning();

    if (!deleted) {
      return res.status(404).json({ error: 'Team member not found' });
    }

    // Log activity
    await db.insert(teamActivity).values({
      projectId,
      userId: req.user!.userId,
      activityType: 'member_removed',
      description: `Removed a team member`,
      metadata: { removedUserId: deleted.userId },
    });

    res.json({ success: true });
  } catch (error: any) {
    console.error('Error removing team member:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== PRESENCE ====================

// Get online users for a project (requires project membership or admin)
router.get('/projects/:projectId/presence', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { projectId } = req.params;
    const userId = req.user!.userId;
    const userRole = req.user!.role;
    
    // Check authorization - must be admin, manager, or project member
    if (userRole !== 'admin' && userRole !== 'manager') {
      const isMember = await isProjectMember(userId, projectId);
      if (!isMember) {
        return res.status(403).json({ error: 'Access denied - not a project member' });
      }
    }
    
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

    const onlineUsers = await db
      .select({
        id: userPresence.id,
        userId: userPresence.userId,
        status: userPresence.status,
        currentPage: userPresence.currentPage,
        lastActiveAt: userPresence.lastActiveAt,
        userName: users.name,
        userEmail: users.email,
      })
      .from(userPresence)
      .innerJoin(users, eq(userPresence.userId, users.id))
      .where(and(
        eq(userPresence.projectId, projectId),
        sql`${userPresence.lastActiveAt} > ${fiveMinutesAgo}`
      ));

    res.json(onlineUsers);
  } catch (error: any) {
    console.error('Error fetching presence:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update user presence (heartbeat)
router.post('/presence', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { projectId, currentPage, status = 'online' } = req.body;
    const userId = req.user!.userId;

    // Upsert presence
    const [existing] = await db
      .select()
      .from(userPresence)
      .where(eq(userPresence.userId, userId));

    if (existing) {
      await db
        .update(userPresence)
        .set({
          projectId,
          currentPage,
          status,
          lastActiveAt: new Date(),
        })
        .where(eq(userPresence.userId, userId));
    } else {
      await db.insert(userPresence).values({
        userId,
        projectId,
        currentPage,
        status,
      });
    }

    // Also update last accessed time on team member record
    if (projectId) {
      await db
        .update(projectTeamMembers)
        .set({ lastAccessedAt: new Date() })
        .where(and(
          eq(projectTeamMembers.projectId, projectId),
          eq(projectTeamMembers.userId, userId)
        ));
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error('Error updating presence:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== ACTIVITY FEED ====================

// Get activity feed for a project (requires project membership or admin)
router.get('/projects/:projectId/activity', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { projectId } = req.params;
    const userId = req.user!.userId;
    const userRole = req.user!.role;
    
    // Check authorization - must be admin, manager, or project member
    if (userRole !== 'admin' && userRole !== 'manager') {
      const isMember = await isProjectMember(userId, projectId);
      if (!isMember) {
        return res.status(403).json({ error: 'Access denied - not a project member' });
      }
    }
    
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const activities = await db
      .select({
        id: teamActivity.id,
        projectId: teamActivity.projectId,
        userId: teamActivity.userId,
        activityType: teamActivity.activityType,
        description: teamActivity.description,
        metadata: teamActivity.metadata,
        createdAt: teamActivity.createdAt,
        userName: users.name,
        userEmail: users.email,
      })
      .from(teamActivity)
      .innerJoin(users, eq(teamActivity.userId, users.id))
      .where(eq(teamActivity.projectId, projectId))
      .orderBy(desc(teamActivity.createdAt))
      .limit(limit)
      .offset(offset);

    res.json(activities);
  } catch (error: any) {
    console.error('Error fetching activity:', error);
    res.status(500).json({ error: error.message });
  }
});

// Log activity (requires project membership or admin)
router.post('/projects/:projectId/activity', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { projectId } = req.params;
    const userId = req.user!.userId;
    const userRole = req.user!.role;
    
    // Check authorization - must be admin, manager, or project member
    if (userRole !== 'admin' && userRole !== 'manager') {
      const isMember = await isProjectMember(userId, projectId);
      if (!isMember) {
        return res.status(403).json({ error: 'Access denied - not a project member' });
      }
    }
    
    const { activityType, description, metadata } = req.body;

    const [activity] = await db
      .insert(teamActivity)
      .values({
        projectId,
        userId: req.user!.userId,
        activityType,
        description,
        metadata: metadata || {},
      })
      .returning();

    res.status(201).json(activity);
  } catch (error: any) {
    console.error('Error logging activity:', error);
    res.status(400).json({ error: error.message });
  }
});

// ==================== COMMENTS ====================

// Get comments for a project (requires project membership or admin)
router.get('/projects/:projectId/comments', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { projectId } = req.params;
    const userId = req.user!.userId;
    const userRole = req.user!.role;
    
    // Check authorization - must be admin or project member (managers need project membership)
    if (userRole !== 'admin') {
      const isMember = await isProjectMember(userId, projectId);
      if (!isMember) {
        return res.status(403).json({ error: 'Access denied - not a project member' });
      }
    }
    
    const includeResolved = req.query.includeResolved === 'true';

    let query = db
      .select({
        id: projectComments.id,
        projectId: projectComments.projectId,
        userId: projectComments.userId,
        content: projectComments.content,
        parentId: projectComments.parentId,
        isResolved: projectComments.isResolved,
        createdAt: projectComments.createdAt,
        updatedAt: projectComments.updatedAt,
        userName: users.name,
        userEmail: users.email,
      })
      .from(projectComments)
      .innerJoin(users, eq(projectComments.userId, users.id))
      .where(includeResolved 
        ? eq(projectComments.projectId, projectId)
        : and(eq(projectComments.projectId, projectId), eq(projectComments.isResolved, false))
      )
      .orderBy(desc(projectComments.createdAt));

    const comments = await query;
    res.json(comments);
  } catch (error: any) {
    console.error('Error fetching comments:', error);
    res.status(500).json({ error: error.message });
  }
});

// Add comment (requires project membership or admin)
router.post('/projects/:projectId/comments', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { projectId } = req.params;
    const userId = req.user!.userId;
    const userRole = req.user!.role;
    
    // Check authorization - must be admin or project member (managers need project membership)
    if (userRole !== 'admin') {
      const isMember = await isProjectMember(userId, projectId);
      if (!isMember) {
        return res.status(403).json({ error: 'Access denied - not a project member' });
      }
    }
    
    const data = insertProjectCommentSchema.parse({ ...req.body, projectId });

    const [comment] = await db
      .insert(projectComments)
      .values({
        projectId,
        userId: req.user!.userId,
        content: data.content,
        parentId: data.parentId,
      })
      .returning();

    // Log activity
    await db.insert(teamActivity).values({
      projectId,
      userId: req.user!.userId,
      activityType: 'comment_added',
      description: 'Added a comment',
      metadata: { commentId: comment.id },
    });

    res.status(201).json(comment);
  } catch (error: any) {
    console.error('Error adding comment:', error);
    res.status(400).json({ error: error.message });
  }
});

// Update comment (requires project membership + comment owner, or admin)
router.patch('/projects/:projectId/comments/:commentId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { projectId, commentId } = req.params;
    const userId = req.user!.userId;
    const userRole = req.user!.role;
    
    // Check authorization - must be admin or project member (managers need project membership too)
    if (userRole !== 'admin') {
      const isMember = await isProjectMember(userId, projectId);
      if (!isMember) {
        return res.status(403).json({ error: 'Access denied - not a project member' });
      }
      
      // Check if user owns the comment
      const [existingComment] = await db
        .select()
        .from(projectComments)
        .where(eq(projectComments.id, parseInt(commentId)));
      
      if (!existingComment || existingComment.userId !== userId) {
        return res.status(403).json({ error: 'You can only edit your own comments' });
      }
    }
    
    const data = updateProjectCommentSchema.parse(req.body);

    const [updated] = await db
      .update(projectComments)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(and(
        eq(projectComments.id, parseInt(commentId)),
        eq(projectComments.projectId, projectId)
      ))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    res.json(updated);
  } catch (error: any) {
    console.error('Error updating comment:', error);
    res.status(400).json({ error: error.message });
  }
});

// Delete comment (requires project membership + comment owner, or admin)
router.delete('/projects/:projectId/comments/:commentId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { projectId, commentId } = req.params;
    const userId = req.user!.userId;
    const userRole = req.user!.role;
    
    // Check authorization - must be admin or project member (managers need project membership too)
    if (userRole !== 'admin') {
      const isMember = await isProjectMember(userId, projectId);
      if (!isMember) {
        return res.status(403).json({ error: 'Access denied - not a project member' });
      }
      
      // Check if user owns the comment
      const [existingComment] = await db
        .select()
        .from(projectComments)
        .where(eq(projectComments.id, parseInt(commentId)));
      
      if (!existingComment || existingComment.userId !== userId) {
        return res.status(403).json({ error: 'You can only delete your own comments' });
      }
    }

    const [deleted] = await db
      .delete(projectComments)
      .where(and(
        eq(projectComments.id, parseInt(commentId)),
        eq(projectComments.projectId, projectId)
      ))
      .returning();

    if (!deleted) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting comment:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== USERS LIST ====================

// Get all users (for adding to teams)
router.get('/users', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const allUsers = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        isActive: users.isActive,
      })
      .from(users)
      .where(eq(users.isActive, true))
      .orderBy(users.name);

    res.json(allUsers);
  } catch (error: any) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
