import { Router, Response } from "express";
import { z } from "zod";
import { db } from "../db";
import { agentExecutions, agentStates, projects, documents } from "@shared/schema";
import { eq, desc, and } from "drizzle-orm";
import { orchestrator, initializeAgents } from "../agents";
import { multishotOrchestrator } from "../agents/multishot-orchestrator";
import { authenticateToken, AuthRequest } from "../middleware/auth";
import { requirePermission, PERMISSIONS } from "../middleware/rbac";

const router = Router();

initializeAgents();

const startWorkflowSchema = z.object({
  projectId: z.string().uuid(),
});

router.post(
  "/process",
  authenticateToken,
  requirePermission(PERMISSIONS.PROJECT_CREATE),
  async (req: AuthRequest, res: Response) => {
    try {
      const { projectId } = startWorkflowSchema.parse(req.body);
      const userId = req.user?.userId;

      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      const [project] = await db
        .select()
        .from(projects)
        .where(eq(projects.id, projectId))
        .limit(1);

      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }

      const existingState = await db
        .select()
        .from(agentStates)
        .where(eq(agentStates.projectId, projectId))
        .limit(1);

      if (existingState.length > 0 && existingState[0].status === "running") {
        return res.status(409).json({
          error: "Workflow already running for this project",
          currentAgent: existingState[0].currentAgent,
        });
      }

      orchestrator.clearCancellation(projectId);

      await db
        .insert(agentStates)
        .values({
          projectId,
          currentAgent: "intake",
          status: "running",
          state: { projectId, userId, startedAt: new Date() },
        })
        .onConflictDoUpdate({
          target: agentStates.projectId,
          set: {
            currentAgent: "intake",
            status: "running",
            state: { projectId, userId, startedAt: new Date() },
            updatedAt: new Date(),
          },
        });

      res.json({
        message: "Workflow started",
        projectId,
        status: "running",
        currentAgent: "intake",
      });

      orchestrator
        .execute({ projectId, userId })
        .then(async (result) => {
          try {
            await db
              .update(agentStates)
              .set({
                currentAgent: result.currentAgent,
                status: result.status,
                state: result as unknown as Record<string, unknown>,
                updatedAt: new Date(),
              })
              .where(eq(agentStates.projectId, projectId));

            console.log(
              `[AgentRoutes] Workflow completed for project ${projectId}: ${result.status}`,
            );
          } catch (dbError) {
            console.error(
              `[AgentRoutes] Failed to update agent state after workflow completion:`,
              dbError,
            );
            // Don't throw - workflow already completed, just log the DB error
          }
        })
        .catch(async (error) => {
          console.error(
            `[AgentRoutes] Workflow failed for project ${projectId}:`,
            error,
          );

          try {
            await db
              .update(agentStates)
              .set({
                status: "failed",
                state: { error: (error as Error).message },
                updatedAt: new Date(),
              })
              .where(eq(agentStates.projectId, projectId));
          } catch (dbError) {
            console.error(
              `[AgentRoutes] Failed to update agent state after workflow failure:`,
              dbError,
            );
            // Critical: both workflow and state update failed - log for monitoring
          }
        })
        .catch((fatalError) => {
          // Final catch for any unhandled errors in the promise chain
          console.error(
            `[AgentRoutes] CRITICAL: Unhandled error in workflow promise chain for project ${projectId}:`,
            fatalError,
          );
          // This ensures no unhandled promise rejections
        });
    } catch (error) {
      console.error("[AgentRoutes] Start workflow error:", error);
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ error: "Invalid request", details: error.errors });
      }
      res.status(500).json({ error: "Failed to start workflow" });
    }
  },
);

router.get(
  "/:projectId/status",
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    try {
      const { projectId } = req.params;

      const [currentState] = await db
        .select()
        .from(agentStates)
        .where(eq(agentStates.projectId, projectId))
        .limit(1);

      const executions = await db
        .select()
        .from(agentExecutions)
        .where(eq(agentExecutions.projectId, projectId))
        .orderBy(desc(agentExecutions.startedAt))
        .limit(50);

      const agentOrder = [
        "intake",
        "analysis",
        "decision",
        "generation",
        "review",
        "complete",
      ];
      const completedAgents = new Set(
        executions
          .filter((e) => e.status === "completed")
          .map((e) => e.agentName),
      );

      const progress = Math.round(
        (completedAgents.size / agentOrder.length) * 100,
      );

      res.json({
        projectId,
        currentState: currentState || null,
        executions,
        progress,
        completedAgents: Array.from(completedAgents),
      });
    } catch (error) {
      console.error("[AgentRoutes] Status check error:", error);
      res.status(500).json({ error: "Failed to get workflow status" });
    }
  },
);

router.get(
  "/:projectId/result",
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    try {
      const { projectId } = req.params;

      const [currentState] = await db
        .select()
        .from(agentStates)
        .where(eq(agentStates.projectId, projectId))
        .limit(1);

      if (!currentState) {
        return res
          .status(404)
          .json({ error: "No workflow found for this project" });
      }

      const state = currentState.state as Record<string, unknown>;

      res.json({
        projectId,
        status: currentState.status,
        currentAgent: currentState.currentAgent,
        analysis: state.analysis || null,
        bidStrategy: state.bidStrategy || null,
        draft: state.draft || null,
        review: state.review || null,
        logs: state.logs || [],
        errors: state.errors || [],
        completedAt: state.completedAt || null,
      });
    } catch (error) {
      console.error("[AgentRoutes] Result fetch error:", error);
      res.status(500).json({ error: "Failed to get workflow result" });
    }
  },
);

router.post(
  "/:projectId/cancel",
  authenticateToken,
  requirePermission(PERMISSIONS.PROJECT_EDIT),
  async (req: AuthRequest, res: Response) => {
    try {
      const { projectId } = req.params;

      orchestrator.cancelWorkflow(projectId);

      const [result] = await db
        .update(agentStates)
        .set({
          status: "cancelled",
          updatedAt: new Date(),
        })
        .where(eq(agentStates.projectId, projectId))
        .returning();

      if (!result) {
        return res
          .status(404)
          .json({ error: "No workflow found for this project" });
      }

      res.json({
        message: "Workflow cancelled",
        projectId,
        status: "cancelled",
      });
    } catch (error) {
      console.error("[AgentRoutes] Cancel workflow error:", error);
      res.status(500).json({ error: "Failed to cancel workflow" });
    }
  },
);

router.get("/", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const allStates = await db
      .select()
      .from(agentStates)
      .orderBy(desc(agentStates.updatedAt))
      .limit(100);

    res.json(allStates);
  } catch (error) {
    console.error("[AgentRoutes] List workflows error:", error);
    res.status(500).json({ error: "Failed to list workflows" });
  }
});

const multishotWorkflowSchema = z.object({
  projectId: z.string().uuid(),
});

router.post(
  "/multishot/process",
  authenticateToken,
  requirePermission(PERMISSIONS.PROJECT_CREATE),
  async (req: AuthRequest, res: Response) => {
    try {
      const { projectId } = multishotWorkflowSchema.parse(req.body);
      const userId = req.user?.userId;

      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      const [project] = await db
        .select()
        .from(projects)
        .where(eq(projects.id, projectId))
        .limit(1);

      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }

      const existingState = await db
        .select()
        .from(agentStates)
        .where(eq(agentStates.projectId, projectId))
        .limit(1);

      if (existingState.length > 0 && existingState[0].status === "running") {
        // Check if the workflow is stale (running for more than 10 minutes)
        const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
        const isStale = existingState[0].updatedAt && new Date(existingState[0].updatedAt) < tenMinutesAgo;
        
        if (isStale) {
          // Auto-reset stale workflows
          await db
            .update(agentStates)
            .set({ status: "failed", updatedAt: new Date() })
            .where(eq(agentStates.projectId, projectId));
          console.log(`[AgentRoutes] Auto-reset stale workflow for project ${projectId}`);
        } else {
          return res.status(409).json({
            error: "Workflow already running for this project",
            currentAgent: existingState[0].currentAgent,
          });
        }
      }

      const projectDocs = await db
        .select()
        .from(documents)
        .where(eq(documents.projectId, projectId));

      const imageExtensions = [".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".tiff"];
      const hasImages = projectDocs.some((doc) =>
        imageExtensions.some((ext) => doc.filename.toLowerCase().endsWith(ext))
      );

      res.json({
        message: "Multi-shot workflow started",
        projectId,
        status: "running",
        currentAgent: "intake",
        mode: "multishot",
      });

      multishotOrchestrator
        .runWorkflow(projectId, userId, { projectId, userId }, { hasImages })
        .then(async (result) => {
          console.log(
            `[AgentRoutes] Multi-shot workflow completed for project ${projectId}: ${result.success ? "success" : "failed"}`
          );
        })
        .catch(async (error) => {
          console.error(
            `[AgentRoutes] Multi-shot workflow failed for project ${projectId}:`,
            error
          );
        });
    } catch (error) {
      console.error("[AgentRoutes] Start multi-shot workflow error:", error);
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ error: "Invalid request", details: error.errors });
      }
      res.status(500).json({ error: "Failed to start multi-shot workflow" });
    }
  }
);

router.post(
  "/multishot/:projectId/cancel",
  authenticateToken,
  requirePermission(PERMISSIONS.PROJECT_EDIT),
  async (req: AuthRequest, res: Response) => {
    try {
      const { projectId } = req.params;

      await multishotOrchestrator.cancelWorkflow(projectId);

      res.json({
        message: "Multi-shot workflow cancelled",
        projectId,
        status: "cancelled",
      });
    } catch (error) {
      console.error("[AgentRoutes] Cancel multi-shot workflow error:", error);
      res.status(500).json({ error: "Failed to cancel multi-shot workflow" });
    }
  }
);

export default router;
