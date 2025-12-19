import { Router } from 'express';
import { storage } from '../storage';
import { insertProjectSchema } from '@shared/schema';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { requireRole, requireAdmin } from '../middleware/rbac';
import { z } from 'zod';

const router = Router();

const updateStatusSchema = z.object({
  status: z.enum(["Active", "Submitted", "Closed-Won", "Closed-Lost"]),
});

// Create a new project (requires authentication, company-scoped)
router.post("/", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const data = insertProjectSchema.parse(req.body);
    const companyId = req.user?.companyId ?? null;
    const project = await storage.createProject(data, companyId);
    res.json(project);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// List all projects (requires authentication, company-scoped)
router.get("/", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = req.user?.companyId ?? null;
    const includeArchived = req.query.includeArchived === 'true';
    const isSystemAdmin = req.user?.role === 'system_admin';
    const projects = await storage.listProjects(companyId, includeArchived, isSystemAdmin);
    res.json(projects);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get a specific project (requires authentication, company-scoped)
// System admins can access any project
router.get("/:id", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const isSystemAdmin = req.user?.role === 'system_admin';
    const companyId = isSystemAdmin ? null : (req.user?.companyId ?? null);
    
    // For system admins, try to get project without company filter
    let project;
    if (isSystemAdmin) {
      // System admin can access any project - search across all companies
      const allProjects = await storage.listProjects(null, true, true);
      project = allProjects.find(p => p.id === req.params.id);
    } else {
      project = await storage.getProject(req.params.id, companyId);
    }
    
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }
    res.json(project);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update project status (requires authentication, company-scoped)
router.patch("/:id/status", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { status } = updateStatusSchema.parse(req.body);
    const companyId = req.user?.companyId ?? null;
    const project = await storage.updateProjectStatus(req.params.id, status, companyId);
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }
    res.json(project);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Archive a project (requires admin/manager role)
router.patch("/:id/archive", authenticateToken, requireRole(['admin', 'manager']), async (req: AuthRequest, res) => {
  try {
    const companyId = req.user?.companyId ?? null;
    const project = await storage.archiveProject(req.params.id, companyId);
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }
    res.json(project);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Unarchive a project (requires admin/manager role)
router.patch("/:id/unarchive", authenticateToken, requireRole(['admin', 'manager']), async (req: AuthRequest, res) => {
  try {
    const companyId = req.user?.companyId ?? null;
    const project = await storage.unarchiveProject(req.params.id, companyId);
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }
    res.json(project);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Delete a project (requires admin role - system_admin or company_admin)
router.delete("/:id", authenticateToken, requireAdmin, async (req: AuthRequest, res) => {
  try {
    // System admins can delete any project, company admins only their company's
    const isSystemAdmin = req.user?.role === 'system_admin';
    const companyId = req.user?.companyId ?? null;
    const deleted = await storage.deleteProject(req.params.id, companyId, isSystemAdmin);
    if (!deleted) {
      return res.status(404).json({ error: "Project not found" });
    }
    res.json({ message: "Project deleted successfully" });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Accept summaries and advance workflow to RFP Analysis
router.post("/:id/accept-summaries", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const projectId = req.params.id;
    const companyId = req.user?.companyId ?? null;

    // Verify project exists
    const project = await storage.getProject(projectId, companyId);
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    // Verify project is in summary_review state
    if (project.workflowStatus !== 'summary_review') {
      return res.status(400).json({ 
        error: `Cannot accept summaries in current state: ${project.workflowStatus}` 
      });
    }

    // Update workflow status to 'analyzing' - triggers RFP Analysis
    await storage.updateWorkflowStatus(projectId, 'analyzing', companyId);

    res.json({
      success: true,
      message: "Summaries accepted. Moving to RFP Analysis.",
      workflowStatus: 'analyzing'
    });
  } catch (error: any) {
    console.error('Accept summaries error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update workflow status manually (for step transitions)
router.patch("/:id/workflow-status", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const projectId = req.params.id;
    const companyId = req.user?.companyId ?? null;
    const { workflowStatus } = req.body;

    if (!workflowStatus) {
      return res.status(400).json({ error: "workflowStatus is required" });
    }

    const validStatuses = ['uploading', 'summarizing', 'summary_review', 'analyzing', 'analysis_review', 'conflict_check', 'generating', 'review', 'completed'];
    if (!validStatuses.includes(workflowStatus)) {
      return res.status(400).json({ error: `Invalid workflow status: ${workflowStatus}` });
    }

    const project = await storage.updateWorkflowStatus(projectId, workflowStatus, companyId);
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    res.json(project);
  } catch (error: any) {
    console.error('Update workflow status error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;

