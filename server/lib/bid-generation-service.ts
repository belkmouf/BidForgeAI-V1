/**
 * Unified Bid Generation Service
 * 
 * This service consolidates bid generation logic from:
 * - Direct route handlers (routes/bids.ts)
 * - Job processors (job-processors.ts)
 * - Agent orchestrators
 * 
 * Optimizations:
 * - Shared RAG search with caching
 * - Parallel context building
 * - Structured context data instead of string concatenation
 * - Retry logic with exponential backoff
 * - Streaming support for long operations
 */

import { storage } from '../storage';
import { generateEmbedding } from './openai';
import { generateBidContent } from './openai';
import { generateBidWithAnthropic as anthropicGenerate } from './anthropic';
import { generateBidWithGemini as geminiGenerate } from './gemini';
import { generateBidWithDeepSeek as deepseekGenerate } from './deepseek';
import { generateBidWithGrok as grokGenerate } from './grok';
import { getCompanyConfig, getUserBrandingConfig } from './templates/bid-template-generator';
import { wrapContentInPremiumTemplate } from './templates/gcc-premium-template';
import { sanitizeModelHtml } from './ai-output';
import { calculateLMMCost } from './pricing';
import { cache } from './cache';
import { logger } from './logger';
import { searchService } from './search';
import { usageTracking } from './usage-tracking.js';

export interface BidGenerationParams {
  projectId: string;
  companyId: number | null;
  userId: number | null;
  instructions: string;
  tone?: string;
  model?: 'anthropic' | 'gemini' | 'deepseek' | 'openai' | 'grok';
  models?: Array<'anthropic' | 'gemini' | 'deepseek' | 'openai' | 'grok'>;
}

export interface BidContext {
  projectContext: string;
  knowledgeBaseContext: string;
  ragReadyContext: string;
  sketchAnalysisContext: string;
  companyProfileContext: string;
  totalChunks: number;
  searchMethod: string;
}

export interface AIGenerationResult {
  content: string;
  inputTokens: number;
  outputTokens: number;
}

export interface BidGenerationResult {
  bidId?: number;
  version?: number;
  html: string;
  rawContent: string;
  model: string;
  chunksUsed: number;
  searchMethod: string;
  tokenUsage: {
    inputTokens: number;
    outputTokens: number;
    lmmCost: number;
  };
  generationTimeSeconds: number;
}

export interface BidGenerationOptions {
  saveToDatabase?: boolean;
  streamProgress?: (progress: { stage: string; message: string; percentage: number }) => void;
  useCache?: boolean;
  maxRetries?: number;
}

class BidGenerationService {
  private readonly DEFAULT_MAX_RETRIES = 3;
  private readonly EMBEDDING_CACHE_TTL = 3600; // 1 hour
  private readonly CONTEXT_CACHE_TTL = 1800; // 30 minutes

  /**
   * Generate embedding with caching
   */
  private async getCachedEmbedding(text: string): Promise<number[]> {
    const cacheKey = `embedding:${this.hashText(text)}`;
    
    try {
      const cached = await cache.get<number[]>(cacheKey);
      if (cached) {
        logger.debug('Using cached embedding', { textLength: text.length });
        return cached;
      }
    } catch (error) {
      logger.warn('Cache read failed, generating new embedding', { error });
    }

    const embedding = await generateEmbedding(text);
    
    try {
      await cache.set(cacheKey, embedding, this.EMBEDDING_CACHE_TTL);
    } catch (error) {
      logger.warn('Cache write failed', { error });
    }

    return embedding;
  }

  /**
   * Build context for bid generation (optimized with parallel execution)
   */
  async buildContext(
    params: BidGenerationParams,
    project: any,
    options: BidGenerationOptions = {}
  ): Promise<BidContext> {
    const { projectId, companyId, instructions } = params;
    const { useCache = true, streamProgress } = options;

    streamProgress?.({ stage: 'context_building', message: 'Building context...', percentage: 10 });

    // Check cache first
    const contextCacheKey = `bid_context:${projectId}:${this.hashText(instructions)}`;
    if (useCache) {
      try {
        const cached = await cache.get<BidContext>(contextCacheKey);
        if (cached) {
          logger.debug('Using cached bid context', { projectId });
          return cached;
        }
      } catch (error) {
        logger.warn('Context cache read failed', { error });
      }
    }

    streamProgress?.({ stage: 'embedding', message: 'Generating query embedding...', percentage: 15 });

    // Generate embedding (with caching)
    const queryEmbedding = await this.getCachedEmbedding(instructions);

    streamProgress?.({ stage: 'rag_search', message: 'Searching relevant documents...', percentage: 25 });

    // Parallel execution: RAG search, knowledge base search, RagReady search, and sketch analysis
    const [relevantChunks, kbChunks, ragReadySearchResult, projectMetadata] = await Promise.all([
      // RAG search with hybrid search
      storage.searchHybrid(
        instructions,
        queryEmbedding,
        projectId,
        companyId,
        20,
        { vectorWeight: 0.7, textWeight: 0.3 }
      ).catch((error) => {
        logger.warn('RAG search failed, falling back', { error: error.message });
        return [];
      }),

      // Knowledge base search
      companyId
        ? storage.searchKnowledgeBaseChunks(queryEmbedding, companyId, 10).catch((error) => {
            logger.warn('Knowledge base search failed', { error: error.message });
            return [];
          })
        : Promise.resolve([]),

      // RagReady hybrid search (only if company has collection ID configured)
      companyId
        ? searchService.searchWithRagReady(instructions, projectId, companyId, { limit: 10 }).catch((error) => {
            logger.warn('RagReady search failed', { error: error.message });
            return { localResults: [], ragReadyResults: [], combined: [] };
          })
        : Promise.resolve({ localResults: [], ragReadyResults: [], combined: [] }),

      // Get project metadata (for sketch analysis)
      Promise.resolve(project.metadata as Record<string, any> | null),
    ]);

    streamProgress?.({ stage: 'context_processing', message: 'Processing context data...', percentage: 50 });

    // Build project context from chunks
    let projectContext = '';
    if (relevantChunks.length > 0) {
      projectContext = relevantChunks
        .map((chunk, i) => {
          const scoreInfo = `[Relevance: ${(chunk.score * 100).toFixed(1)}%]`;
          return `--- Relevant Project Section ${i + 1} ${scoreInfo} ---\n${chunk.content}`;
        })
        .join('\n\n');
    } else {
      // Fallback to direct document content
      logger.warn('No RAG chunks found, using document content fallback');
      const documents = await storage.listDocumentsByProject(projectId);
      projectContext = documents
        .filter((doc: { content: string | null }) => doc.content && !doc.content.startsWith('[PDF content could not be extracted'))
        .map((doc: { filename: string; content: string | null }, i: number) => 
          `[Document ${i + 1}: ${doc.filename}]\n${doc.content?.substring(0, 5000) || ''}`
        )
        .join('\n\n---\n\n');
    }

    // Build knowledge base context
    let knowledgeBaseContext = '';
    if (kbChunks.length > 0) {
      knowledgeBaseContext = '\n\n--- COMPANY KNOWLEDGE BASE ---\n' +
        kbChunks
          .map((chunk, i) => `[Knowledge ${i + 1}] ${chunk.content}`)
          .join('\n\n');
    }

    // Build RagReady context (external document intelligence)
    let ragReadyContext = '';
    const ragReadyResults = ragReadySearchResult.ragReadyResults || [];
    if (ragReadyResults.length > 0) {
      logger.info('RagReady context found', { 
        resultCount: ragReadyResults.length,
        projectId,
        companyId 
      });
      ragReadyContext = '\n\n--- RAGREADY EXTERNAL DOCUMENT INTELLIGENCE ---\n' +
        ragReadyResults
          .map((result: { content: string; score: number; documentName?: string }, i: number) => {
            const scoreInfo = `[Relevance: ${(result.score * 100).toFixed(1)}%]`;
            const sourceName = result.documentName || 'External Document';
            return `[RagReady ${i + 1}: ${sourceName}] ${scoreInfo}\n${result.content}`;
          })
          .join('\n\n');
    }

    // Build sketch analysis context
    let sketchAnalysisContext = '';
    if (projectMetadata?.sketchAnalysis && Array.isArray(projectMetadata.sketchAnalysis)) {
      sketchAnalysisContext = this.formatSketchAnalysis(projectMetadata.sketchAnalysis);
    }

    // Build company profile context
    const userId = params.userId;
    const userBranding = userId ? await getUserBrandingConfig(userId) : null;
    const companyConfig = userBranding || await getCompanyConfig(companyId);
    const companyProfileContext = this.formatCompanyProfile(companyConfig);

    const hasRagReady = ragReadyResults.length > 0;
    const context: BidContext = {
      projectContext,
      knowledgeBaseContext,
      ragReadyContext,
      sketchAnalysisContext,
      companyProfileContext,
      totalChunks: relevantChunks.length + kbChunks.length + ragReadyResults.length,
      searchMethod: hasRagReady 
        ? 'hybrid_rag_with_ragready' 
        : (relevantChunks.length > 0 ? 'hybrid_rag' : 'document_content_fallback'),
    };

    // Cache the context
    if (useCache) {
      try {
        await cache.set(contextCacheKey, context, this.CONTEXT_CACHE_TTL);
      } catch (error) {
        logger.warn('Context cache write failed', { error });
      }
    }

    streamProgress?.({ stage: 'context_complete', message: 'Context built successfully', percentage: 70 });

    return context;
  }

  /**
   * Format sketch analysis data into context string
   */
  private formatSketchAnalysis(sketchResults: any[]): string {
    let context = '\n\n--- SKETCH/DRAWING ANALYSIS (Use this technical data in the bid) ---\n';
    
    context += sketchResults.map((sketch: any, i: number) => {
      const parts: string[] = [];
      const contextLayer = sketch.context_layer || {};
      const technicalData = sketch.technical_data || {};
      const projectMeta = sketch.project_metadata || {};
      
      const docType = contextLayer.document_type || sketch.document_type || 'Technical Drawing';
      parts.push(`\n[Sketch ${i + 1}: ${docType}]`);
      
      if (contextLayer.description) parts.push(`Description: ${contextLayer.description}`);
      if (contextLayer.purpose) parts.push(`Purpose: ${contextLayer.purpose}`);
      if (projectMeta.project_title) parts.push(`Project Title: ${projectMeta.project_title}`);
      if (projectMeta.project_number) parts.push(`Project Number: ${projectMeta.project_number}`);
      if (projectMeta.status) parts.push(`Status: ${projectMeta.status}`);
      if (projectMeta.scale && projectMeta.scale !== 'NTS') parts.push(`Scale: ${projectMeta.scale}`);
      
      // Dimensions
      const dimensions = technicalData.dimensions || sketch.dimensions || [];
      if (dimensions.length > 0) {
        parts.push(`Dimensions:\n${dimensions.map((d: any) => 
          `  - ${d.label || d.type}: ${d.value} ${d.unit}${d.location ? ` (${d.location})` : ''}`
        ).join('\n')}`);
      }
      
      // Materials
      const materials = technicalData.materials || sketch.materials || [];
      if (materials.length > 0) {
        parts.push(`Materials:\n${materials.map((m: any) => {
          const name = m.component || m.name || 'Unknown';
          const spec = m.spec || m.specification || '';
          const grade = m.grade ? ` Grade: ${m.grade}` : '';
          const qty = m.quantity ? ` Qty: ${m.quantity} ${m.unit || ''}` : '';
          return `  - ${name}${spec ? `: ${spec}` : ''}${grade}${qty}`;
        }).join('\n')}`);
      }
      
      // Components
      const components = technicalData.components || sketch.components || [];
      if (components.length > 0) {
        parts.push(`Components:\n${components.map((c: any) => {
          const type = c.type || 'Component';
          const desc = c.description ? `: ${c.description}` : '';
          const size = c.size ? ` Size: ${c.size}` : '';
          const count = c.count ? ` x${c.count}` : '';
          const loc = c.location ? ` at ${c.location}` : '';
          const mat = c.material ? ` (${c.material})` : '';
          return `  - ${type}${desc}${size}${count}${loc}${mat}`;
        }).join('\n')}`);
      }
      
      // Quantities
      const quantities = technicalData.quantities || {};
      if (Object.keys(quantities).length > 0) {
        const qtyParts = [];
        if (quantities.concrete_volume_m3 > 0) qtyParts.push(`Concrete: ${quantities.concrete_volume_m3} m³`);
        if (quantities.steel_weight_kg > 0) qtyParts.push(`Steel: ${quantities.steel_weight_kg} kg`);
        if (quantities.foundation_count > 0) qtyParts.push(`Foundations: ${quantities.foundation_count}`);
        if (qtyParts.length > 0) parts.push(`Quantities: ${qtyParts.join(', ')}`);
      }
      
      // Specifications, standards, codes
      const specifications = sketch.specifications || [];
      if (specifications.length > 0) {
        parts.push(`Specifications:\n${specifications.map((s: string) => `  - ${s}`).join('\n')}`);
      }
      
      const standards = sketch.standards || [];
      if (standards.length > 0) parts.push(`Standards: ${standards.join(', ')}`);
      
      const regionalCodes = sketch.regional_codes || [];
      if (regionalCodes.length > 0) parts.push(`Regional Codes: ${regionalCodes.join(', ')}`);
      
      // Annotations, views, notes, warnings
      const annotations = sketch.annotations || [];
      if (annotations.length > 0) {
        parts.push(`Key Annotations: ${annotations.slice(0, 10).join(', ')}${annotations.length > 10 ? '...' : ''}`);
      }
      
      const views = sketch.views_included || [];
      if (views.length > 0) parts.push(`Views: ${views.join(', ')}`);
      
      if (sketch.notes) parts.push(`Notes: ${sketch.notes}`);
      
      const warnings = sketch.warnings || [];
      if (warnings.length > 0) parts.push(`Warnings: ${warnings.join(', ')}`);
      
      if (sketch.confidence_score) {
        parts.push(`Analysis Confidence: ${(sketch.confidence_score * 100).toFixed(0)}%`);
      }
      
      return parts.join('\n');
    }).join('\n\n');
    
    context += '\n--- END SKETCH ANALYSIS ---';
    return context;
  }

  /**
   * Format company profile into context string
   */
  private formatCompanyProfile(companyConfig: any): string {
    return `
--- YOUR COMPANY PROFILE (Use this for all company references) ---
Company Name: ${companyConfig.name}
Tagline: ${companyConfig.tagline}
Website: ${companyConfig.website}
License Number: ${companyConfig.licenseNumber || 'N/A'}

Address: ${companyConfig.address}, ${companyConfig.city}, ${companyConfig.state} ${companyConfig.zip}

Contact Representative:
- Name: ${companyConfig.defaultRep.name}
- Title: ${companyConfig.defaultRep.title}
- Phone: ${companyConfig.defaultRep.phone}
- Email: ${companyConfig.defaultRep.email}

IMPORTANT: When referencing "our company" or company contact information in the bid, 
use ONLY the above company profile information. Do NOT use any other company names 
or contact details from other sources.
--- END COMPANY PROFILE ---

`;
  }

  /**
   * Generate bid with a specific model (with retry logic)
   */
  private async generateBidWithModel(
    modelName: string,
    params: { instructions: string; context: string; tone: string },
    maxRetries: number = this.DEFAULT_MAX_RETRIES
  ): Promise<AIGenerationResult> {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        switch (modelName) {
          case 'anthropic':
            return await anthropicGenerate(params);
          case 'gemini':
            return await geminiGenerate(params);
          case 'deepseek':
            return await deepseekGenerate(params);
          case 'grok':
            return await grokGenerate(params);
          case 'openai':
          default:
            return await generateBidContent(params);
        }
      } catch (error) {
        lastError = error as Error;
        logger.warn(`Bid generation attempt ${attempt}/${maxRetries} failed`, {
          model: modelName,
          error: lastError.message,
        });
        
        if (attempt < maxRetries) {
          // Exponential backoff: 1s, 2s, 4s
          const delay = Math.pow(2, attempt - 1) * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw new Error(`Bid generation failed after ${maxRetries} attempts: ${lastError?.message}`);
  }

  /**
   * Generate a single bid
   */
  async generateBid(
    params: BidGenerationParams,
    options: BidGenerationOptions = {}
  ): Promise<BidGenerationResult> {
    const generationStartTime = Date.now();
    const { saveToDatabase = true, streamProgress, maxRetries = this.DEFAULT_MAX_RETRIES } = options;

    try {
      // Verify project exists
      const project = await storage.getProject(params.projectId, params.companyId);
      if (!project) {
        throw new Error(`Project not found: ${params.projectId}`);
      }

      streamProgress?.({ stage: 'start', message: 'Starting bid generation...', percentage: 0 });

      // Build context (with caching and parallel execution)
      const context = await this.buildContext(params, project, options);

      streamProgress?.({ stage: 'generation', message: `Generating bid with ${params.model || 'deepseek'}...`, percentage: 75 });

      // Combine all context (including RagReady external document intelligence if available)
      const fullContext = context.companyProfileContext + 
        (context.projectContext || 'No document content available. Please provide project details in your instructions.') +
        context.knowledgeBaseContext +
        context.ragReadyContext +
        context.sketchAnalysisContext;

      // Generate bid
      const selectedModel = params.models?.[0] || params.model || 'deepseek';
      const result = await this.generateBidWithModel(
        selectedModel,
        {
          instructions: params.instructions,
          context: fullContext,
          tone: params.tone || 'professional',
        },
        maxRetries
      );

      streamProgress?.({ stage: 'processing', message: 'Processing generated content...', percentage: 90 });

      // Sanitize and wrap content
      const cleanedHtml = sanitizeModelHtml(result.content);
      
      // Get company config for template
      const userId = params.userId;
      const userBranding = userId ? await getUserBrandingConfig(userId) : null;
      const companyConfig = userBranding || await getCompanyConfig(params.companyId);
      
      const html = wrapContentInPremiumTemplate(
        cleanedHtml,
        project.name,
        project.clientName || 'Valued Client',
        {},
        companyConfig
      );

      // Calculate costs
      const lmmCost = calculateLMMCost(selectedModel, result.inputTokens, result.outputTokens);
      const generationTimeSeconds = Math.round((Date.now() - generationStartTime) / 1000);

      streamProgress?.({ stage: 'saving', message: 'Saving bid...', percentage: 95 });

      // Save to database if requested
      let bidId: number | undefined;
      let version: number | undefined;

      if (saveToDatabase) {
        const savedBid = await storage.createBid({
          projectId: params.projectId,
          companyId: params.companyId,
          userId: params.userId,
          content: html,
          rawContent: cleanedHtml,
          instructions: params.instructions,
          tone: params.tone || 'professional',
          model: selectedModel,
          searchMethod: context.searchMethod,
          chunksUsed: context.totalChunks,
          lmmCost,
          generationTimeSeconds,
        });
        bidId = savedBid.id;
        version = savedBid.version;

        // Track usage for billing
        if (params.companyId) {
          try {
            await usageTracking.trackUsage({
              companyId: params.companyId,
              projectId: params.projectId,
              userId: params.userId || undefined,
              eventType: 'bid_generated',
              eventCategory: 'generation',
              quantity: 1,
              unit: 'generations',
              metadata: {
                model: selectedModel,
                inputTokens: result.inputTokens,
                outputTokens: result.outputTokens,
                bidId: savedBid.id,
              },
            });
          } catch (usageError) {
            logger.warn('Failed to track bid generation usage', { error: usageError });
          }
        }
      }

      streamProgress?.({ stage: 'complete', message: 'Bid generation complete!', percentage: 100 });

      return {
        bidId,
        version,
        html,
        rawContent: cleanedHtml,
        model: selectedModel,
        chunksUsed: context.totalChunks,
        searchMethod: context.searchMethod,
        tokenUsage: {
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
          lmmCost,
        },
        generationTimeSeconds,
      };
    } catch (error: any) {
      logger.error('Bid generation failed', {
        projectId: params.projectId,
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * Generate multiple bids for comparison (parallel execution)
   */
  async generateBidComparison(
    params: BidGenerationParams,
    options: BidGenerationOptions = {}
  ): Promise<{ comparison: boolean; results: any[]; chunksUsed: number; searchMethod: string }> {
    if (!params.models || params.models.length <= 1) {
      throw new Error('Multiple models required for comparison');
    }

    const generationStartTime = Date.now();
    const { saveToDatabase = true, streamProgress } = options;

    try {
      // Verify project exists
      const project = await storage.getProject(params.projectId, params.companyId);
      if (!project) {
        throw new Error(`Project not found: ${params.projectId}`);
      }

      streamProgress?.({ stage: 'start', message: 'Starting multi-model comparison...', percentage: 0 });

      // Build context once (shared across all models)
      const context = await this.buildContext(params, project, options);

      streamProgress?.({ stage: 'generation', message: `Generating bids with ${params.models.length} models in parallel...`, percentage: 50 });

      // Combine all context (including RagReady external document intelligence if available)
      const fullContext = context.companyProfileContext + 
        (context.projectContext || 'No document content available.') +
        context.knowledgeBaseContext +
        context.ragReadyContext +
        context.sketchAnalysisContext;

      const generationParams = {
        instructions: params.instructions,
        context: fullContext,
        tone: params.tone || 'professional',
      };

      // Generate bids in parallel
      const generatedBids = await Promise.all(
        params.models.map(async (modelName) => {
          try {
            const result = await this.generateBidWithModel(modelName, generationParams);
            const cleanedHtml = sanitizeModelHtml(result.content);
            
            // Get company config for template
            const userId = params.userId;
            const userBranding = userId ? await getUserBrandingConfig(userId) : null;
            const companyConfig = userBranding || await getCompanyConfig(params.companyId);
            
            const html = wrapContentInPremiumTemplate(
              cleanedHtml,
              project.name,
              project.clientName || 'Valued Client',
              {},
              companyConfig
            );
            
            const lmmCost = calculateLMMCost(modelName, result.inputTokens, result.outputTokens);
            
            return {
              model: modelName,
              html,
              rawContent: cleanedHtml,
              success: true,
              inputTokens: result.inputTokens,
              outputTokens: result.outputTokens,
              lmmCost,
            };
          } catch (error: any) {
            logger.error(`Bid generation failed for model ${modelName}`, { error: error.message });
            return {
              model: modelName,
              html: '',
              success: false,
              error: error.message,
              inputTokens: 0,
              outputTokens: 0,
              lmmCost: 0,
            };
          }
        })
      );

      streamProgress?.({ stage: 'saving', message: 'Saving comparison bids...', percentage: 90 });

      // Save bids sequentially to avoid transaction conflicts
      const results = [];
      for (const genResult of generatedBids) {
        if (genResult.success && genResult.html && saveToDatabase) {
          try {
            const generationTimeSeconds = Math.round((Date.now() - generationStartTime) / 1000);
            const savedBid = await storage.createBid({
              projectId: params.projectId,
              companyId: params.companyId,
              userId: params.userId,
              content: genResult.html,
              rawContent: genResult.rawContent,
              instructions: params.instructions,
              tone: params.tone || 'professional',
              model: genResult.model,
              searchMethod: context.searchMethod,
              chunksUsed: context.totalChunks,
              lmmCost: genResult.lmmCost,
              generationTimeSeconds,
            });
            results.push({ ...genResult, bidId: savedBid.id, version: savedBid.version });

            // Track usage for billing
            if (params.companyId) {
              try {
                await usageTracking.trackUsage({
                  companyId: params.companyId,
                  projectId: params.projectId,
                  userId: params.userId || undefined,
                  eventType: 'bid_generated',
                  eventCategory: 'generation',
                  quantity: 1,
                  unit: 'generations',
                  metadata: {
                    model: genResult.model,
                    inputTokens: genResult.inputTokens,
                    outputTokens: genResult.outputTokens,
                    bidId: savedBid.id,
                    comparison: true,
                  },
                });
              } catch (usageError) {
                logger.warn('Failed to track bid generation usage', { error: usageError });
              }
            }
          } catch (saveError: any) {
            logger.error(`Failed to save bid for model ${genResult.model}`, { error: saveError.message });
            results.push({ ...genResult, saveError: saveError.message });
          }
        } else {
          results.push(genResult);
        }
      }

      streamProgress?.({ stage: 'complete', message: 'Comparison complete!', percentage: 100 });

      return {
        comparison: true,
        results,
        chunksUsed: context.totalChunks,
        searchMethod: context.searchMethod,
      };
    } catch (error: any) {
      logger.error('Bid comparison failed', {
        projectId: params.projectId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Invalidate cache for a project
   */
  async invalidateProjectCache(projectId: string): Promise<void> {
    try {
      await cache.invalidateProjectCache(projectId);
      logger.info('Bid generation cache invalidated', { projectId });
    } catch (error) {
      logger.warn('Failed to invalidate cache', { projectId, error });
    }
  }

  /**
   * Hash text for cache keys
   */
  private hashText(text: string): string {
    const crypto = require('crypto');
    return crypto.createHash('md5').update(text.toLowerCase().trim()).digest('hex');
  }
}

// Export singleton instance
export const bidGenerationService = new BidGenerationService();
export default bidGenerationService;

