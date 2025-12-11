import { z } from 'zod';
import type { BaseContextBuilder, ContextData, CompiledContext } from './context-builder';
import type { IMemoryManager, ToolOutputSummary } from './memory-manager';
import { ContextBuilderFactory } from './context-builder';
import { memoryManager } from './memory-manager';

export interface AgentContext {
  projectId: string;
  userId: number;
  metadata: Record<string, unknown>;
}

export interface AgentInput {
  type: string;
  data: unknown;
  context: AgentContext;
}

export interface AgentOutput {
  success: boolean;
  data?: unknown;
  error?: string;
  nextAgent?: string;
  summary?: ToolOutputSummary;
  artifactReference?: string;
}

export const AgentContextSchema = z.object({
  projectId: z.string(),
  userId: z.number(),
  metadata: z.record(z.unknown()),
});

export abstract class BaseAgent {
  abstract name: string;
  abstract description: string;
  
  protected contextBuilder: BaseContextBuilder;
  protected memoryManager: IMemoryManager;

  constructor(memoryManagerInstance?: IMemoryManager) {
    this.memoryManager = memoryManagerInstance || memoryManager;
  }

  // Initialize context builder after name is set
  protected initializeContextBuilder(): void {
    this.contextBuilder = ContextBuilderFactory.getBuilder(this.name);
  }

  async execute(
    input: AgentInput,
    context: AgentContext
  ): Promise<AgentOutput> {
    // Initialize context builder if not already done
    if (!this.contextBuilder) {
      this.initializeContextBuilder();
    }

    const startTime = Date.now();
    
    try {
      // Set working context
      await this.memoryManager.workingContext.set({
        agentName: this.name,
        projectId: context.projectId,
        currentState: input.data as Record<string, unknown>,
        inputData: input.data as Record<string, unknown>,
        intermediateResults: {},
        timestamp: new Date(),
      });

      // Prepare context data from memory tiers
      const contextData = await this.memoryManager.prepareContextData(
        context.projectId,
        this.name
      );

      // Compile context using Context Builder Pattern
      const compiledContext = await this.contextBuilder.compile({
        projectId: context.projectId,
        agentName: this.name,
        workingContext: contextData.workingContext,
        relevantArtifacts: contextData.relevantArtifacts,
        sessionSummary: contextData.sessionSummary,
        longTermMemory: contextData.longTermMemory,
      });

      // Execute agent-specific logic with compiled context
      const result = await this.executeWithCompiledContext(
        compiledContext,
        input,
        context
      );

      const duration = Date.now() - startTime;
      
      // Handle large data offloading
      let artifactRef: string | undefined;
      if (result.data) {
        artifactRef = await this.memoryManager.offloadLargeData(
          context.projectId,
          this.name,
          result.data,
          50 // threshold in lines
        ) || undefined;
      }

      // Record execution in session log
      await this.memoryManager.recordExecution(
        context.projectId,
        this.name,
        'execute',
        duration,
        result.success ? 'success' : 'failed',
        artifactRef || result.data
      );

      // Clear working context
      await this.memoryManager.workingContext.clear(context.projectId, this.name);

      return {
        ...result,
        artifactReference: artifactRef,
      };
      
    } catch (err) {
      const duration = Date.now() - startTime;
      this.error(`Failed execution after ${duration}ms`, err);
      
      // Record failed execution
      await this.memoryManager.recordExecution(
        context.projectId,
        this.name,
        'execute',
        duration,
        'failed',
        (err as Error).message
      );

      // Clear working context on error
      await this.memoryManager.workingContext.clear(context.projectId, this.name);
      
      return {
        success: false,
        error: (err as Error).message,
      };
    }
  }

  // Abstract method for agent-specific execution logic
  protected abstract executeWithCompiledContext(
    context: CompiledContext,
    input: AgentInput,
    agentContext: AgentContext
  ): Promise<AgentOutput>;

  protected log(message: string, data?: unknown) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${this.name}]`, message, data || '');
  }

  protected error(message: string, error?: unknown) {
    const timestamp = new Date().toISOString();
    console.error(`[${timestamp}] [${this.name}] ERROR:`, message, error || '');
  }

  protected async wrapExecution<T>(
    fn: () => Promise<T>,
    operationName: string
  ): Promise<T> {
    this.log(`Starting ${operationName}`);
    const startTime = Date.now();

    try {
      const result = await fn();
      const duration = Date.now() - startTime;
      this.log(`Completed ${operationName} in ${duration}ms`);
      return result;
    } catch (err) {
      const duration = Date.now() - startTime;
      this.error(`Failed ${operationName} after ${duration}ms`, err);
      throw err;
    }
  }

  // Helper method for updating working context during execution
  protected async updateWorkingContext(
    projectId: string,
    updates: Record<string, unknown>
  ): Promise<void> {
    await this.memoryManager.workingContext.update(projectId, this.name, {
      intermediateResults: updates,
      timestamp: new Date(),
    });
  }

  // Helper method for storing large intermediate results
  protected async storeIntermediateArtifact(
    projectId: string,
    data: unknown,
    type: string = 'intermediate'
  ): Promise<string> {
    return await this.memoryManager.artifactStore.store(
      projectId,
      this.name,
      type,
      data
    );
  }

  // Helper method for retrieving artifacts
  protected async retrieveArtifact(artifactId: string): Promise<unknown | null> {
    return await this.memoryManager.artifactStore.retrieve(artifactId);
  }
}

export interface AgentRegistry {
  register(agent: BaseAgent): void;
  get(name: string): BaseAgent | undefined;
  list(): BaseAgent[];
}

export class InMemoryAgentRegistry implements AgentRegistry {
  private agents: Map<string, BaseAgent> = new Map();

  register(agent: BaseAgent): void {
    this.agents.set(agent.name, agent);
  }

  get(name: string): BaseAgent | undefined {
    return this.agents.get(name);
  }

  list(): BaseAgent[] {
    return Array.from(this.agents.values());
  }
}