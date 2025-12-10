import type { Request, Response } from 'express';
import { z } from 'zod';
import { websiteFetcher } from '../lib/website-fetcher.js';
import { logContext } from '../lib/logger.js';

const FetchWebsiteInfoSchema = z.object({
  website: z.string().url('Invalid website URL'),
  useCache: z.boolean().optional().default(true)
});

const BatchFetchSchema = z.object({
  websites: z.array(z.string().url()).max(5, 'Maximum 5 websites allowed'),
  useCache: z.boolean().optional().default(true)
});

export async function fetchWebsiteInfo(req: Request, res: Response): Promise<void> {
  try {
    const { website, useCache } = FetchWebsiteInfoSchema.parse(req.body);
    const userId = (req as any).user?.userId;
    
    logContext.audit('Website info fetch requested', {
      userId,
      website,
      userAgent: req.get('User-Agent'),
      ip: req.ip
    });

    const result = await websiteFetcher.fetchCompanyInfo(website, {
      useCache,
      timeout: 15000
    });

    logContext.audit('Website info fetch completed', {
      userId,
      website,
      confidence: result.confidence,
      fieldsFound: Object.keys(result).filter(k => result[k as keyof typeof result]).length
    });

    res.json({
      success: true,
      data: result,
      cached: false // TODO: Implement cache hit detection
    });

  } catch (error: any) {
    logContext.security('Website info fetch failed', {
      userId: (req as any).user?.userId,
      error: error.message,
      website: req.body?.website,
      action: 'website_info_fetch',
      result: 'failure'
    });

    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: error.errors
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: 'Failed to fetch website information'
    });
  }
}

export async function batchFetchWebsiteInfo(req: Request, res: Response): Promise<void> {
  try {
    const { websites, useCache } = BatchFetchSchema.parse(req.body);
    const userId = (req as any).user?.userId;

    logContext.audit('Batch website info fetch requested', {
      userId,
      websiteCount: websites.length,
      userAgent: req.get('User-Agent'),
      ip: req.ip
    });

    const results = await Promise.allSettled(
      websites.map(website => 
        websiteFetcher.fetchCompanyInfo(website, {
          useCache,
          timeout: 10000
        }).then(data => ({ website, data }))
      )
    );

    const successfulResults = results
      .filter((result): result is PromiseFulfilledResult<{ website: string; data: any }> => 
        result.status === 'fulfilled'
      )
      .map(result => result.value);

    const failedResults = results
      .map((result, index) => ({ 
        website: websites[index], 
        result 
      }))
      .filter(({ result }) => result.status === 'rejected')
      .map(({ website, result }) => ({ 
        website, 
        error: (result as PromiseRejectedResult).reason?.message || 'Unknown error'
      }));

    logContext.audit('Batch website info fetch completed', {
      userId,
      totalRequested: websites.length,
      successful: successfulResults.length,
      failed: failedResults.length
    });

    res.json({
      success: true,
      data: {
        successful: successfulResults,
        failed: failedResults,
        summary: {
          total: websites.length,
          successful: successfulResults.length,
          failed: failedResults.length
        }
      }
    });

  } catch (error: any) {
    logContext.security('Batch website info fetch failed', {
      userId: (req as any).user?.userId,
      error: error.message,
      action: 'batch_website_info_fetch',
      result: 'failure'
    });

    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: error.errors
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: 'Failed to fetch website information'
    });
  }
}

export async function getWebsiteInfoCache(req: Request, res: Response): Promise<void> {
  try {
    const { website } = z.object({
      website: z.string().url()
    }).parse(req.query);

    const userId = (req as any).user?.userId;
    const normalizedUrl = website.startsWith('http') ? website : `https://${website}`;
    
    // Try to get from cache
    const cacheKey = `website_info:${Buffer.from(normalizedUrl).toString('base64')}`;
    // This would need to be implemented in the cache service
    // const cachedData = await cache.get(cacheKey);
    
    res.json({
      success: true,
      data: null, // cachedData ? JSON.parse(cachedData) : null,
      cached: false // !!cachedData
    });

  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: 'Invalid website URL'
    });
  }
}