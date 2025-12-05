import { StateGraph, END, Annotation } from '@langchain/langgraph';
import { BidWorkflowAnnotation, BidWorkflowState, AnalysisResultType } from './state';
import { BaseAgent, AgentRegistry, InMemoryAgentRegistry } from './base-agent';
import { db } from '../db';
import { agentExecutions, agentStates } from '@shared/schema';
import { eq } from 'drizzle-orm';

export interface OrchestratorConfig {
  maxRetries: number;
  minDoabilityScore: number;
  criticalRiskThreshold: boolean;
}

const DEFAULT_CONFIG: OrchestratorConfig = {
  maxRetries: 3,
  minDoabilityScore: 30,
  criticalRiskThreshold: true,
};

export class AgentOrchestrator {
  private graph: unknown = null;
  private registry: AgentRegistry;
  private config: OrchestratorConfig;
  private cancelledProjects: Set<string> = new Set();

  constructor(config: Partial<OrchestratorConfig> = {}) {
    this.registry = new InMemoryAgentRegistry();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  cancelWorkflow(projectId: string): void {
    this.cancelledProjects.add(projectId);
    console.log(`[Orchestrator] Workflow cancelled for project: ${projectId}`);
  }

  clearCancellation(projectId: string): void {
    this.cancelledProjects.delete(projectId);
  }

  private isCancelled(projectId: string): boolean {
    return this.cancelledProjects.has(projectId);
  }

  private async logExecution(
    projectId: string,
    agentName: string,
    status: string,
    input?: unknown,
    output?: unknown,
    error?: string,
    startTime?: Date
  ): Promise<void> {
    try {
      const durationMs = startTime ? Date.now() - startTime.getTime() : undefined;
      
      await db.insert(agentExecutions).values({
        projectId,
        agentName,
        status,
        input: input as Record<string, unknown>,
        output: output as Record<string, unknown>,
        error,
        startedAt: startTime || new Date(),
        completedAt: status === 'completed' || status === 'failed' ? new Date() : undefined,
        durationMs,
      });
    } catch (err) {
      console.error('[Orchestrator] Failed to log execution:', err);
    }
  }

  private async updateState(projectId: string, currentAgent: string, status: string, state: unknown): Promise<void> {
    try {
      await db
        .update(agentStates)
        .set({
          currentAgent,
          status,
          state: state as Record<string, unknown>,
          updatedAt: new Date(),
        })
        .where(eq(agentStates.projectId, projectId));
    } catch (err) {
      console.error('[Orchestrator] Failed to update state:', err);
    }
  }

  registerAgent(agent: BaseAgent): void {
    this.registry.register(agent);
    console.log(`[Orchestrator] Registered agent: ${agent.name}`);
  }

  private createAgentNode(agentName: string) {
    return async (state: BidWorkflowState): Promise<Partial<BidWorkflowState>> => {
      const agent = this.registry.get(agentName);
      const startTime = new Date();

      if (this.isCancelled(state.projectId)) {
        console.log(`[Orchestrator] Workflow cancelled for project: ${state.projectId}`);
        await this.logExecution(state.projectId, agentName, 'cancelled', undefined, undefined, 'Workflow cancelled by user', startTime);
        await this.updateState(state.projectId, agentName, 'cancelled', { ...state, status: 'cancelled' });
        return {
          status: 'cancelled',
          updatedAt: new Date(),
          logs: ['Workflow cancelled by user'],
        };
      }

      if (!agent) {
        await this.logExecution(state.projectId, agentName, 'failed', undefined, undefined, `Agent ${agentName} not found`);
        return {
          status: 'failed',
          errors: [`Agent ${agentName} not found`],
          updatedAt: new Date(),
        };
      }

      try {
        console.log(`[Orchestrator] Executing agent: ${agentName}`);
        await this.logExecution(state.projectId, agentName, 'running', state, undefined, undefined, startTime);
        await this.updateState(state.projectId, agentName, 'running', state);

        const result = await agent.execute(
          {
            type: agentName,
            data: state,
            context: {
              projectId: state.projectId,
              userId: state.userId,
              metadata: {},
            },
          },
          {
            projectId: state.projectId,
            userId: state.userId,
            metadata: {},
          }
        );

        if (!result.success) {
          await this.logExecution(state.projectId, agentName, 'failed', state, result, result.error, startTime);
          return {
            status: 'failed',
            errors: [result.error || 'Unknown error'],
            updatedAt: new Date(),
          };
        }

        const agentData = result.data as Partial<BidWorkflowState>;
        const agentLogs = agentData.logs || [];
        
        const newState = {
          ...agentData,
          currentAgent: agentName,
          status: 'running' as const,
          updatedAt: new Date(),
          logs: [...agentLogs, `${agentName} completed successfully`],
        };

        await this.logExecution(state.projectId, agentName, 'completed', state, newState, undefined, startTime);
        await this.updateState(state.projectId, agentName, 'running', { ...state, ...newState });

        return newState;
      } catch (error) {
        console.error(`[Orchestrator] Agent ${agentName} error:`, error);
        await this.logExecution(state.projectId, agentName, 'failed', state, undefined, (error as Error).message, startTime);
        return {
          status: 'failed',
          errors: [(error as Error).message],
          updatedAt: new Date(),
        };
      }
    };
  }

  private shouldProceedAfterAnalysis(state: BidWorkflowState): 'proceed' | 'reject' {
    const analysis = state.analysis as AnalysisResultType | undefined;

    if (!analysis) {
      console.log('[Orchestrator] No analysis found, rejecting');
      return 'reject';
    }

    if (this.config.criticalRiskThreshold && analysis.overallRiskLevel === 'Critical') {
      console.log('[Orchestrator] Critical risk level detected, rejecting');
      return 'reject';
    }

    if (analysis.doabilityScore < this.config.minDoabilityScore) {
      console.log(`[Orchestrator] Doability score ${analysis.doabilityScore} below threshold ${this.config.minDoabilityScore}, rejecting`);
      return 'reject';
    }

    console.log('[Orchestrator] Analysis passed, proceeding to generation');
    return 'proceed';
  }

  private shouldRetryGeneration(state: BidWorkflowState): 'pass' | 'retry' {
    const review = state.review;

    if (!review) {
      console.log('[Orchestrator] No review found, retrying');
      return 'retry';
    }

    if (review.passed) {
      console.log('[Orchestrator] Review passed');
      return 'pass';
    }

    if (review.attempts >= this.config.maxRetries) {
      console.log(`[Orchestrator] Max retries (${this.config.maxRetries}) reached, passing anyway`);
      return 'pass';
    }

    console.log(`[Orchestrator] Review failed, retry attempt ${review.attempts + 1}`);
    return 'retry';
  }

  private async completeNode(state: BidWorkflowState): Promise<Partial<BidWorkflowState>> {
    const startTime = new Date();

    if (this.isCancelled(state.projectId)) {
      return {
        status: 'cancelled',
        updatedAt: new Date(),
        logs: ['Workflow cancelled before completion'],
      };
    }

    await this.logExecution(state.projectId, 'complete', 'completed', state, undefined, undefined, startTime);
    await this.updateState(state.projectId, 'complete', 'completed', { ...state, status: 'completed', completedAt: new Date() });

    this.clearCancellation(state.projectId);

    return {
      status: 'completed',
      updatedAt: new Date(),
      completedAt: new Date(),
      logs: ['Workflow completed'],
    };
  }

  buildGraph(): void {
    const workflow = new StateGraph(BidWorkflowAnnotation)
      .addNode('intake_node', this.createAgentNode('intake'))
      .addNode('analysis_node', this.createAgentNode('analysis'))
      .addNode('decision_node', this.createAgentNode('decision'))
      .addNode('generation_node', this.createAgentNode('generation'))
      .addNode('review_node', this.createAgentNode('review'))
      .addNode('complete_node', this.completeNode.bind(this))
      .addEdge('__start__', 'intake_node')
      .addEdge('intake_node', 'analysis_node')
      .addConditionalEdges(
        'analysis_node',
        this.shouldProceedAfterAnalysis.bind(this),
        {
          proceed: 'decision_node',
          reject: 'complete_node',
        }
      )
      .addEdge('decision_node', 'generation_node')
      .addEdge('generation_node', 'review_node')
      .addConditionalEdges(
        'review_node',
        this.shouldRetryGeneration.bind(this),
        {
          pass: 'complete_node',
          retry: 'generation_node',
        }
      )
      .addEdge('complete_node', '__end__');

    this.graph = workflow.compile();
    console.log('[Orchestrator] Graph compiled successfully');
  }

  async execute(initialState: Partial<BidWorkflowState>): Promise<BidWorkflowState> {
    if (!this.graph) {
      this.buildGraph();
    }

    const state: BidWorkflowState = {
      projectId: initialState.projectId || '',
      userId: initialState.userId || 0,
      currentAgent: 'intake',
      status: 'pending',
      documents: [],
      errors: [],
      logs: [],
      startedAt: new Date(),
      updatedAt: new Date(),
      ...initialState,
    } as BidWorkflowState;

    console.log(`[Orchestrator] Starting workflow for project ${state.projectId}`);

    try {
      const compiledGraph = this.graph as { invoke: (state: BidWorkflowState) => Promise<BidWorkflowState> };
      const result = await compiledGraph.invoke(state);
      console.log(`[Orchestrator] Workflow completed with status: ${result.status}`);
      return result;
    } catch (error) {
      console.error('[Orchestrator] Workflow execution failed:', error);
      return {
        ...state,
        status: 'failed',
        errors: [(error as Error).message],
        updatedAt: new Date(),
      };
    }
  }

  async stream(initialState: Partial<BidWorkflowState>) {
    if (!this.graph) {
      this.buildGraph();
    }

    const state: BidWorkflowState = {
      projectId: initialState.projectId || '',
      userId: initialState.userId || 0,
      currentAgent: 'intake',
      status: 'pending',
      documents: [],
      errors: [],
      logs: [],
      startedAt: new Date(),
      updatedAt: new Date(),
      ...initialState,
    } as BidWorkflowState;

    const compiledGraph = this.graph as { stream: (state: BidWorkflowState) => AsyncGenerator<BidWorkflowState> };
    return compiledGraph.stream(state);
  }
}

export const orchestrator = new AgentOrchestrator();
