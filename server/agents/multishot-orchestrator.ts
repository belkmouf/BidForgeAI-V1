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
import { agentStates, agentExecutions, projects, projectSummaries } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { storage } from '../storage';
import { estimateAgentWorkflowCost } from '../lib/pricing';

interface ProjectSummaryContext {
  overview?: string;
  scopeOfWork?: string[];
  keyRequirements?: {
    budget?: string;
    timeline?: string;
    certifications?: string[];
    labor?: string;
    insurance?: string[];
    bonding?: string;
  };
  riskFactors?: string[];
  opportunities?: string[];
  missingInformation?: string[];
}

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
  hasExistingSketchAnalysis: boolean;
  startedAt: Date;
  updatedAt: Date;
  model?: string;
}

const workflowSteps: WorkflowStep[] = [
  { name: 'intake', agent: intakeAgent, required: true },
  { 
    name: 'sketch', 
    agent: sketchAgent, 
    required: false,
    condition: (state) => state.hasImages && !state.hasExistingSketchAnalysis
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

  private async getProjectSummary(projectId: string): Promise<ProjectSummaryContext | null> {
    try {
      const [summary] = await db
        .select()
        .from(projectSummaries)
        .where(eq(projectSummaries.projectId, projectId))
        .limit(1);
      
      if (!summary) return null;
      
      return {
        overview: summary.overview || undefined,
        scopeOfWork: summary.scopeOfWork || undefined,
        keyRequirements: summary.keyRequirements || undefined,
        riskFactors: summary.riskFactors || undefined,
        opportunities: summary.opportunities || undefined,
        missingInformation: summary.missingInformation || undefined,
      };
    } catch (error) {
      console.error('[MultishotWorkflow] Failed to fetch project summary:', error);
      return null;
    }
  }

  private formatProjectSummaryForPrompt(summary: ProjectSummaryContext): string {
    const sections: string[] = [];
    
    if (summary.overview) {
      sections.push(`## Project Overview\n${summary.overview}`);
    }
    
    if (summary.scopeOfWork?.length) {
      sections.push(`## Scope of Work\n${summary.scopeOfWork.map(s => `- ${s}`).join('\n')}`);
    }
    
    if (summary.keyRequirements) {
      const reqs: string[] = [];
      if (summary.keyRequirements.budget) reqs.push(`- Budget: ${summary.keyRequirements.budget}`);
      if (summary.keyRequirements.timeline) reqs.push(`- Timeline: ${summary.keyRequirements.timeline}`);
      if (summary.keyRequirements.labor) reqs.push(`- Labor Requirements: ${summary.keyRequirements.labor}`);
      if (summary.keyRequirements.bonding) reqs.push(`- Bonding: ${summary.keyRequirements.bonding}`);
      if (summary.keyRequirements.certifications?.length) {
        reqs.push(`- Required Certifications: ${summary.keyRequirements.certifications.join(', ')}`);
      }
      if (summary.keyRequirements.insurance?.length) {
        reqs.push(`- Insurance Requirements: ${summary.keyRequirements.insurance.join(', ')}`);
      }
      if (reqs.length) sections.push(`## Key Requirements\n${reqs.join('\n')}`);
    }
    
    if (summary.riskFactors?.length) {
      sections.push(`## Risk Factors\n${summary.riskFactors.map(r => `- ${r}`).join('\n')}`);
    }
    
    if (summary.opportunities?.length) {
      sections.push(`## Opportunities\n${summary.opportunities.map(o => `- ${o}`).join('\n')}`);
    }
    
    if (summary.missingInformation?.length) {
      sections.push(`## Missing Information (Address in Bid)\n${summary.missingInformation.map(m => `- ${m}`).join('\n')}`);
    }
    
    return sections.join('\n\n');
  }

  async runWorkflow(
    projectId: string,
    userId: number,
    initialInput: Record<string, unknown>,
    options?: { hasImages?: boolean }
  ): Promise<{ success: boolean; outputs: Record<string, AgentOutput>; messages: AgentMessage[] }> {
    const selectedModel = (initialInput.model as string) || 'anthropic';
    
    // Fetch and format project summary for inclusion in prompts
    const projectSummary = await this.getProjectSummary(projectId);
    const projectSummaryText = projectSummary 
      ? this.formatProjectSummaryForPrompt(projectSummary)
      : '';

    // Check for existing sketch analysis from document upload
    let existingSketchAnalysis: unknown[] = [];
    try {
      const [project] = await db
        .select()
        .from(projects)
        .where(eq(projects.id, projectId))
        .limit(1);
      
      const projectMetadata = project?.metadata as Record<string, unknown> | null;
      if (projectMetadata?.sketchAnalysis && Array.isArray(projectMetadata.sketchAnalysis)) {
        existingSketchAnalysis = projectMetadata.sketchAnalysis;
        console.log(`[Orchestrator] Found ${existingSketchAnalysis.length} existing sketch analysis from upload - will skip sketch agent`);
      }
    } catch (e) {
      console.warn('[Orchestrator] Could not check for existing sketch analysis:', e);
    }

    const hasExistingSketchAnalysis = existingSketchAnalysis.length > 0;
    const state: WorkflowState = {
      projectId,
      userId,
      currentStep: 0,
      status: 'running',
      messages: [],
      outputs: {},
      hasImages: options?.hasImages ?? false,
      hasExistingSketchAnalysis,
      startedAt: new Date(),
      updatedAt: new Date(),
      model: selectedModel,
    };

    await this.initializeWorkflowState(projectId, state);

    this.emitWithProject(projectId, {
      type: 'agent_start',
      agentName: 'workflow',
      iteration: 0,
      message: 'Starting multi-shot bid generation workflow',
    });

    let currentInput = {
      ...initialInput,
      projectSummary: projectSummaryText,
      projectSummaryData: projectSummary,
      sketchAnalysis: hasExistingSketchAnalysis ? existingSketchAnalysis : undefined,
    };
    
    for (const step of workflowSteps) {
      if (step.condition && !step.condition(state)) {
        // Provide informative skip messages based on the step
        let skipMessage = `Skipping ${step.name} agent (condition not met)`;
        if (step.name === 'sketch') {
          if (hasExistingSketchAnalysis) {
            skipMessage = `Using cached sketch analysis from upload (${existingSketchAnalysis.length} image(s))`;
          } else if (!state.hasImages) {
            skipMessage = 'No images to analyze - skipping sketch agent';
          }
        }
        this.emitWithProject(projectId, {
          type: 'agent_complete',
          agentName: step.name,
          iteration: 0,
          message: skipMessage,
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

    // Calculate generation time in seconds
    const generationTimeSeconds = Math.round((Date.now() - state.startedAt.getTime()) / 1000);

    // Save the generated bid to the database if workflow completed successfully
    let savedBidId: number | undefined;
    const generationData = state.outputs.generation?.data as Record<string, unknown> | undefined;
    const draft = generationData?.draft as { content?: string } | undefined;
    if (state.status === 'completed' && draft?.content) {
      try {
        if (draft.content) {
          // Get project details for company association
          const [project] = await db
            .select()
            .from(projects)
            .where(eq(projects.id, projectId))
            .limit(1);

          // Calculate estimated LMM cost for the agent workflow
          const modelUsed = state.model || 'grok';
          const lmmCost = estimateAgentWorkflowCost(modelUsed);
          
          const savedBid = await storage.createBid({
            projectId,
            companyId: project?.companyId ?? null,
            userId: userId,
            content: draft.content,
            rawContent: draft.content,
            instructions: 'Generated via AI Agent Workflow',
            tone: 'professional',
            model: modelUsed,
            searchMethod: 'agent-workflow',
            chunksUsed: 0,
            generationTimeSeconds,
            lmmCost,
          });
          savedBidId = savedBid.id;
          console.log(`[MultishotOrchestrator] Saved bid ${savedBid.id} for project ${projectId} (${generationTimeSeconds}s)`);
        }
      } catch (error) {
        console.error('[MultishotOrchestrator] Failed to save bid:', error);
      }
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
        generationTimeSeconds,
        bidId: savedBidId,
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
