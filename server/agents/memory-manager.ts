import { z } from 'zod';

// Working Context (Tier 1)
export const WorkingContextSchema = z.object({
  agentName: z.string(),
  projectId: z.string(),
  currentState: z.record(z.unknown()),
  inputData: z.record(z.unknown()),
  intermediateResults: z.record(z.unknown()),
  timestamp: z.date(),
});

// Session Log (Tier 2)
export const SessionEntrySchema = z.object({
  agentName: z.string(),
  action: z.string(),
  summary: z.string(),
  keyData: z.record(z.unknown()),
  duration: z.number(),
  status: z.enum(['success', 'failed', 'cancelled']),
  timestamp: z.date(),
});

// Long-Term Memory (Tier 3)
export const LongTermMemorySchema = z.object({
  projectId: z.string(),
  projectSummary: z.string(),
  keyInsights: z.array(z.string()),
  persistentContext: z.record(z.unknown()),
  learningPatterns: z.record(z.unknown()),
  lastUpdated: z.date(),
});

// Artifact Store (Tier 4)
export const ArtifactMetadataSchema = z.object({
  id: z.string(),
  type: z.string(),
  projectId: z.string(),
  agentName: z.string(),
  size: z.number(),
  contentHash: z.string(),
  createdAt: z.date(),
  accessCount: z.number(),
  lastAccessed: z.date().optional(),
});

export type WorkingContext = z.infer<typeof WorkingContextSchema>;
export type SessionEntry = z.infer<typeof SessionEntrySchema>;
export type LongTermMemory = z.infer<typeof LongTermMemorySchema>;
export type ArtifactMetadata = z.infer<typeof ArtifactMetadataSchema>;

// Memory tier interfaces
export interface IWorkingContextManager {
  get(projectId: string, agentName: string): Promise<WorkingContext | null>;
  set(context: WorkingContext): Promise<void>;
  clear(projectId: string, agentName: string): Promise<void>;
  update(projectId: string, agentName: string, updates: Partial<WorkingContext>): Promise<void>;
}

export interface ISessionLogManager {
  append(projectId: string, entry: SessionEntry): Promise<void>;
  getRecent(projectId: string, limit?: number): Promise<SessionEntry[]>;
  summarize(projectId: string): Promise<string>;
  clear(projectId: string): Promise<void>;
}

export interface ILongTermMemoryManager {
  get(projectId: string): Promise<LongTermMemory | null>;
  set(memory: LongTermMemory): Promise<void>;
  update(projectId: string, updates: Partial<LongTermMemory>): Promise<void>;
  addInsight(projectId: string, insight: string): Promise<void>;
}

export interface IArtifactStore {
  store(projectId: string, agentName: string, type: string, data: unknown): Promise<string>;
  retrieve(artifactId: string): Promise<unknown | null>;
  getMetadata(artifactId: string): Promise<ArtifactMetadata | null>;
  list(projectId: string, agentName?: string): Promise<ArtifactMetadata[]>;
  delete(artifactId: string): Promise<void>;
}

export interface IMemoryManager {
  workingContext: IWorkingContextManager;
  sessionLog: ISessionLogManager;
  longTermMemory: ILongTermMemoryManager;
  artifactStore: IArtifactStore;
  
  prepareContextData(projectId: string, agentName: string): Promise<{
    workingContext: Record<string, unknown>;
    sessionSummary: string;
    longTermMemory: Record<string, unknown>;
    relevantArtifacts: string[];
  }>;
  
  recordExecution(projectId: string, agentName: string, action: string, duration: number, status: 'success' | 'failed' | 'cancelled', data?: unknown): Promise<void>;
  offloadLargeData(projectId: string, agentName: string, data: unknown, threshold?: number): Promise<string | null>;
}

// In-memory implementations
export class InMemoryWorkingContextManager implements IWorkingContextManager {
  private contexts = new Map<string, WorkingContext>();
  private getKey(projectId: string, agentName: string): string {
    return `${projectId}:${agentName}`;
  }
  async get(projectId: string, agentName: string): Promise<WorkingContext | null> {
    return this.contexts.get(this.getKey(projectId, agentName)) || null;
  }
  async set(context: WorkingContext): Promise<void> {
    this.contexts.set(this.getKey(context.projectId, context.agentName), context);
  }
  async clear(projectId: string, agentName: string): Promise<void> {
    this.contexts.delete(this.getKey(projectId, agentName));
  }
  async update(projectId: string, agentName: string, updates: Partial<WorkingContext>): Promise<void> {
    const key = this.getKey(projectId, agentName);
    const existing = this.contexts.get(key);
    if (existing) {
      this.contexts.set(key, { ...existing, ...updates, timestamp: new Date() });
    }
  }
}

export class InMemorySessionLogManager implements ISessionLogManager {
  private sessions = new Map<string, SessionEntry[]>();
  async append(projectId: string, entry: SessionEntry): Promise<void> {
    if (!this.sessions.has(projectId)) {
      this.sessions.set(projectId, []);
    }
    this.sessions.get(projectId)!.push(entry);
  }
  async getRecent(projectId: string, limit = 10): Promise<SessionEntry[]> {
    const entries = this.sessions.get(projectId) || [];
    return entries.slice(-limit);
  }
  async summarize(projectId: string): Promise<string> {
    const entries = await this.getRecent(projectId, 5);
    if (entries.length === 0) return 'No recent session activity';
    return entries.map(entry => `${entry.agentName}(${entry.action}): ${entry.summary} [${entry.status}]`).join('\n');
  }
  async clear(projectId: string): Promise<void> {
    this.sessions.delete(projectId);
  }
}

export class InMemoryLongTermMemoryManager implements ILongTermMemoryManager {
  private memories = new Map<string, LongTermMemory>();
  async get(projectId: string): Promise<LongTermMemory | null> {
    return this.memories.get(projectId) || null;
  }
  async set(memory: LongTermMemory): Promise<void> {
    this.memories.set(memory.projectId, memory);
  }
  async update(projectId: string, updates: Partial<LongTermMemory>): Promise<void> {
    const existing = this.memories.get(projectId);
    if (existing) {
      this.memories.set(projectId, { ...existing, ...updates, lastUpdated: new Date() });
    }
  }
  async addInsight(projectId: string, insight: string): Promise<void> {
    const memory = await this.get(projectId);
    if (memory) {
      memory.keyInsights.push(insight);
      memory.lastUpdated = new Date();
      await this.set(memory);
    }
  }
}

export class InMemoryArtifactStore implements IArtifactStore {
  private artifacts = new Map<string, { data: unknown; metadata: ArtifactMetadata }>();
  private generateId(): string {
    return `artifact_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  async store(projectId: string, agentName: string, type: string, data: unknown): Promise<string> {
    const id = this.generateId();
    const metadata: ArtifactMetadata = {
      id, type, projectId, agentName,
      size: JSON.stringify(data).length,
      contentHash: btoa(JSON.stringify(data)).substring(0, 16),
      createdAt: new Date(),
      accessCount: 0,
    };
    this.artifacts.set(id, { data, metadata });
    return id;
  }
  async retrieve(artifactId: string): Promise<unknown | null> {
    const artifact = this.artifacts.get(artifactId);
    if (artifact) {
      artifact.metadata.accessCount++;
      artifact.metadata.lastAccessed = new Date();
      return artifact.data;
    }
    return null;
  }
  async getMetadata(artifactId: string): Promise<ArtifactMetadata | null> {
    return this.artifacts.get(artifactId)?.metadata || null;
  }
  async list(projectId: string, agentName?: string): Promise<ArtifactMetadata[]> {
    const results: ArtifactMetadata[] = [];
    for (const [, artifact] of this.artifacts) {
      if (artifact.metadata.projectId === projectId && (!agentName || artifact.metadata.agentName === agentName)) {
        results.push(artifact.metadata);
      }
    }
    return results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
  async delete(artifactId: string): Promise<void> {
    this.artifacts.delete(artifactId);
  }
}

export class MemoryManager implements IMemoryManager {
  public workingContext: IWorkingContextManager;
  public sessionLog: ISessionLogManager;
  public longTermMemory: ILongTermMemoryManager;
  public artifactStore: IArtifactStore;

  constructor() {
    this.workingContext = new InMemoryWorkingContextManager();
    this.sessionLog = new InMemorySessionLogManager();
    this.longTermMemory = new InMemoryLongTermMemoryManager();
    this.artifactStore = new InMemoryArtifactStore();
  }

  async prepareContextData(projectId: string, agentName: string): Promise<{
    workingContext: Record<string, unknown>;
    sessionSummary: string;
    longTermMemory: Record<string, unknown>;
    relevantArtifacts: string[];
  }> {
    const [workingCtx, sessionSummary, longTerm, artifacts] = await Promise.all([
      this.workingContext.get(projectId, agentName),
      this.sessionLog.summarize(projectId),
      this.longTermMemory.get(projectId),
      this.artifactStore.list(projectId, agentName),
    ]);

    return {
      workingContext: workingCtx?.currentState || {},
      sessionSummary,
      longTermMemory: longTerm?.persistentContext || {},
      relevantArtifacts: artifacts.slice(0, 5).map(a => a.id),
    };
  }

  async recordExecution(projectId: string, agentName: string, action: string, duration: number, status: 'success' | 'failed' | 'cancelled', data?: unknown): Promise<void> {
    const summary = `${action} ${status} in ${duration}ms`;
    const entry: SessionEntry = {
      agentName, action, summary,
      keyData: data ? this.extractKeyData(data) : {},
      duration, status, timestamp: new Date(),
    };
    await this.sessionLog.append(projectId, entry);
  }

  async offloadLargeData(projectId: string, agentName: string, data: unknown, threshold = 50): Promise<string | null> {
    const dataString = JSON.stringify(data);
    const lines = dataString.split('\n').length;
    if (lines > threshold) {
      return await this.artifactStore.store(projectId, agentName, 'large_output', data);
    }
    return null;
  }

  private extractKeyData(data: unknown): Record<string, unknown> {
    if (typeof data === 'object' && data !== null) {
      const obj = data as Record<string, unknown>;
      const keyData: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(obj)) {
        if (typeof value === 'string' && value.length < 200) {
          keyData[key] = value;
        } else if (typeof value === 'number' || typeof value === 'boolean') {
          keyData[key] = value;
        }
      }
      return keyData;
    }
    return {};
  }
}

export const memoryManager = new MemoryManager();