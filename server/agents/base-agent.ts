import { z } from 'zod';

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
}

export const AgentContextSchema = z.object({
  projectId: z.string(),
  userId: z.number(),
  metadata: z.record(z.unknown()),
});

export abstract class BaseAgent {
  abstract name: string;
  abstract description: string;

  abstract execute(
    input: AgentInput,
    context: AgentContext
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
