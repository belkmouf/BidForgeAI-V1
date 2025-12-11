import type { Request, Response } from 'express';
import { z } from 'zod';
import { websiteFetcher, type CompanyInfo } from '../lib/website-fetcher.js';
import { companyIntelligenceService } from '../lib/company-intelligence.js';
import { logContext } from '../lib/logger.js';

const FetchWebsiteInfoSchema = z.object({
  website: z.string().url('Invalid website URL'),
  useCache: z.boolean().optional().default(true)
});

const SaveWebsiteInfoSchema = z.object({
  websiteInfo: z.object({
    name: z.string().optional(),
    description: z.string().optional(),
    fullAboutContent: z.string().optional(),
    website: z.string().optional(),
    email: z.string().optional(),
    phone: z.string().optional(),
    address: z.string().optional(),
    industry: z.string().optional(),
    size: z.string().optional(),
    founded: z.string().optional(),
    linkedin: z.string().optional(),
    twitter: z.string().optional(),
    facebook: z.string().optional(),
    instagram: z.string().optional(),
    youtube: z.string().optional(),
    logo: z.string().optional(),
    products: z.array(z.object({
      name: z.string(),
      description: z.string().optional(),
      category: z.string().optional(),
      type: z.enum(['product', 'service'])
    })).optional(),
    services: z.array(z.object({
      name: z.string(),
      description: z.string().optional(),
      category: z.string().optional(),
      type: z.enum(['product', 'service'])
    })).optional(),
    confidence: z.number()
  }),
  saveToRag: z.boolean().optional().default(true)
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

/**
 * Save fetched website info to branding profile and RAG knowledge base
 */
export async function saveWebsiteInfo(req: Request, res: Response): Promise<void> {
  try {
    const { websiteInfo, saveToRag } = SaveWebsiteInfoSchema.parse(req.body);
    const userId = (req as any).user?.userId;
    const companyId = (req as any).user?.companyId;

    if (!userId || !companyId) {
      res.status(401).json({
        success: false,
        error: 'Authentication required with company context'
      });
      return;
    }

    logContext.audit('Website info save requested', {
      userId,
      companyId,
      website: websiteInfo.website,
      saveToRag,
      fieldsProvided: Object.keys(websiteInfo).filter(k => websiteInfo[k as keyof typeof websiteInfo]).length
    });

    // Save to branding profile and optionally to RAG
    const result = await companyIntelligenceService.saveCompanyIntelligence(
      websiteInfo as CompanyInfo,
      userId,
      companyId
    );

    logContext.audit('Website info saved successfully', {
      userId,
      companyId,
      documentId: result.documentId,
      chunksCreated: result.chunksCreated,
      brandingUpdated: result.brandingProfileUpdated
    });

    res.json({
      success: true,
      data: {
        documentId: result.documentId,
        chunksCreated: result.chunksCreated,
        brandingProfileUpdated: result.brandingProfileUpdated,
        ragIntegrated: saveToRag && result.chunksCreated > 0
      }
    });

  } catch (error: any) {
    logContext.security('Website info save failed', {
      userId: (req as any).user?.userId,
      error: error.message,
      action: 'website_info_save',
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
      error: 'Failed to save website information'
    });
  }
}

/**
 * Fetch website info and immediately save it to branding + RAG
 */
export async function fetchAndSaveWebsiteInfo(req: Request, res: Response): Promise<void> {
  try {
    const { website, useCache } = FetchWebsiteInfoSchema.parse(req.body);
    const userId = (req as any).user?.userId;
    const companyId = (req as any).user?.companyId;

    if (!userId || !companyId) {
      res.status(401).json({
        success: false,
        error: 'Authentication required with company context'
      });
      return;
    }

    logContext.audit('Website fetch and save requested', {
      userId,
      companyId,
      website
    });

    // Fetch website info
    const websiteInfo = await websiteFetcher.fetchCompanyInfo(website, {
      useCache,
      timeout: 15000
    });

    // Save to branding profile and RAG
    const saveResult = await companyIntelligenceService.saveCompanyIntelligence(
      websiteInfo,
      userId,
      companyId
    );

    logContext.audit('Website fetch and save completed', {
      userId,
      companyId,
      website,
      confidence: websiteInfo.confidence,
      documentId: saveResult.documentId,
      chunksCreated: saveResult.chunksCreated
    });

    res.json({
      success: true,
      data: {
        websiteInfo,
        saved: {
          documentId: saveResult.documentId,
          chunksCreated: saveResult.chunksCreated,
          brandingProfileUpdated: saveResult.brandingProfileUpdated
        }
      }
    });

  } catch (error: any) {
    logContext.security('Website fetch and save failed', {
      userId: (req as any).user?.userId,
      error: error.message,
      website: req.body?.website,
      action: 'website_fetch_and_save',
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
      error: 'Failed to fetch and save website information'
    });
  }
}