import { Router, Request, Response } from 'express';
import { masterOrchestrator, ProgressEvent } from '../agents/master-orchestrator';
import { db } from '../db';
import { agentStates } from '@shared/schema';
import { eq } from 'drizzle-orm';

const router = Router();

const activeConnections = new Map<string, Set<Response>>();

function addConnection(projectId: string, res: Response): void {
  if (!activeConnections.has(projectId)) {
    activeConnections.set(projectId, new Set());
  }
  activeConnections.get(projectId)!.add(res);
}

function removeConnection(projectId: string, res: Response): void {
  const connections = activeConnections.get(projectId);
  if (connections) {
    connections.delete(res);
    if (connections.size === 0) {
      activeConnections.delete(projectId);
    }
  }
}

function serializeEvent(event: ProgressEvent): string {
  return JSON.stringify({
    ...event,
    timestamp: event.timestamp instanceof Date ? event.timestamp.toISOString() : event.timestamp,
  });
}

function broadcastToProject(projectId: string, event: ProgressEvent): void {
  const connections = activeConnections.get(projectId);
  if (connections) {
    const data = serializeEvent(event);
    connections.forEach(res => {
      try {
        res.write(`data: ${data}\n\n`);
      } catch (error) {
        removeConnection(projectId, res);
      }
    });
  }
}

masterOrchestrator.on('progress', (event: ProgressEvent & { projectId?: string }) => {
  if (event.projectId) {
    broadcastToProject(event.projectId, event);
  }
});

router.get('/progress/:projectId', async (req: Request, res: Response) => {
  const { projectId } = req.params;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  res.write(`data: ${JSON.stringify({ type: 'connected', projectId, timestamp: new Date() })}\n\n`);

  addConnection(projectId, res);

  const heartbeat = setInterval(() => {
    try {
      res.write(`:heartbeat\n\n`);
    } catch (error) {
      clearInterval(heartbeat);
      removeConnection(projectId, res);
    }
  }, 30000);

  req.on('close', () => {
    clearInterval(heartbeat);
    removeConnection(projectId, res);
  });
});

router.get('/history/:projectId', async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    
    const [state] = await db
      .select()
      .from(agentStates)
      .where(eq(agentStates.projectId, projectId))
      .limit(1);

    if (!state) {
      return res.json({ messages: [], status: 'pending' });
    }

    const stateData = state.state as { messages?: unknown[] } | null;
    
    res.json({
      messages: stateData?.messages || [],
      status: state.status,
      currentAgent: state.currentAgent,
      updatedAt: state.updatedAt,
    });
  } catch (error) {
    console.error('[AgentProgress] Failed to get history:', error);
    res.status(500).json({ error: 'Failed to get agent progress history' });
  }
});

router.post('/send-event/:projectId', async (req: Request, res: Response) => {
  const { projectId } = req.params;
  const event: ProgressEvent = req.body;
  
  broadcastToProject(projectId, event);
  res.json({ success: true });
});

export default router;

export function emitProgressEvent(projectId: string, event: ProgressEvent): void {
  broadcastToProject(projectId, {
    ...event,
    timestamp: event.timestamp || new Date(),
  });
}
