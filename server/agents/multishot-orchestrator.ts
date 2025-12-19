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
import { conflictDetectionAgent, type ConflictOutput } from './conflict-detection-agent';
import { technicalSpecValidator, type TechValidationResult } from './technical-spec-validator';
import { ensembleReviewAgent } from './ensemble-review-agent';
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
  currentPhase: 'intake' | 'enrichment' | 'validation' | 'decision' | 'generation' | 'review';
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | 'hard_stop';
  messages: AgentMessage[];
  outputs: Record<string, AgentOutput>;
  hasImages: boolean;
  hasExistingSketchAnalysis: boolean;
  startedAt: Date;
  updatedAt: Date;
  model?: string;
  hardStopReason?: string;
}

const WORKFLOW_PHASES = ['intake', 'enrichment', 'validation', 'decision', 'generation', 'review'] as const;

export class MultishotWorkflowOrchestrator {
  private orchestrator: MasterOrchestrator;
  private readonly workflowTimeoutMs = 6 * 60 * 1000; // 6 minutes for parallel architecture
  
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
    const selectedModel = (initialInput.model as string) || 'deepseek';
    
    const projectSummary = await this.getProjectSummary(projectId);
    const projectSummaryText = projectSummary 
      ? this.formatProjectSummaryForPrompt(projectSummary)
      : '';

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
        console.log(`[Orchestrator] Found ${existingSketchAnalysis.length} existing sketch analysis from upload`);
      }
    } catch (e) {
      console.warn('[Orchestrator] Could not check for existing sketch analysis:', e);
    }

    const hasExistingSketchAnalysis = existingSketchAnalysis.length > 0;
    const state: WorkflowState = {
      projectId,
      userId,
      currentStep: 0,
      currentPhase: 'intake',
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
      message: 'Starting Parallelized Blackboard Architecture workflow',
      data: { model: selectedModel, architecture: 'blackboard-v2' },
    });

    let currentInput = {
      ...initialInput,
      projectSummary: projectSummaryText,
      projectSummaryData: projectSummary,
      sketchAnalysis: hasExistingSketchAnalysis ? existingSketchAnalysis : undefined,
    };

    try {
      // ═══════════════════════════════════════════════════════════════════════
      // PHASE 1: INTAKE (Sequential - must complete first)
      // ═══════════════════════════════════════════════════════════════════════
      state.currentPhase = 'intake';
      this.emitWithProject(projectId, {
        type: 'phase_start',
        agentName: 'intake',
        iteration: 0,
        message: 'Phase 1: Document Intake',
      });

      const intakeResult = await this.executeAgent('intake', intakeAgent, currentInput, state);
      if (!intakeResult.success) {
        state.status = 'failed';
        return this.finalizeWorkflow(projectId, state, 'Intake failed');
      }
      state.outputs.intake = { success: true, data: intakeResult.data };
      currentInput = { ...currentInput, ...intakeResult.data };

      if (await this.checkCancellation(projectId)) {
        state.status = 'cancelled';
        return this.finalizeWorkflow(projectId, state, 'Cancelled by user');
      }

      // ═══════════════════════════════════════════════════════════════════════
      // PHASE 2: PARALLEL ENRICHMENT (Sketch + Analysis run simultaneously)
      // ═══════════════════════════════════════════════════════════════════════
      state.currentPhase = 'enrichment';
      state.currentStep++;
      this.emitWithProject(projectId, {
        type: 'parallel_start',
        agentName: 'enrichment',
        iteration: 0,
        message: 'Phase 2: Parallel Enrichment (Sketch + Analysis)',
        data: { agents: ['sketch', 'analysis'] },
      });

      const shouldRunSketch = state.hasImages && !state.hasExistingSketchAnalysis;
      
      const enrichmentPromises: Promise<{ agent: string; result: AgentOutput }>[] = [];

      if (shouldRunSketch) {
        enrichmentPromises.push(
          this.executeAgent('sketch', sketchAgent, currentInput, state)
            .then(result => ({ agent: 'sketch', result: { success: result.success, data: result.data, error: result.error } }))
        );
      } else if (hasExistingSketchAnalysis) {
        this.emitWithProject(projectId, {
          type: 'agent_complete',
          agentName: 'sketch',
          iteration: 0,
          message: `Using cached sketch analysis (${existingSketchAnalysis.length} image(s))`,
        });
      }

      enrichmentPromises.push(
        this.executeAgent('analysis', analysisAgent, currentInput, state)
          .then(result => ({ agent: 'analysis', result: { success: result.success, data: result.data, error: result.error } }))
      );

      const enrichmentResults = await Promise.all(enrichmentPromises);

      for (const { agent, result } of enrichmentResults) {
        state.outputs[agent] = result;
        if (result.success && result.data) {
          currentInput = { ...currentInput, ...result.data };
        }
      }

      const analysisResult = enrichmentResults.find(r => r.agent === 'analysis');
      if (!analysisResult?.result.success) {
        state.status = 'failed';
        return this.finalizeWorkflow(projectId, state, 'Analysis failed');
      }

      this.emitWithProject(projectId, {
        type: 'parallel_complete',
        agentName: 'enrichment',
        iteration: 0,
        message: 'Parallel enrichment complete',
        data: { completedAgents: enrichmentResults.map(r => r.agent) },
      });

      if (await this.checkCancellation(projectId)) {
        state.status = 'cancelled';
        return this.finalizeWorkflow(projectId, state, 'Cancelled by user');
      }

      // ═══════════════════════════════════════════════════════════════════════
      // PHASE 3: VALIDATION GATES (Cross-Modal Conflict + Technical Spec)
      // ═══════════════════════════════════════════════════════════════════════
      state.currentPhase = 'validation';
      state.currentStep++;
      this.emitWithProject(projectId, {
        type: 'phase_start',
        agentName: 'validation',
        iteration: 0,
        message: 'Phase 3: Validation Gates (Conflict Detection + Technical Validation)',
        data: { agents: ['conflict-detection', 'technical-validator'] },
      });

      const validationPromises = [
        this.executeAgent('conflict-detection', conflictDetectionAgent, currentInput, state)
          .then(result => ({ agent: 'conflict-detection', result: { success: result.success, data: result.data, error: result.error } })),
        this.executeAgent('technical-validator', technicalSpecValidator, currentInput, state)
          .then(result => ({ agent: 'technical-validator', result: { success: result.success, data: result.data, error: result.error } })),
      ];

      const validationResults = await Promise.all(validationPromises);

      for (const { agent, result } of validationResults) {
        state.outputs[agent] = result;
        if (result.data) {
          currentInput = { ...currentInput, ...result.data };
        }
      }

      // Check for HARD STOP conditions
      for (const { agent, result } of validationResults) {
        const data = result.data as Record<string, unknown> | undefined;
        if (data?.hardStop) {
          state.status = 'hard_stop';
          state.hardStopReason = result.error || `Critical violation in ${agent}`;
          this.emitWithProject(projectId, {
            type: 'gate_stop',
            agentName: agent,
            iteration: 0,
            message: `HARD STOP: ${state.hardStopReason}`,
            data: { hardStop: true, agent, reason: state.hardStopReason },
          });
          return this.finalizeWorkflow(projectId, state, state.hardStopReason);
        }
      }

      this.emitWithProject(projectId, {
        type: 'validation_pass',
        agentName: 'validation',
        iteration: 0,
        message: 'All validation gates passed',
      });

      if (await this.checkCancellation(projectId)) {
        state.status = 'cancelled';
        return this.finalizeWorkflow(projectId, state, 'Cancelled by user');
      }

      // ═══════════════════════════════════════════════════════════════════════
      // PHASE 4: DECISION (Go/No-Go)
      // ═══════════════════════════════════════════════════════════════════════
      state.currentPhase = 'decision';
      state.currentStep++;
      this.emitWithProject(projectId, {
        type: 'phase_start',
        agentName: 'decision',
        iteration: 0,
        message: 'Phase 4: Strategic Go/No-Go Decision',
      });

      const decisionResult = await this.executeAgent('decision', decisionAgent, currentInput, state);
      state.outputs.decision = { success: decisionResult.success, data: decisionResult.data };
      
      if (decisionResult.success && decisionResult.data) {
        currentInput = { ...currentInput, ...decisionResult.data };
        const decisionData = decisionResult.data as { shouldProceed?: boolean };
        if (decisionData.shouldProceed === false) {
          state.status = 'completed';
          this.emitWithProject(projectId, {
            type: 'workflow_complete',
            agentName: 'decision',
            iteration: 0,
            message: 'Workflow terminated: Go/No-Go decision = NO-GO',
            data: { terminatedByDecision: true },
          });
          return this.finalizeWorkflow(projectId, state, 'No-go decision');
        }
      }

      if (await this.checkCancellation(projectId)) {
        state.status = 'cancelled';
        return this.finalizeWorkflow(projectId, state, 'Cancelled by user');
      }

      // ═══════════════════════════════════════════════════════════════════════
      // PHASE 5: BID GENERATION (With refinement loop)
      // ═══════════════════════════════════════════════════════════════════════
      state.currentPhase = 'generation';
      state.currentStep++;
      this.emitWithProject(projectId, {
        type: 'phase_start',
        agentName: 'generation',
        iteration: 0,
        message: 'Phase 5: Bid Generation (DeepSeek optimized)',
        data: { model: selectedModel, timeout: '150s' },
      });

      const context: AgentContext = {
        projectId,
        userId,
        metadata: { previousOutputs: state.outputs },
      };

      const generationResult = await this.orchestrator.orchestrateAgent(
        'generation',
        async (feedbackData?: MultishotFeedbackData) => {
          const agentInput: AgentInput = {
            type: 'generation',
            data: feedbackData ? { ...currentInput, refinementFeedback: feedbackData } : currentInput,
            context,
          };
          return generationAgent.execute(agentInput, context);
        },
        context
      );

      state.outputs.generation = generationResult.output;
      state.messages.push(...generationResult.messages);

      if (!generationResult.output.success) {
        state.status = 'failed';
        return this.finalizeWorkflow(projectId, state, 'Generation failed');
      }

      if (generationResult.output.data) {
        currentInput = { ...currentInput, ...generationResult.output.data };
      }

      if (await this.checkCancellation(projectId)) {
        state.status = 'cancelled';
        return this.finalizeWorkflow(projectId, state, 'Cancelled by user');
      }

      // ═══════════════════════════════════════════════════════════════════════
      // PHASE 6: ENSEMBLE REVIEW (Claude + Gemini, 85% threshold)
      // ═══════════════════════════════════════════════════════════════════════
      state.currentPhase = 'review';
      state.currentStep++;
      this.emitWithProject(projectId, {
        type: 'phase_start',
        agentName: 'ensemble-review',
        iteration: 0,
        message: 'Phase 6: Ensemble Review (Claude + Gemini, 85% threshold)',
        data: { models: ['claude-sonnet', 'gemini-flash'], threshold: 85 },
      });

      const reviewResult = await this.executeAgent('ensemble-review', ensembleReviewAgent, currentInput, state);
      state.outputs['ensemble-review'] = { success: reviewResult.success, data: reviewResult.data };

      if (reviewResult.data) {
        currentInput = { ...currentInput, ...reviewResult.data };
      }

      state.status = 'completed';

    } catch (error) {
      console.error('[MultishotOrchestrator] Workflow error:', error);
      state.status = 'failed';
      this.emitWithProject(projectId, {
        type: 'error',
        agentName: 'workflow',
        iteration: state.currentStep,
        message: `Workflow error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }

    return this.finalizeWorkflow(projectId, state);
  }

  private async executeAgent(
    name: string,
    agent: BaseAgent,
    input: Record<string, unknown>,
    state: WorkflowState
  ): Promise<{ success: boolean; data?: Record<string, unknown>; error?: string }> {
    const startTime = Date.now();
    
    this.emitWithProject(state.projectId, {
      type: 'agent_start',
      agentName: name,
      iteration: 0,
      message: `Starting ${name} agent`,
    });

    try {
      const context: AgentContext = {
        projectId: state.projectId,
        userId: state.userId,
        metadata: { previousOutputs: state.outputs },
      };

      const agentInput: AgentInput = {
        type: name,
        data: input,
        context,
      };

      const result = await agent.execute(agentInput, context);
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

      this.emitWithProject(state.projectId, {
        type: 'agent_complete',
        agentName: name,
        iteration: 0,
        message: `${name} completed in ${elapsed}s`,
        data: { elapsed, success: result.success },
      });

      return {
        success: result.success,
        data: result.data as Record<string, unknown> | undefined,
        error: result.error,
      };
    } catch (error) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      
      this.emitWithProject(state.projectId, {
        type: 'error',
        agentName: name,
        iteration: 0,
        message: `${name} failed after ${elapsed}s: ${errorMsg}`,
      });

      return { success: false, error: errorMsg };
    }
  }

  private async finalizeWorkflow(
    projectId: string,
    state: WorkflowState,
    reason?: string
  ): Promise<{ success: boolean; outputs: Record<string, AgentOutput>; messages: AgentMessage[] }> {
    const generationTimeSeconds = Math.round((Date.now() - state.startedAt.getTime()) / 1000);

    let savedBidId: number | undefined;
    const generationData = state.outputs.generation?.data as Record<string, unknown> | undefined;
    const draft = generationData?.draft as { content?: string } | undefined;
    
    if (state.status === 'completed' && draft?.content) {
      try {
        const [project] = await db
          .select()
          .from(projects)
          .where(eq(projects.id, projectId))
          .limit(1);

        const modelUsed = state.model || 'deepseek';
        const lmmCost = estimateAgentWorkflowCost(modelUsed);
        
        const savedBid = await storage.createBid({
          projectId,
          companyId: project?.companyId ?? null,
          userId: state.userId,
          content: draft.content,
          rawContent: draft.content,
          instructions: 'Generated via Blackboard Architecture v2',
          tone: 'professional',
          model: modelUsed,
          searchMethod: 'agent-workflow-v2',
          chunksUsed: 0,
          generationTimeSeconds,
          lmmCost,
        });
        savedBidId = savedBid.id;
        console.log(`[MultishotOrchestrator] Saved bid ${savedBid.id} for project ${projectId} (${generationTimeSeconds}s)`);
      } catch (error) {
        console.error('[MultishotOrchestrator] Failed to save bid:', error);
      }
    }

    await this.updateWorkflowStateFinal(projectId, state);

    this.emitWithProject(projectId, {
      type: 'workflow_complete',
      agentName: 'workflow',
      iteration: state.currentStep,
      message: reason || `Workflow ${state.status}`,
      data: { 
        status: state.status,
        phase: state.currentPhase,
        stepsCompleted: state.currentStep,
        totalMessages: state.messages.length,
        generationTimeSeconds,
        bidId: savedBidId,
        hardStop: state.status === 'hard_stop',
        hardStopReason: state.hardStopReason,
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

  private async updateWorkflowStateFinal(projectId: string, state: WorkflowState): Promise<void> {
    try {
      await db
        .update(agentStates)
        .set({
          status: state.status === 'hard_stop' ? 'failed' : state.status,
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
      const [agentState] = await db
        .select()
        .from(agentStates)
        .where(eq(agentStates.projectId, projectId))
        .limit(1);

      return agentState?.status === 'cancelled';
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
