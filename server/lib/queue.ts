import Redis from 'ioredis';
import { EventEmitter } from 'events';

// Job Priority Types
export type JobPriority = 'low' | 'normal' | 'high' | 'critical';

export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';

// Job Interface
export interface Job {
  id: string;
  type: string;
  data: any;
  status: JobStatus;
  priority: JobPriority;
  attempts: number;
  maxAttempts: number;
  result?: any;
  error?: string;
  userId?: number;
  projectId?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}

export type JobProcessor = (job: Job, data: any) => Promise<any>;

// In-memory Job Queue (fallback when Redis unavailable)
export class JobQueue extends EventEmitter {
  private name: string;
  private jobs: Map<string, Job> = new Map();
  private processors: Map<string, JobProcessor> = new Map();
  private isRunning = false;
  private processingInterval: NodeJS.Timeout | null = null;

  constructor(name: string) {
    super();
    this.name = name;
  }

  addProcessor(jobType: string, processor: JobProcessor): void {
    this.processors.set(jobType, processor);
  }

  async add(
    type: string,
    data: any,
    options: {
      priority?: JobPriority;
      userId?: number;
      projectId?: string;
      metadata?: Record<string, any>;
      maxAttempts?: number;
    } = {}
  ): Promise<string> {
    const id = `job_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const job: Job = {
      id,
      type,
      data,
      status: 'pending',
      priority: options.priority || 'normal',
      attempts: 0,
      maxAttempts: options.maxAttempts || 3,
      userId: options.userId,
      projectId: options.projectId,
      metadata: options.metadata,
      createdAt: new Date(),
    };
    this.jobs.set(id, job);
    return id;
  }

  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.processingInterval = setInterval(() => this.processNextJob(), 100);
  }

  async stop(): Promise<void> {
    this.isRunning = false;
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
  }

  private async processNextJob(): Promise<void> {
    const pendingJobs = Array.from(this.jobs.values())
      .filter(j => j.status === 'pending')
      .sort((a, b) => {
        const priorityOrder = { critical: 0, high: 1, normal: 2, low: 3 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      });

    const job = pendingJobs[0];
    if (!job) return;

    const processor = this.processors.get(job.type);
    if (!processor) return;

    job.status = 'processing';
    job.startedAt = new Date();
    job.attempts++;

    try {
      const result = await processor(job, job.data);
      job.status = 'completed';
      job.result = result;
      job.completedAt = new Date();
      this.emit('job:completed', job, result);
    } catch (error: any) {
      if (job.attempts < job.maxAttempts) {
        job.status = 'pending';
        this.emit('job:retry', job, error);
      } else {
        job.status = 'failed';
        job.error = error.message;
        job.completedAt = new Date();
        this.emit('job:failed', job, error);
      }
    }
  }

  async getJob(jobId: string): Promise<Job | null> {
    return this.jobs.get(jobId) || null;
  }

  async cancelJob(jobId: string): Promise<boolean> {
    const job = this.jobs.get(jobId);
    if (job && job.status === 'pending') {
      job.status = 'cancelled';
      return true;
    }
    return false;
  }

  getJobs(options: {
    userId?: number;
    projectId?: string;
    status?: JobStatus;
    type?: string;
    limit?: number;
  } = {}): Job[] {
    let jobs = Array.from(this.jobs.values());
    if (options.userId) jobs = jobs.filter(j => j.userId === options.userId);
    if (options.projectId) jobs = jobs.filter(j => j.projectId === options.projectId);
    if (options.status) jobs = jobs.filter(j => j.status === options.status);
    if (options.type) jobs = jobs.filter(j => j.type === options.type);
    if (options.limit) jobs = jobs.slice(0, options.limit);
    return jobs;
  }

  getStats(): { pending: number; processing: number; completed: number; failed: number } {
    const jobs = Array.from(this.jobs.values());
    return {
      pending: jobs.filter(j => j.status === 'pending').length,
      processing: jobs.filter(j => j.status === 'processing').length,
      completed: jobs.filter(j => j.status === 'completed').length,
      failed: jobs.filter(j => j.status === 'failed').length,
    };
  }

  async cleanup(olderThanMs: number): Promise<number> {
    const cutoff = Date.now() - olderThanMs;
    let cleaned = 0;
    for (const [id, job] of Array.from(this.jobs.entries())) {
      if ((job.status === 'completed' || job.status === 'failed') && job.createdAt.getTime() < cutoff) {
        this.jobs.delete(id);
        cleaned++;
      }
    }
    return cleaned;
  }
}

// Create queue instances
export const aiQueue = new JobQueue('ai');
export const documentQueue = new JobQueue('document');
export const notificationQueue = new JobQueue('notification');

let publisher: Redis | null = null;
let workerConnection: Redis | null = null;
let isPublisherConnected = false;
let isWorkerConnected = false;

function getRedisConfig() {
  return {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
    maxRetriesPerRequest: 3,
    retryDelayOnFailover: 100,
    lazyConnect: true,
    connectTimeout: 5000,
  };
}

function createConnection(name: string): Redis {
  const connection = new Redis(getRedisConfig());
  
  connection.on('connect', () => {
    console.log(`Redis ${name} connected`);
  });
  
  connection.on('error', (err) => {
    console.warn(`Redis ${name} error:`, err.message);
  });
  
  connection.on('close', () => {
    console.log(`Redis ${name} connection closed`);
  });
  
  return connection;
}

export async function initializeQueue(): Promise<boolean> {
  if (isPublisherConnected && publisher) {
    return true;
  }

  try {
    publisher = createConnection('publisher');
    await publisher.connect();
    isPublisherConnected = true;
    
    workerConnection = createConnection('worker');
    await workerConnection.connect();
    isWorkerConnected = true;
    
    return true;
  } catch (error: any) {
    console.warn('Redis not available, event queue disabled:', error.message);
    publisher = null;
    workerConnection = null;
    isPublisherConnected = false;
    isWorkerConnected = false;
    return false;
  }
}

export function isQueueAvailable(): boolean {
  return isPublisherConnected && publisher !== null;
}

export async function publishEvent(eventType: string, payload: any): Promise<boolean> {
  if (!isPublisherConnected || !publisher) {
    return false;
  }

  try {
    const message = JSON.stringify({
      type: eventType,
      payload,
      timestamp: new Date().toISOString(),
      id: generateEventId(),
    });
    
    await publisher.publish(eventType, message);
    return true;
  } catch (error: any) {
    console.error(`Failed to publish event ${eventType}:`, error.message);
    return false;
  }
}

export async function pushToQueue(queueName: string, payload: any): Promise<boolean> {
  if (!isPublisherConnected || !publisher) {
    return false;
  }

  try {
    const message = JSON.stringify({
      payload,
      timestamp: new Date().toISOString(),
      id: generateEventId(),
    });
    
    await publisher.lpush(queueName, message);
    return true;
  } catch (error: any) {
    console.error(`Failed to push to queue ${queueName}:`, error.message);
    return false;
  }
}

export function subscribeToEvent(eventType: string, handler: (payload: any) => void): (() => void) | null {
  if (!process.env.REDIS_HOST) {
    return null;
  }

  try {
    const subscriber = createConnection(`subscriber-${eventType}`);
    
    subscriber.subscribe(eventType, (err, count) => {
      if (err) {
        console.error(`Failed to subscribe to ${eventType}:`, err.message);
        return;
      }
      console.log(`Subscribed to ${eventType} (${count} total subscriptions)`);
    });
    
    subscriber.on('message', (channel, message) => {
      try {
        const parsed = JSON.parse(message);
        handler(parsed.payload || parsed);
      } catch (error: any) {
        console.error(`Error processing message from ${channel}:`, error.message);
      }
    });

    return () => {
      subscriber.unsubscribe(eventType);
      subscriber.disconnect();
    };
  } catch (error: any) {
    console.error(`Failed to create subscriber for ${eventType}:`, error.message);
    return null;
  }
}

export async function processQueue(
  queueName: string, 
  handler: (payload: any) => Promise<void>,
  options: { timeout?: number } = {}
): Promise<void> {
  if (!isWorkerConnected || !workerConnection) {
    return;
  }

  const timeout = options.timeout || 5;
  
  try {
    const result = await workerConnection.brpop(queueName, timeout);
    
    if (result) {
      const [, message] = result;
      const parsed = JSON.parse(message);
      await handler(parsed.payload || parsed);
    }
  } catch (error: any) {
    console.error(`Error processing queue ${queueName}:`, error.message);
  }
}

function generateEventId(): string {
  return `evt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

export async function closeQueue(): Promise<void> {
  if (publisher) {
    await publisher.quit();
    publisher = null;
    isPublisherConnected = false;
  }
  if (workerConnection) {
    await workerConnection.quit();
    workerConnection = null;
    isWorkerConnected = false;
  }
}

export const EVENTS = {
  INTAKE_COMPLETE: 'workflow:intake:complete',
  ANALYSIS_START: 'workflow:analysis:start',
  ANALYSIS_COMPLETE: 'workflow:analysis:complete',
  DECISION_START: 'workflow:decision:start',
  DECISION_COMPLETE: 'workflow:decision:complete',
  GENERATION_START: 'workflow:generation:start',
  GENERATION_COMPLETE: 'workflow:generation:complete',
  REVIEW_START: 'workflow:review:start',
  REVIEW_COMPLETE: 'workflow:review:complete',
  WORKFLOW_ERROR: 'workflow:error',
} as const;

export const QUEUES = {
  BID_GENERATION: 'queue:bid:generation',
  DOCUMENT_PROCESSING: 'queue:document:processing',
  ANALYSIS: 'queue:analysis',
  NOTIFICATIONS: 'queue:notifications',
} as const;
