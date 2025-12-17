import { MasterOrchestrator, masterOrchestrator, ProgressEvent, AgentMessage, MultishotFeedbackData } from './master-orchestrator';
import { emitProgressEvent } from '../routes/agent-progress';
import { BaseAgent, AgentInput, AgentContext, AgentOutput } from './base-agent';
import { MultishotAgent } from './multishot-agent';
import { sketchAgent } from './sketch-agent';
import { intakeAgent } from './intake-agent';
import { analysisAgent } from './analysis-agent';
import { decisionAgent } from './decision-agent';
import { generationAgent } from './generation-agent';
import { reviewAgent } from './review-agent';
import { db } from '../db';
import { agentStates, agentExecutions } from '@shared/schema';
import { eq } from 'drizzle-orm';

export interface WorkflowStep {
  name: string;
  agent: BaseAgent;
  required: boolean;
  condition?: (state: WorkflowState) => boolean;
}

export interface WorkflowState {
  projectId: string;
  userId: number;
  currentStep: number;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  messages: AgentMessage[];
  outputs: Record<string, AgentOutput>;
  hasImages: boolean;
  startedAt: Date;
  updatedAt: Date;
}

const workflowSteps: WorkflowStep[] = [
  { name: 'intake', agent: intakeAgent, required: true },
  { 
    name: 'sketch', 
    agent: sketchAgent, 
    required: false,
    condition: (state) => state.hasImages
  },
  { name: 'analysis', agent: analysisAgent, required: true },
  { name: 'decision', agent: decisionAgent, required: true },
  { name: 'generation', agent: generationAgent, required: true },
  { name: 'review', agent: reviewAgent, required: true },
];

export class MultishotWorkflowOrchestrator {
  private orchestrator: MasterOrchestrator;
  private readonly workflowTimeoutMs = 5 * 60 * 1000; // 5 minutes total workflow timeout
  
  constructor() {
    this.orchestrator = masterOrchestrator;
    this.setupProgressForwarding();
  }

  private setupProgressForwarding(): void {
    this.orchestrator.on('progress', (event: ProgressEvent & { projectId?: string }) => {
      if (event.projectId) {
        emitProgressEvent(event.projectId, event);
      }
    });
  }

  private emitWithProject(projectId: string, event: Omit<ProgressEvent, 'timestamp'>): void {
    const fullEvent: ProgressEvent & { projectId: string } = {
      ...event,
      projectId,
      timestamp: new Date(),
    };
    this.orchestrator.emit('progress', fullEvent);
  }

  async runWorkflow(
    projectId: string,
    userId: number,
    initialInput: Record<string, unknown>,
    options?: { hasImages?: boolean }
  ): Promise<{ success: boolean; outputs: Record<string, AgentOutput>; messages: AgentMessage[] }> {
    const state: WorkflowState = {
      projectId,
      userId,
      currentStep: 0,
      status: 'running',
      messages: [],
      outputs: {},
      hasImages: options?.hasImages ?? false,
      startedAt: new Date(),
      updatedAt: new Date(),
    };

    await this.initializeWorkflowState(projectId, state);

    this.emitWithProject(projectId, {
      type: 'agent_start',
      agentName: 'workflow',
      iteration: 0,
      message: 'Starting multi-shot bid generation workflow',
    });

    let currentInput = initialInput;
    
    for (const step of workflowSteps) {
      if (step.condition && !step.condition(state)) {
        this.emitWithProject(projectId, {
          type: 'agent_complete',
          agentName: step.name,
          iteration: 0,
          message: `Skipping ${step.name} agent (condition not met)`,
        });
        continue;
      }

      const cancelled = await this.checkCancellation(projectId);
      if (cancelled) {
        state.status = 'cancelled';
        break;
      }

      // Check workflow timeout
      const elapsedMs = Date.now() - state.startedAt.getTime();
      if (elapsedMs > this.workflowTimeoutMs) {
        this.emitWithProject(projectId, {
          type: 'error',
          agentName: 'workflow',
          iteration: state.currentStep,
          message: `Workflow timed out after ${Math.round(elapsedMs / 1000)}s. Completing with available results.`,
        });
        state.status = 'completed';
        break;
      }

      state.currentStep++;
      state.updatedAt = new Date();

      const context: AgentContext = {
        projectId,
        userId,
        metadata: {
          step: state.currentStep,
          totalSteps: workflowSteps.length,
          previousOutputs: state.outputs,
        },
      };

      const agentInput: AgentInput = {
        type: step.name,
        data: currentInput,
        context,
      };

      const result = await this.orchestrator.orchestrateAgent(
        step.name,
        async (feedbackData?: MultishotFeedbackData) => {
          if (feedbackData && step.agent instanceof MultishotAgent) {
            const multishotInput: AgentInput = {
              ...agentInput,
              data: {
                ...currentInput,
                refinementFeedback: feedbackData,
              },
            };
            return step.agent.execute(multishotInput, context);
          }
          return step.agent.execute(agentInput, context);
        },
        context
      );

      state.outputs[step.name] = result.output;
      state.messages.push(...result.messages);

      if (!result.output.success && step.required) {
        state.status = 'failed';
        this.emitWithProject(projectId, {
          type: 'error',
          agentName: step.name,
          iteration: result.iterations,
          message: `Required agent ${step.name} failed: ${result.output.error}`,
        });
        break;
      }

      if (result.output.success && result.output.data) {
        currentInput = {
          ...currentInput,
          ...result.output.data,
        };
      }

      if (step.name === 'decision' && result.output.data) {
        const decisionData = result.output.data as { shouldProceed?: boolean };
        if (decisionData.shouldProceed === false) {
          state.status = 'completed';
          this.emitWithProject(projectId, {
            type: 'workflow_complete',
            agentName: 'decision',
            iteration: result.iterations,
            message: 'Workflow terminated by decision agent (go/no-go decision: no-go)',
            data: { terminatedByDecision: true },
          });
          break;
        }
      }

      await this.updateWorkflowState(projectId, state);
    }

    if (state.status === 'running') {
      state.status = 'completed';
    }

    await this.finalizeWorkflowState(projectId, state);

    this.emitWithProject(projectId, {
      type: 'workflow_complete',
      agentName: 'workflow',
      iteration: state.currentStep,
      message: `Workflow ${state.status}`,
      data: { 
        status: state.status,
        stepsCompleted: state.currentStep,
        totalMessages: state.messages.length,
      },
    });

    return {
      success: state.status === 'completed',
      outputs: state.outputs,
      messages: state.messages,
    };
  }

  private async initializeWorkflowState(projectId: string, state: WorkflowState): Promise<void> {
    try {
      const existing = await db
        .select()
        .from(agentStates)
        .where(eq(agentStates.projectId, projectId))
        .limit(1);

      if (existing.length > 0) {
        await db
          .update(agentStates)
          .set({
            status: 'running',
            currentAgent: 'workflow',
            state: state as unknown as Record<string, unknown>,
            updatedAt: new Date(),
          })
          .where(eq(agentStates.projectId, projectId));
      } else {
        await db.insert(agentStates).values({
          projectId,
          currentAgent: 'workflow',
          status: 'running',
          state: state as unknown as Record<string, unknown>,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
    } catch (error) {
      console.error('[MultishotOrchestrator] Failed to initialize workflow state:', error);
    }
  }

  private async updateWorkflowState(projectId: string, state: WorkflowState): Promise<void> {
    try {
      await db
        .update(agentStates)
        .set({
          status: state.status,
          currentAgent: workflowSteps[state.currentStep - 1]?.name || 'workflow',
          state: state as unknown as Record<string, unknown>,
          updatedAt: new Date(),
        })
        .where(eq(agentStates.projectId, projectId));
    } catch (error) {
      console.error('[MultishotOrchestrator] Failed to update workflow state:', error);
    }
  }

  private async finalizeWorkflowState(projectId: string, state: WorkflowState): Promise<void> {
    try {
      await db
        .update(agentStates)
        .set({
          status: state.status,
          currentAgent: 'complete',
          state: state as unknown as Record<string, unknown>,
          updatedAt: new Date(),
        })
        .where(eq(agentStates.projectId, projectId));
    } catch (error) {
      console.error('[MultishotOrchestrator] Failed to finalize workflow state:', error);
    }
  }

  private async checkCancellation(projectId: string): Promise<boolean> {
    try {
      const [state] = await db
        .select()
        .from(agentStates)
        .where(eq(agentStates.projectId, projectId))
        .limit(1);

      return state?.status === 'cancelled';
    } catch (error) {
      return false;
    }
  }

  async cancelWorkflow(projectId: string): Promise<void> {
    await db
      .update(agentStates)
      .set({
        status: 'cancelled',
        updatedAt: new Date(),
      })
      .where(eq(agentStates.projectId, projectId));

    this.emitWithProject(projectId, {
      type: 'workflow_complete',
      agentName: 'workflow',
      iteration: 0,
      message: 'Workflow cancelled by user',
    });
  }
}

export const multishotOrchestrator = new MultishotWorkflowOrchestrator();
