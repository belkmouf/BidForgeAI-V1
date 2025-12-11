import { JobQueue, aiQueue, documentQueue, notificationQueue, Job, JobPriority } from './queue.js';
import { jobProcessors, JOB_TYPES, BidGenerationData, RFPAnalysisData, DocumentProcessingData } from './job-processors.js';
import { logger, logContext } from './logger.js';

export class JobManager {
  private queues: Map<string, JobQueue> = new Map();
  private isInitialized = false;

  constructor() {
    // Register queues
    this.queues.set('ai', aiQueue);
    this.queues.set('document', documentQueue);
    this.queues.set('notification', notificationQueue);
  }

  /**
   * Initialize job manager and start all queues
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Register all job processors
      for (const [jobType, processor] of Object.entries(jobProcessors)) {
        // Register processor with appropriate queue
        const queueName = this.getQueueForJobType(jobType);
        const queue = this.queues.get(queueName);
        
        if (queue) {
          queue.addProcessor(jobType, processor);
        }
      }

      // Start all queues
      for (const [name, queue] of Array.from(this.queues.entries())) {
        queue.start();
        logger.info(`Started job queue: ${name}`);
      }

      // Set up queue event listeners
      this.setupEventListeners();

      this.isInitialized = true;
      logger.info('Job manager initialized successfully');

    } catch (error: any) {
      logger.error('Failed to initialize job manager', { error: error.message });
      throw error;
    }
  }

  /**
   * Shutdown job manager and stop all queues
   */
  async shutdown(): Promise<void> {
    if (!this.isInitialized) {
      return;
    }

    try {
      // Stop all queues
      for (const [name, queue] of Array.from(this.queues.entries())) {
        await queue.stop();
        logger.info(`Stopped job queue: ${name}`);
      }

      this.isInitialized = false;
      logger.info('Job manager shut down successfully');

    } catch (error: any) {
      logger.error('Error during job manager shutdown', { error: error.message });
      throw error;
    }
  }

  /**
   * Add a bid generation job
   */
  async addBidGenerationJob(
    data: BidGenerationData,
    options: { priority?: JobPriority } = {}
  ): Promise<string> {
    const queue = this.queues.get('ai');
    if (!queue) {
      throw new Error('AI queue not available');
    }

    return await queue.add(JOB_TYPES.BID_GENERATION, data, {
      priority: options.priority || 'normal',
      userId: data.userId,
      projectId: data.projectId,
      metadata: {
        model: data.model,
        companyId: data.companyId
      }
    });
  }

  /**
   * Add an RFP analysis job
   */
  async addRFPAnalysisJob(
    data: RFPAnalysisData,
    options: { priority?: JobPriority } = {}
  ): Promise<string> {
    const queue = this.queues.get('ai');
    if (!queue) {
      throw new Error('AI queue not available');
    }

    return await queue.add(JOB_TYPES.RFP_ANALYSIS, data, {
      priority: options.priority || 'normal',
      userId: data.userId,
      projectId: data.projectId,
      metadata: {
        documentCount: data.documentIds.length,
        companyId: data.companyId
      }
    });
  }

  /**
   * Add a document processing job
   */
  async addDocumentProcessingJob(
    data: DocumentProcessingData,
    options: { priority?: JobPriority } = {}
  ): Promise<string> {
    const queue = this.queues.get('document');
    if (!queue) {
      throw new Error('Document queue not available');
    }

    return await queue.add(JOB_TYPES.DOCUMENT_PROCESSING, data, {
      priority: options.priority || 'high', // Document processing is high priority
      userId: data.userId,
      projectId: data.projectId,
      metadata: {
        documentId: data.documentId,
        companyId: data.companyId
      }
    });
  }

  /**
   * Add a notification job
   */
  async addNotificationJob(
    data: {
      type: 'email' | 'webhook' | 'push';
      recipient: string;
      message: any;
      metadata?: any;
    },
    options: { priority?: JobPriority; userId?: number } = {}
  ): Promise<string> {
    const queue = this.queues.get('notification');
    if (!queue) {
      throw new Error('Notification queue not available');
    }

    return await queue.add(JOB_TYPES.NOTIFICATION_SEND, data, {
      priority: options.priority || 'normal',
      userId: options.userId,
      metadata: data.metadata
    });
  }

  /**
   * Add a cache warmup job
   */
  async addCacheWarmupJob(priority: JobPriority = 'low'): Promise<string> {
    const queue = this.queues.get('ai'); // Use AI queue for cache warmup
    if (!queue) {
      throw new Error('AI queue not available');
    }

    return await queue.add(JOB_TYPES.CACHE_WARMUP, {}, {
      priority,
      metadata: { scheduledWarmup: true }
    });
  }

  /**
   * Get job status by ID
   */
  async getJobStatus(jobId: string): Promise<Job | null> {
    // Check all queues for the job
    for (const queue of Array.from(this.queues.values())) {
      const job = await queue.getJob(jobId);
      if (job) {
        return job;
      }
    }
    return null;
  }

  /**
   * Cancel a job by ID
   */
  async cancelJob(jobId: string): Promise<boolean> {
    // Try to cancel from all queues
    for (const queue of Array.from(this.queues.values())) {
      const cancelled = await queue.cancelJob(jobId);
      if (cancelled) {
        return true;
      }
    }
    return false;
  }

  /**
   * Get jobs for a user
   */
  getUserJobs(
    userId: number,
    options: {
      status?: string;
      type?: string;
      limit?: number;
      queueName?: string;
    } = {}
  ): Job[] {
    const queueNames = options.queueName ? [options.queueName] : Array.from(this.queues.keys());
    const allJobs: Job[] = [];

    for (const queueName of queueNames) {
      const queue = this.queues.get(queueName);
      if (queue) {
        const jobs = queue.getJobs({
          userId,
          status: options.status as any,
          type: options.type,
          limit: options.limit
        });
        allJobs.push(...jobs);
      }
    }

    // Sort by creation time (newest first)
    allJobs.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return options.limit ? allJobs.slice(0, options.limit) : allJobs;
  }

  /**
   * Get jobs for a project
   */
  getProjectJobs(
    projectId: string,
    options: {
      status?: string;
      type?: string;
      limit?: number;
    } = {}
  ): Job[] {
    const allJobs: Job[] = [];

    for (const queue of Array.from(this.queues.values())) {
      const jobs = queue.getJobs({
        projectId,
        status: options.status as any,
        type: options.type,
        limit: options.limit
      });
      allJobs.push(...jobs);
    }

    // Sort by creation time (newest first)
    allJobs.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return options.limit ? allJobs.slice(0, options.limit) : allJobs;
  }

  /**
   * Get queue statistics
   */
  getQueueStats(): Record<string, any> {
    const stats: Record<string, any> = {};

    for (const [name, queue] of Array.from(this.queues.entries())) {
      stats[name] = queue.getStats();
    }

    return stats;
  }

  /**
   * Clean up old jobs from all queues
   */
  async cleanup(olderThanMs: number = 86400000): Promise<Record<string, number>> {
    const cleanupResults: Record<string, number> = {};

    for (const [name, queue] of Array.from(this.queues.entries())) {
      const cleanedCount = await queue.cleanup(olderThanMs);
      cleanupResults[name] = cleanedCount;
    }

    const totalCleaned = Object.values(cleanupResults).reduce((sum, count) => sum + count, 0);
    
    logContext.system('Job queue cleanup completed', {
      event: 'queue_cleanup',
      severity: 'low',
      metadata: {
        totalCleaned,
        queueResults: cleanupResults,
        olderThanMs
      }
    });

    return cleanupResults;
  }

  /**
   * Get health status of all queues
   */
  getHealthStatus(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    queues: Record<string, { status: string; stats: any }>;
  } {
    const queueHealth: Record<string, { status: string; stats: any }> = {};
    let unhealthyQueues = 0;

    for (const [name, queue] of Array.from(this.queues.entries())) {
      const stats = queue.getStats();
      let status = 'healthy';

      // Check if queue has too many failed jobs
      if (stats.failed > stats.completed * 0.1) {
        status = 'degraded';
      }

      // Check if queue has jobs stuck in processing
      if (stats.processing > 10) {
        status = 'degraded';
      }

      // Check if queue is completely failing
      if (stats.failed > 50 && stats.completed === 0) {
        status = 'unhealthy';
        unhealthyQueues++;
      }

      queueHealth[name] = { status, stats };
    }

    const overallStatus = 
      unhealthyQueues > 0 ? 'unhealthy' :
      Object.values(queueHealth).some(q => q.status === 'degraded') ? 'degraded' :
      'healthy';

    return {
      status: overallStatus,
      queues: queueHealth
    };
  }

  /**
   * Schedule periodic maintenance
   */
  schedulePeriodicMaintenance(): void {
    // Clean up old jobs every hour
    setInterval(async () => {
      try {
        await this.cleanup();
      } catch (error: any) {
        logger.error('Periodic job cleanup failed', { error: error.message });
      }
    }, 60 * 60 * 1000); // 1 hour

    // Warm up cache every 6 hours
    setInterval(async () => {
      try {
        await this.addCacheWarmupJob('low');
      } catch (error: any) {
        logger.error('Periodic cache warmup failed', { error: error.message });
      }
    }, 6 * 60 * 60 * 1000); // 6 hours

    logger.info('Periodic maintenance scheduled');
  }

  /**
   * Get queue name for job type
   */
  private getQueueForJobType(jobType: string): string {
    switch (jobType) {
      case JOB_TYPES.BID_GENERATION:
      case JOB_TYPES.RFP_ANALYSIS:
      case JOB_TYPES.CACHE_WARMUP:
      case JOB_TYPES.WIN_PROBABILITY:
        return 'ai';
      
      case JOB_TYPES.DOCUMENT_PROCESSING:
      case JOB_TYPES.KNOWLEDGE_BASE_UPDATE:
        return 'document';
      
      case JOB_TYPES.NOTIFICATION_SEND:
        return 'notification';
      
      default:
        return 'ai'; // Default to AI queue
    }
  }

  /**
   * Set up event listeners for queue monitoring
   */
  private setupEventListeners(): void {
    const entries = Array.from(this.queues.entries());
    for (const [name, queue] of entries) {
      queue.on('job:completed', (job: Job, result: any) => {
        logContext.system('Job completed', {
          event: 'job_completed',
          severity: 'low',
          metadata: {
            jobId: job.id,
            type: job.type,
            queue: name,
            duration: job.completedAt ? job.completedAt.getTime() - job.startedAt!.getTime() : 0,
            userId: job.userId,
            projectId: job.projectId
          }
        });
      });

      queue.on('job:failed', (job: Job, error: Error) => {
        logContext.system('Job failed', {
          event: 'job_failed',
          severity: 'high',
          metadata: {
            jobId: job.id,
            type: job.type,
            queue: name,
            error: error.message,
            attempts: job.attempts,
            userId: job.userId,
            projectId: job.projectId
          }
        });
      });

      queue.on('job:retry', (job: Job, error: Error) => {
        logContext.system('Job retrying', {
          event: 'job_retry',
          severity: 'medium',
          metadata: {
            jobId: job.id,
            type: job.type,
            queue: name,
            attempt: job.attempts,
            maxAttempts: job.maxAttempts,
            error: error.message,
            userId: job.userId,
            projectId: job.projectId
          }
        });
      });
    }
  }
}

// Create singleton instance
export const jobManager = new JobManager();

export default jobManager;