import Redis from 'ioredis';
import * as crypto from 'crypto';
import { logger, logContext } from './logger.js';

interface CacheConfig {
  host?: string;
  port?: number;
  password?: string;
  db?: number;
  keyPrefix?: string;
  maxRetriesPerRequest?: number;
  retryDelayOnFailover?: number;
  enableOfflineQueue?: boolean;
}

class CacheService {
  private redis: Redis | null = null;
  private isConnected = false;
  private redisDisabled = false;
  private readonly config: CacheConfig;
  private readonly defaultTTL = 300; // 5 minutes default TTL

  constructor(config: CacheConfig = {}) {
    this.config = {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_DB || '0'),
      keyPrefix: 'bidforge:',
      maxRetriesPerRequest: 3,
      retryDelayOnFailover: 100,
      enableOfflineQueue: false,
      ...config
    };
  }

  async connect(): Promise<void> {
    try {
      // Skip Redis in test environment
      if (process.env.NODE_ENV === 'test') {
        logger.info('Skipping Redis connection in test environment');
        return;
      }

      this.redis = new Redis({
        host: this.config.host,
        port: this.config.port,
        password: this.config.password,
        db: this.config.db,
        keyPrefix: this.config.keyPrefix,
        maxRetriesPerRequest: 1,
        retryStrategy: (times: number) => {
          if (times >= 1) {
            this.redisDisabled = true;
            return null;
          }
          return Math.min(times * 100, 1000);
        },
        enableOfflineQueue: false,
        lazyConnect: true,
        connectTimeout: 2000,
      });

      // Event listeners - only log if not disabled
      this.redis.on('connect', () => {
        if (!this.redisDisabled) {
          logger.info('Redis cache connected');
          this.isConnected = true;
        }
      });

      this.redis.on('ready', () => {
        if (!this.redisDisabled) {
          logger.info('Redis cache ready');
        }
      });

      this.redis.on('error', (error) => {
        if (!this.redisDisabled) {
          logger.warn('Redis cache unavailable - using fallback', { error: error.message });
          this.redisDisabled = true;
        }
        this.isConnected = false;
      });

      this.redis.on('close', () => {
        this.isConnected = false;
      });

      this.redis.on('reconnecting', () => {
        // Don't log reconnection attempts to reduce spam
      });

      // Attempt connection
      await this.redis.connect();
      
    } catch (error: any) {
      if (!this.redisDisabled) {
        logger.info('Redis cache not available - running without cache');
        this.redisDisabled = true;
      }
      
      // Don't throw error - allow app to continue without cache
      this.redis = null;
      this.isConnected = false;
    }
  }

  async disconnect(): Promise<void> {
    if (this.redis) {
      await this.redis.quit();
      this.redis = null;
      this.isConnected = false;
      logger.info('Redis disconnected');
    }
  }

  private isAvailable(): boolean {
    return this.redis !== null && this.isConnected && !this.redisDisabled;
  }

  async get<T = any>(key: string): Promise<T | null> {
    if (!this.isAvailable()) {
      return null;
    }

    try {
      const start = Date.now();
      const value = await this.redis!.get(key);
      const duration = Date.now() - start;
      
      logContext.performance('Cache get operation', {
        operation: 'cache_get',
        duration,
        success: true,
        metadata: { key, hit: value !== null }
      });

      return value ? JSON.parse(value) : null;
    } catch (error: any) {
      logger.error('Cache get error', { 
        error: error.message,
        key,
        operation: 'cache_get'
      });
      return null;
    }
  }

  async set(key: string, value: any, ttl?: number): Promise<boolean> {
    if (!this.isAvailable()) {
      return false;
    }

    try {
      const start = Date.now();
      const serializedValue = JSON.stringify(value);
      const expiry = ttl || this.defaultTTL;
      
      await this.redis!.setex(key, expiry, serializedValue);
      
      const duration = Date.now() - start;
      logContext.performance('Cache set operation', {
        operation: 'cache_set',
        duration,
        success: true,
        metadata: { key, ttl: expiry, size: serializedValue.length }
      });

      return true;
    } catch (error: any) {
      logger.error('Cache set error', { 
        error: error.message,
        key,
        operation: 'cache_set'
      });
      return false;
    }
  }

  async delete(key: string): Promise<boolean> {
    if (!this.isAvailable()) {
      return false;
    }

    try {
      const result = await this.redis!.del(key);
      
      logContext.performance('Cache delete operation', {
        operation: 'cache_delete',
        duration: 0,
        success: true,
        metadata: { key, deleted: result > 0 }
      });

      return result > 0;
    } catch (error: any) {
      logger.error('Cache delete error', { 
        error: error.message,
        key,
        operation: 'cache_delete'
      });
      return false;
    }
  }

  async deletePattern(pattern: string): Promise<number> {
    if (!this.isAvailable()) {
      return 0;
    }

    try {
      const keys = await this.redis!.keys(pattern);
      if (keys.length === 0) return 0;
      
      const result = await this.redis!.del(...keys);
      
      logContext.performance('Cache delete pattern operation', {
        operation: 'cache_delete_pattern',
        duration: 0,
        success: true,
        metadata: { pattern, deletedCount: result }
      });

      return result;
    } catch (error: any) {
      logger.error('Cache delete pattern error', { 
        error: error.message,
        pattern,
        operation: 'cache_delete_pattern'
      });
      return 0;
    }
  }

  async exists(key: string): Promise<boolean> {
    if (!this.isAvailable()) {
      return false;
    }

    try {
      const result = await this.redis!.exists(key);
      return result === 1;
    } catch (error: any) {
      logger.error('Cache exists error', { 
        error: error.message,
        key,
        operation: 'cache_exists'
      });
      return false;
    }
  }

  async ttl(key: string): Promise<number> {
    if (!this.isAvailable()) {
      return -1;
    }

    try {
      return await this.redis!.ttl(key);
    } catch (error: any) {
      logger.error('Cache TTL error', { 
        error: error.message,
        key,
        operation: 'cache_ttl'
      });
      return -1;
    }
  }

  async increment(key: string, amount = 1): Promise<number> {
    if (!this.isAvailable()) {
      return 0;
    }

    try {
      return await this.redis!.incrby(key, amount);
    } catch (error: any) {
      logger.error('Cache increment error', { 
        error: error.message,
        key,
        amount,
        operation: 'cache_increment'
      });
      return 0;
    }
  }

  // RAG-specific caching methods
  async cacheRAGResults(
    query: string,
    projectId: string,
    results: any,
    ttl = 600 // 10 minutes for RAG results
  ): Promise<void> {
    const cacheKey = `rag:${projectId}:${this.hashQuery(query)}`;
    await this.set(cacheKey, {
      query,
      results,
      timestamp: Date.now()
    }, ttl);
  }

  async getRAGResults(query: string, projectId: string): Promise<any | null> {
    const cacheKey = `rag:${projectId}:${this.hashQuery(query)}`;
    return await this.get(cacheKey);
  }

  async cacheEmbedding(
    text: string,
    embedding: number[],
    ttl = 86400 // 24 hours for embeddings
  ): Promise<void> {
    const cacheKey = `embedding:${this.hashQuery(text)}`;
    await this.set(cacheKey, embedding, ttl);
  }

  async getEmbedding(text: string): Promise<number[] | null> {
    const cacheKey = `embedding:${this.hashQuery(text)}`;
    return await this.get(cacheKey);
  }

  async cacheProjectContext(
    projectId: string,
    context: any,
    ttl = 1800 // 30 minutes for project context
  ): Promise<void> {
    const cacheKey = `project:${projectId}:context`;
    await this.set(cacheKey, context, ttl);
  }

  async getProjectContext(projectId: string): Promise<any | null> {
    const cacheKey = `project:${projectId}:context`;
    return await this.get(cacheKey);
  }

  async invalidateProjectCache(projectId: string): Promise<void> {
    await this.deletePattern(`*:${projectId}:*`);
    await this.deletePattern(`project:${projectId}:*`);
    
    logger.info('Project cache invalidated', { projectId });
  }

  // Session caching for authentication
  async cacheUserSession(
    userId: number,
    sessionData: any,
    ttl = 86400 // 24 hours
  ): Promise<void> {
    const cacheKey = `session:${userId}`;
    await this.set(cacheKey, sessionData, ttl);
  }

  async getUserSession(userId: number): Promise<any | null> {
    const cacheKey = `session:${userId}`;
    return await this.get(cacheKey);
  }

  async invalidateUserSession(userId: number): Promise<void> {
    const cacheKey = `session:${userId}`;
    await this.delete(cacheKey);
  }

  // Rate limiting support
  async incrementRateLimit(
    key: string,
    windowSize: number,
    limit: number
  ): Promise<{ count: number; ttl: number; allowed: boolean }> {
    if (!this.isAvailable()) {
      return { count: 0, ttl: 0, allowed: true };
    }

    try {
      const current = await this.increment(key);
      let ttl = await this.ttl(key);
      
      if (current === 1) {
        await this.redis!.expire(key, windowSize);
        ttl = windowSize;
      }

      return {
        count: current,
        ttl,
        allowed: current <= limit
      };
    } catch (error: any) {
      logger.error('Rate limit error', { 
        error: error.message,
        key,
        operation: 'rate_limit'
      });
      return { count: 0, ttl: 0, allowed: true };
    }
  }

  // Utility methods
  private hashQuery(query: string): string {
    return crypto.createHash('md5').update(query).digest('hex');
  }

  async healthCheck(): Promise<{ status: string; latency?: number }> {
    if (!this.isAvailable()) {
      return { status: 'disconnected' };
    }

    try {
      const start = Date.now();
      await this.redis!.ping();
      const latency = Date.now() - start;
      
      return { status: 'healthy', latency };
    } catch (error: any) {
      return { status: 'error' };
    }
  }

  async getStats(): Promise<any> {
    if (!this.isAvailable()) {
      return null;
    }

    try {
      const info = await this.redis!.info();
      return this.parseRedisInfo(info);
    } catch (error: any) {
      logger.error('Failed to get cache stats', { error: error.message });
      return null;
    }
  }

  private parseRedisInfo(info: string): any {
    const lines = info.split('\r\n');
    const result: any = {};
    
    for (const line of lines) {
      if (line.includes(':')) {
        const [key, value] = line.split(':');
        result[key] = value;
      }
    }
    
    return result;
  }
}

// Create singleton instance
export const cache = new CacheService();

// Helper functions for common caching patterns
export async function withCache<T>(
  key: string,
  fetchFn: () => Promise<T>,
  ttl?: number
): Promise<T> {
  // Try cache first
  const cached = await cache.get<T>(key);
  if (cached !== null) {
    return cached;
  }

  // Fetch and cache
  const result = await fetchFn();
  await cache.set(key, result, ttl);
  
  return result;
}

export async function warmCache(): Promise<void> {
  logger.info('Warming up cache...');
  
  // Add any cache warming logic here
  // For example: pre-load frequently accessed data
  
  logger.info('Cache warm-up completed');
}

export default cache;