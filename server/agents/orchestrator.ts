import { StateGraph, END, Annotation } from '@langchain/langgraph';
import { BidWorkflowAnnotation, BidWorkflowState, AnalysisResultType } from './state';
import { BaseAgent, AgentRegistry, InMemoryAgentRegistry } from './base-agent';

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

  constructor(config: Partial<OrchestratorConfig> = {}) {
    this.registry = new InMemoryAgentRegistry();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  registerAgent(agent: BaseAgent): void {
    this.registry.register(agent);
    console.log(`[Orchestrator] Registered agent: ${agent.name}`);
  }

  private createAgentNode(agentName: string) {
    return async (state: BidWorkflowState): Promise<Partial<BidWorkflowState>> => {
      const agent = this.registry.get(agentName);

      if (!agent) {
        return {
          status: 'failed',
          errors: [`Agent ${agentName} not found`],
          updatedAt: new Date(),
        };
      }

      try {
        console.log(`[Orchestrator] Executing agent: ${agentName}`);

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
          return {
            status: 'failed',
            errors: [result.error || 'Unknown error'],
            updatedAt: new Date(),
          };
        }

        const agentData = result.data as Partial<BidWorkflowState>;
        const agentLogs = agentData.logs || [];
        
        return {
          ...agentData,
          currentAgent: agentName,
          status: 'running',
          updatedAt: new Date(),
          logs: [...agentLogs, `${agentName} completed successfully`],
        };
      } catch (error) {
        console.error(`[Orchestrator] Agent ${agentName} error:`, error);
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

  private completeNode(_state: BidWorkflowState): Partial<BidWorkflowState> {
    return {
      status: 'completed',
      updatedAt: new Date(),
      completedAt: new Date(),
      logs: ['Workflow completed'],
    };
  }

  buildGraph(): void {
    const workflow = new StateGraph(BidWorkflowAnnotation)
      .addNode('intake', this.createAgentNode('intake'))
      .addNode('analysis', this.createAgentNode('analysis'))
      .addNode('decision', this.createAgentNode('decision'))
      .addNode('generation', this.createAgentNode('generation'))
      .addNode('review', this.createAgentNode('review'))
      .addNode('complete', this.completeNode.bind(this))
      .addEdge('__start__', 'intake')
      .addEdge('intake', 'analysis')
      .addConditionalEdges(
        'analysis',
        this.shouldProceedAfterAnalysis.bind(this),
        {
          proceed: 'decision',
          reject: 'complete',
        }
      )
      .addEdge('decision', 'generation')
      .addEdge('generation', 'review')
      .addConditionalEdges(
        'review',
        this.shouldRetryGeneration.bind(this),
        {
          pass: 'complete',
          retry: 'generation',
        }
      )
      .addEdge('complete', '__end__');

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
