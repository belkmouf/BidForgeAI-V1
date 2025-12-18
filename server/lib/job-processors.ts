import { Job } from './queue.js';
import { logger, logContext } from './logger.js';
import { searchService } from './search.js';
import { generateBidContent } from './openai.js';
import { generateBidWithAnthropic } from './anthropic.js';
import { generateBidWithGemini } from './gemini.js';
import { generateBidWithDeepSeek } from './deepseek.js';
import { generateBidWithGrok } from './grok.js';
import { analyzeRFP } from './analysis.js';
import { cache } from './cache.js';
import { ingestionService } from './ingestion.js';

// Job type constants
export const JOB_TYPES = {
  BID_GENERATION: 'bid_generation',
  RFP_ANALYSIS: 'rfp_analysis',
  DOCUMENT_PROCESSING: 'document_processing',
  KNOWLEDGE_BASE_UPDATE: 'knowledge_base_update',
  CACHE_WARMUP: 'cache_warmup',
  CONFLICT_DETECTION: 'conflict_detection',
  WIN_PROBABILITY: 'win_probability_calculation',
  NOTIFICATION_SEND: 'notification_send',
  REPORT_GENERATION: 'report_generation',
} as const;

export type JobType = typeof JOB_TYPES[keyof typeof JOB_TYPES];

// Job data interfaces
export interface BidGenerationData {
  projectId: string;
  instructions: string;
  tone?: string;
  model: 'openai' | 'anthropic' | 'gemini' | 'deepseek' | 'grok';
  userId: number;
  companyId: number;
}

export interface RFPAnalysisData {
  projectId: string;
  documentIds: number[];
  userId: number;
  companyId: number;
}

export interface DocumentProcessingData {
  projectId: string;
  documentId: number;
  filePath: string;
  userId: number;
  companyId: number;
}

// Bid Generation Processor
export async function processBidGeneration(job: Job, data: BidGenerationData): Promise<any> {
  const startTime = Date.now();
  const { projectId, instructions, tone, model, userId, companyId } = data;

  try {
    logger.info('Starting bid generation job', {
      jobId: job.id,
      projectId,
      model,
      userId
    });

    // Step 1: Search for relevant content
    const searchResults = await searchService.searchDocuments(instructions, projectId, {
      limit: 15,
      threshold: 0.7,
      useCache: true
    });

    if (searchResults.length === 0) {
      throw new Error('No relevant content found for bid generation');
    }

    // Step 2: Get knowledge base context
    const knowledgeResults = await searchService.searchKnowledgeBase(instructions, companyId, {
      limit: 5,
      threshold: 0.75,
      useCache: true
    });

    // Step 3: Generate bid using selected model
    let bidResult;
    const contextText = searchResults.map(r => r.content).join('\n\n');
    const knowledgeText = knowledgeResults.map(r => r.content).join('\n\n');

    const combinedContext = `${contextText}\n\n${knowledgeText}`;

    switch (model) {
      case 'anthropic':
        bidResult = await generateBidWithAnthropic({ instructions, context: combinedContext, tone });
        break;
      case 'gemini':
        bidResult = await generateBidWithGemini({ instructions, context: combinedContext, tone });
        break;
      case 'deepseek':
        bidResult = await generateBidWithDeepSeek({ instructions, context: combinedContext, tone });
        break;
      case 'grok':
        bidResult = await generateBidWithGrok({ instructions, context: combinedContext, tone });
        break;
      default:
        bidResult = await generateBidContent({ instructions, context: combinedContext, tone });
    }

    const duration = Date.now() - startTime;

    logContext.ai('Bid generation job completed', {
      model,
      operation: 'bid_generation',
      projectId,
      userId,
      duration,
      tokenUsage: 0,
      success: true
    });

    return {
      bidContent: bidResult,
      model,
      chunksUsed: searchResults.length,
      knowledgeChunks: knowledgeResults.length,
      metadata: {
        searchResults: searchResults.map(r => ({ id: r.id, score: r.score })),
        duration
      }
    };

  } catch (error: any) {
    const duration = Date.now() - startTime;

    logContext.ai('Bid generation job failed', {
      model,
      operation: 'bid_generation',
      projectId,
      userId,
      duration,
      success: false,
      error: error.message
    });

    throw error;
  }
}

// RFP Analysis Processor
export async function processRFPAnalysis(job: Job, data: RFPAnalysisData): Promise<any> {
  const startTime = Date.now();
  const { projectId, documentIds, userId, companyId } = data;

  try {
    logger.info('Starting RFP analysis job', {
      jobId: job.id,
      projectId,
      documentCount: documentIds.length,
      userId
    });

    // Analyze the RFP documents
    const analysis = await analyzeRFP(projectId);

    const duration = Date.now() - startTime;

    logContext.ai('RFP analysis job completed', {
      model: 'analysis_engine',
      operation: 'rfp_analysis',
      projectId,
      userId,
      duration,
      success: true
    });

    return {
      analysis,
      projectId,
      documentIds,
      metadata: {
        duration,
        documentsAnalyzed: documentIds.length
      }
    };

  } catch (error: any) {
    const duration = Date.now() - startTime;

    logContext.business('RFP analysis job failed', {
      operation: 'rfp_analysis',
      projectId,
      userId,
      error: error.message
    });

    throw error;
  }
}

// Document Processing Processor
export async function processDocumentProcessing(job: Job, data: DocumentProcessingData): Promise<any> {
  const startTime = Date.now();
  const { projectId, documentId, filePath, userId, companyId } = data;

  try {
    logger.info('Starting document processing job', {
      jobId: job.id,
      projectId,
      documentId,
      userId
    });

    // Process the document using ingestion service
    const result = await ingestionService.processDocument(filePath, {
      projectId,
      documentId,
      userId,
      companyId
    });

    const duration = Date.now() - startTime;

    logContext.system('Document processing job completed', {
      event: 'document_processed',
      severity: 'low',
      metadata: {
        projectId,
        documentId,
        chunksCreated: result.chunksCreated,
        duration,
        userId
      }
    });

    return {
      documentId,
      chunksCreated: result.chunksCreated,
      filePath,
      metadata: {
        duration,
        fileSize: result.fileSize || 0
      }
    };

  } catch (error: any) {
    const duration = Date.now() - startTime;

    logContext.business('Document processing job failed', {
      operation: 'document_processing',
      projectId,
      userId,
      error: error.message,
      data: { documentId, filePath }
    });

    throw error;
  }
}

// Cache Warmup Processor
export async function processCacheWarmup(job: Job, data: any): Promise<any> {
  const startTime = Date.now();

  try {
    logger.info('Starting cache warmup job', { jobId: job.id });

    // Warm up frequently accessed data
    const warmupTasks = [
      // Warm up user sessions
      cache.healthCheck(),
      
      // Warm up project contexts for active projects
      // Add your specific warmup logic here
    ];

    await Promise.all(warmupTasks);

    const duration = Date.now() - startTime;

    logContext.performance('Cache warmup completed', {
      operation: 'cache_warmup',
      duration,
      success: true
    });

    return {
      warmedItems: warmupTasks.length,
      duration
    };

  } catch (error: any) {
    const duration = Date.now() - startTime;

    logger.error('Cache warmup failed', {
      error: error.message,
      duration
    });

    throw error;
  }
}

// Notification Send Processor
export async function processNotificationSend(job: Job, data: any): Promise<any> {
  const { type, recipient, message, metadata } = data;

  try {
    logger.info('Sending notification', {
      jobId: job.id,
      type,
      recipient
    });

    // Implement notification sending logic here
    // This could be email, SMS, push notifications, etc.
    
    switch (type) {
      case 'email':
        // Send email notification
        break;
      case 'webhook':
        // Send webhook notification
        break;
      case 'push':
        // Send push notification
        break;
      default:
        throw new Error(`Unknown notification type: ${type}`);
    }

    logContext.system('Notification sent successfully', {
      event: 'notification_sent',
      severity: 'low',
      metadata: {
        type,
        recipient,
        jobId: job.id
      }
    });

    return {
      type,
      recipient,
      sentAt: new Date().toISOString(),
      status: 'sent'
    };

  } catch (error: any) {
    logContext.system('Notification sending failed', {
      event: 'notification_failed',
      severity: 'medium',
      metadata: {
        type,
        recipient,
        error: error.message,
        jobId: job.id
      }
    });

    throw error;
  }
}

// Report Generation Processor
export async function processReportGeneration(job: Job, data: any): Promise<any> {
  const startTime = Date.now();
  const { reportType, filters, userId, format } = data;

  try {
    logger.info('Starting report generation', {
      jobId: job.id,
      reportType,
      format,
      userId
    });

    // Implement report generation logic
    let reportData;
    
    switch (reportType) {
      case 'bid_performance':
        // Generate bid performance report
        reportData = await generateBidPerformanceReport(filters);
        break;
      case 'project_analytics':
        // Generate project analytics report
        reportData = await generateProjectAnalyticsReport(filters);
        break;
      case 'user_activity':
        // Generate user activity report
        reportData = await generateUserActivityReport(filters);
        break;
      default:
        throw new Error(`Unknown report type: ${reportType}`);
    }

    const duration = Date.now() - startTime;

    logContext.system('Report generated successfully', {
      event: 'report_generated',
      severity: 'low',
      metadata: {
        reportType,
        format,
        duration,
        userId,
        jobId: job.id
      }
    });

    return {
      reportType,
      format,
      data: reportData,
      generatedAt: new Date().toISOString(),
      metadata: { duration }
    };

  } catch (error: any) {
    const duration = Date.now() - startTime;

    logContext.business('Report generation failed', {
      operation: 'report_generation',
      userId,
      error: error.message,
      data: { reportType, format }
    });

    throw error;
  }
}

// Helper functions for report generation
async function generateBidPerformanceReport(filters: any): Promise<any> {
  // Implement bid performance report generation
  return {
    totalBids: 0,
    winRate: 0,
    averageResponseTime: 0,
    // Add more metrics
  };
}

async function generateProjectAnalyticsReport(filters: any): Promise<any> {
  // Implement project analytics report generation
  return {
    totalProjects: 0,
    activeProjects: 0,
    completedProjects: 0,
    // Add more analytics
  };
}

async function generateUserActivityReport(filters: any): Promise<any> {
  // Implement user activity report generation
  return {
    activeUsers: 0,
    totalLogins: 0,
    averageSessionDuration: 0,
    // Add more user metrics
  };
}

// Export all processors
export const jobProcessors = {
  [JOB_TYPES.BID_GENERATION]: processBidGeneration,
  [JOB_TYPES.RFP_ANALYSIS]: processRFPAnalysis,
  [JOB_TYPES.DOCUMENT_PROCESSING]: processDocumentProcessing,
  [JOB_TYPES.CACHE_WARMUP]: processCacheWarmup,
  [JOB_TYPES.NOTIFICATION_SEND]: processNotificationSend,
  [JOB_TYPES.REPORT_GENERATION]: processReportGeneration,
};

export default jobProcessors;