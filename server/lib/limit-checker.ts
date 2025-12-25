import { db } from '../db.js';
import { companyUsageLimits } from '../../shared/schema.js';
import { eq, sql } from 'drizzle-orm';

export interface LimitCheckResult {
  allowed: boolean;
  reason?: string;
  current: number;
  limit: number;
  remaining: number;
}

export class LimitCheckerService {
  async checkProjectLimit(companyId: number): Promise<LimitCheckResult> {
    const limits = await this.getCompanyLimits(companyId);
    if (!limits) {
      return {
        allowed: true,
        current: 0,
        limit: 999999999,
        remaining: 999999999,
      };
    }
    
    const current = limits.projectsUsed || 0;
    const limit = limits.projectLimit || 999999999;
    const allowed = current < limit;
    
    return {
      allowed,
      reason: allowed ? undefined : 'Project limit exceeded. Please upgrade your plan or purchase extra projects.',
      current,
      limit,
      remaining: Math.max(0, limit - current),
    };
  }
  
  async checkDocumentLimit(companyId: number): Promise<LimitCheckResult> {
    const limits = await this.getCompanyLimits(companyId);
    if (!limits) {
      return {
        allowed: true,
        current: 0,
        limit: 999999999,
        remaining: 999999999,
      };
    }
    
    const current = limits.documentsUsed || 0;
    const limit = limits.documentLimit || 999999999;
    const allowed = current < limit;
    
    return {
      allowed,
      reason: allowed ? undefined : 'Document limit exceeded. Please upgrade your plan.',
      current,
      limit,
      remaining: Math.max(0, limit - current),
    };
  }
  
  async checkBidLimit(companyId: number): Promise<LimitCheckResult> {
    const limits = await this.getCompanyLimits(companyId);
    if (!limits) {
      return {
        allowed: true,
        current: 0,
        limit: 999999999,
        remaining: 999999999,
      };
    }
    
    const current = limits.bidsUsed || 0;
    const limit = limits.bidLimit;
    const allowed = limit === null || current < limit;
    
    return {
      allowed,
      reason: allowed ? undefined : 'Bid generation limit exceeded. Please upgrade your plan.',
      current,
      limit: limit || 999999999,
      remaining: limit === null ? 999999999 : Math.max(0, limit - current),
    };
  }
  
  async incrementUsage(
    companyId: number,
    type: 'projects' | 'documents' | 'bids',
    amount: number = 1
  ): Promise<void> {
    const fieldMap = {
      projects: companyUsageLimits.projectsUsed,
      documents: companyUsageLimits.documentsUsed,
      bids: companyUsageLimits.bidsUsed,
    };
    
    await db
      .update(companyUsageLimits)
      .set({
        [type === 'projects' ? 'projectsUsed' : type === 'documents' ? 'documentsUsed' : 'bidsUsed']: 
          sql`COALESCE(${fieldMap[type]}, 0) + ${amount}`,
        updatedAt: new Date(),
      })
      .where(eq(companyUsageLimits.companyId, companyId));
  }
  
  private async getCompanyLimits(companyId: number) {
    const [limits] = await db
      .select()
      .from(companyUsageLimits)
      .where(eq(companyUsageLimits.companyId, companyId))
      .limit(1);
    
    return limits;
  }
  
  async getUsageSummary(companyId: number) {
    const limits = await this.getCompanyLimits(companyId);
    if (!limits) {
      return null;
    }
    
    return {
      period: {
        start: limits.currentPeriodStart,
        end: limits.currentPeriodEnd,
      },
      projects: {
        used: limits.projectsUsed || 0,
        limit: limits.projectLimit,
        remaining: Math.max(0, limits.projectLimit - (limits.projectsUsed || 0)),
      },
      documents: {
        used: limits.documentsUsed || 0,
        limit: limits.documentLimit,
        remaining: Math.max(0, limits.documentLimit - (limits.documentsUsed || 0)),
      },
      bids: {
        used: limits.bidsUsed || 0,
        limit: limits.bidLimit,
        remaining: limits.bidLimit === null 
          ? 999999999 
          : Math.max(0, limits.bidLimit - (limits.bidsUsed || 0)),
      },
    };
  }
}

export const limitChecker = new LimitCheckerService();
