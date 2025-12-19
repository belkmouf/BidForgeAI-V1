import { db } from '../db.js';
import { documentChunks, knowledgeBaseChunks, documents } from '@shared/schema';
import { eq, sql, desc } from 'drizzle-orm';
import { OpenAI } from 'openai';
import { cache } from './cache.js';
import { logger, logContext } from './logger.js';
import crypto from 'crypto';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface SearchResult {
  id: number;
  content: string;
  score: number;
  documentId?: number;
  documentName?: string;
  chunkIndex: number;
  type: 'document' | 'knowledge';
}

export interface SearchOptions {
  limit?: number;
  threshold?: number;
  useCache?: boolean;
  cacheKeyPrefix?: string;
  cacheTTL?: number;
}

export class SearchService {
  private static instance: SearchService;
  
  public static getInstance(): SearchService {
    if (!SearchService.instance) {
      SearchService.instance = new SearchService();
    }
    return SearchService.instance;
  }

  /**
   * Generate embedding for a text query with caching
   */
  async generateEmbedding(text: string): Promise<number[]> {
    const startTime = Date.now();
    
    try {
      // Try cache first
      const cachedEmbedding = await cache.getEmbedding(text);
      if (cachedEmbedding) {
        logContext.performance('Embedding cache hit', {
          operation: 'embedding_generation',
          duration: Date.now() - startTime,
          success: true,
          metadata: { cached: true, textLength: text.length }
        });
        return cachedEmbedding;
      }

      // Generate new embedding
      const response = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: text,
      });

      const embedding = response.data[0].embedding;
      
      // Cache the embedding
      await cache.cacheEmbedding(text, embedding);
      
      const duration = Date.now() - startTime;
      logContext.performance('Embedding generated', {
        operation: 'embedding_generation',
        duration,
        success: true,
        metadata: { 
          cached: false, 
          textLength: text.length,
          tokenUsage: response.usage?.total_tokens || 0
        }
      });

      logContext.ai('Embedding generated', {
        model: 'text-embedding-3-small',
        operation: 'embedding_generation',
        duration,
        tokenUsage: response.usage?.total_tokens || 0,
        success: true
      });

      return embedding;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      
      logContext.ai('Embedding generation failed', {
        model: 'text-embedding-3-small',
        operation: 'embedding_generation',
        duration,
        success: false,
        error: error.message
      });

      logger.error('Failed to generate embedding', {
        error: error.message,
        textLength: text.length
      });
      
      throw error;
    }
  }

  /**
   * Search document chunks using hybrid vector + text search with caching
   */
  async searchDocuments(
    query: string,
    projectId: string,
    options: SearchOptions = {}
  ): Promise<SearchResult[]> {
    const {
      limit = 10,
      threshold = 0.7,
      useCache = true,
      cacheTTL = 600 // 10 minutes
    } = options;

    const cacheKey = `search:documents:${projectId}:${this.hashQuery(query)}:${limit}:${threshold}`;
    
    // Try cache first if enabled
    if (useCache) {
      const cached = await cache.getRAGResults(query, projectId);
      if (cached) {
        logger.info('Document search cache hit', { 
          projectId, 
          queryLength: query.length,
          resultCount: cached.results.length 
        });
        return cached.results;
      }
    }

    const startTime = Date.now();
    
    try {
      // Generate embedding for the query
      const queryEmbedding = await this.generateEmbedding(query);
      
      // Perform hybrid search: 70% vector similarity + 30% text search
      const vectorResults = await this.vectorSearch(queryEmbedding, projectId, limit * 2, threshold);
      const textResults = await this.textSearch(query, projectId, limit);
      
      // Combine and rank results
      const combinedResults = this.combineSearchResults(
        vectorResults,
        textResults,
        { vectorWeight: 0.7, textWeight: 0.3 },
        limit
      );

      const duration = Date.now() - startTime;
      
      // Cache results if enabled
      if (useCache) {
        await cache.cacheRAGResults(query, projectId, combinedResults, cacheTTL);
      }

      logContext.performance('Document search completed', {
        operation: 'document_search',
        duration,
        success: true,
        metadata: {
          projectId,
          queryLength: query.length,
          resultCount: combinedResults.length,
          cached: false
        }
      });

      return combinedResults;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      
      logContext.business('Document search failed', {
        operation: 'document_search',
        projectId,
        error: error.message
      });

      logger.error('Document search failed', {
        error: error.message,
        projectId,
        queryLength: query.length
      });
      
      throw error;
    }
  }

  /**
   * Search knowledge base with caching
   */
  async searchKnowledgeBase(
    query: string,
    companyId: number,
    options: SearchOptions = {}
  ): Promise<SearchResult[]> {
    const {
      limit = 5,
      threshold = 0.75,
      useCache = true,
      cacheTTL = 1800 // 30 minutes
    } = options;

    const cacheKey = `search:knowledge:${companyId}:${this.hashQuery(query)}:${limit}:${threshold}`;
    
    if (useCache) {
      const cached = await cache.get<SearchResult[]>(cacheKey);
      if (cached) {
        logger.info('Knowledge base search cache hit', { 
          companyId, 
          queryLength: query.length,
          resultCount: cached.length 
        });
        return cached;
      }
    }

    const startTime = Date.now();
    
    try {
      const queryEmbedding = await this.generateEmbedding(query);
      
      const results = await db
        .select({
          id: knowledgeBaseChunks.id,
          content: knowledgeBaseChunks.content,
          chunkIndex: knowledgeBaseChunks.chunkIndex,
          similarity: sql<number>`1 - (${knowledgeBaseChunks.embedding} <=> ${JSON.stringify(queryEmbedding)})`,
        })
        .from(knowledgeBaseChunks)
        .where(eq(knowledgeBaseChunks.companyId, companyId))
        .orderBy(desc(sql`1 - (${knowledgeBaseChunks.embedding} <=> ${JSON.stringify(queryEmbedding)})`))
        .limit(limit);

      const searchResults: SearchResult[] = results
        .filter(r => r.similarity >= threshold)
        .map(r => ({
          id: r.id,
          content: r.content,
          score: r.similarity,
          chunkIndex: r.chunkIndex,
          type: 'knowledge' as const
        }));

      const duration = Date.now() - startTime;
      
      if (useCache) {
        await cache.set(cacheKey, searchResults, cacheTTL);
      }

      logContext.performance('Knowledge base search completed', {
        operation: 'knowledge_search',
        duration,
        success: true,
        metadata: {
          companyId,
          queryLength: query.length,
          resultCount: searchResults.length,
          cached: false
        }
      });

      return searchResults;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      
      logContext.business('Knowledge base search failed', {
        operation: 'knowledge_search',
        error: error.message,
        data: { companyId }
      });

      logger.error('Knowledge base search failed', {
        error: error.message,
        companyId,
        queryLength: query.length
      });
      
      throw error;
    }
  }

  /**
   * Vector similarity search
   */
  private async vectorSearch(
    embedding: number[],
    projectId: string,
    limit: number,
    threshold: number
  ): Promise<SearchResult[]> {
    const results = await db
      .select({
        id: documentChunks.id,
        content: documentChunks.content,
        chunkIndex: documentChunks.chunkIndex,
        documentId: documentChunks.documentId,
        documentName: documents.filename,
        similarity: sql<number>`1 - (${documentChunks.embedding} <=> ${JSON.stringify(embedding)})`,
      })
      .from(documentChunks)
      .leftJoin(documents, eq(documentChunks.documentId, documents.id))
      .where(eq(documents.projectId, projectId))
      .orderBy(desc(sql`1 - (${documentChunks.embedding} <=> ${JSON.stringify(embedding)})`))
      .limit(limit);

    return results
      .filter(r => r.similarity >= threshold)
      .map(r => ({
        id: r.id,
        content: r.content,
        score: r.similarity,
        documentId: r.documentId,
        documentName: r.documentName || 'Unknown',
        chunkIndex: r.chunkIndex,
        type: 'document' as const
      }));
  }

  /**
   * Full-text search
   */
  private async textSearch(
    query: string,
    projectId: string,
    limit: number
  ): Promise<SearchResult[]> {
    // Simple text search using ILIKE - in production, consider using PostgreSQL FTS
    const searchTerms = query.toLowerCase().split(' ').filter(term => term.length > 2);
    
    if (searchTerms.length === 0) {
      return [];
    }

    const conditions = searchTerms.map(term => 
      sql`${documentChunks.content} ILIKE ${`%${term}%`}`
    );
    
    const whereClause = conditions.reduce((acc, condition) => 
      acc ? sql`${acc} AND ${condition}` : condition
    );

    const results = await db
      .select({
        id: documentChunks.id,
        content: documentChunks.content,
        chunkIndex: documentChunks.chunkIndex,
        documentId: documentChunks.documentId,
        documentName: documents.filename,
      })
      .from(documentChunks)
      .leftJoin(documents, eq(documentChunks.documentId, documents.id))
      .where(sql`${eq(documents.projectId, projectId)} AND ${whereClause}`)
      .limit(limit);

    return results.map(r => ({
      id: r.id,
      content: r.content,
      score: 0.5, // Fixed score for text matches
      documentId: r.documentId,
      documentName: r.documentName || 'Unknown',
      chunkIndex: r.chunkIndex,
      type: 'document' as const
    }));
  }

  /**
   * Combine vector and text search results
   */
  private combineSearchResults(
    vectorResults: SearchResult[],
    textResults: SearchResult[],
    weights: { vectorWeight: number; textWeight: number },
    limit: number
  ): SearchResult[] {
    const combined = new Map<number, SearchResult>();

    // Add vector results
    vectorResults.forEach(result => {
      combined.set(result.id, {
        ...result,
        score: result.score * weights.vectorWeight
      });
    });

    // Add or merge text results
    textResults.forEach(result => {
      const existing = combined.get(result.id);
      if (existing) {
        existing.score += result.score * weights.textWeight;
      } else {
        combined.set(result.id, {
          ...result,
          score: result.score * weights.textWeight
        });
      }
    });

    return Array.from(combined.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  /**
   * Invalidate cache for a project
   */
  async invalidateProjectCache(projectId: string): Promise<void> {
    await cache.invalidateProjectCache(projectId);
    logger.info('Search cache invalidated for project', { projectId });
  }

  /**
   * Get search statistics
   */
  async getSearchStats(projectId?: string): Promise<any> {
    const stats = {
      cacheHealth: await cache.healthCheck(),
      totalSearches: 0, // Would need to track this separately
      cacheHitRate: 0,  // Would need to track this separately
    };

    if (projectId) {
      // Get project-specific stats
      const projectContext = await cache.getProjectContext(projectId);
      stats.projectContext = !!projectContext;
    }

    return stats;
  }

  private hashQuery(query: string): string {
    return crypto.createHash('md5').update(query.toLowerCase().trim()).digest('hex');
  }
}

// Export singleton instance
export const searchService = SearchService.getInstance();
export default searchService;