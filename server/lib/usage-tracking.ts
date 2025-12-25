import { db } from '../db.js';
import { usageEvents, usageCredits } from '../../shared/schema.js';
import { eq, and, gte, lte, sql, desc } from 'drizzle-orm';
import { costCalculator } from './cost-calculator.js';
import { subscriptionService } from './subscription-service.js';

export interface UsageEventData {
  companyId: number;
  projectId?: string;
  userId?: number;
  eventType: string;
  eventCategory: 'processing' | 'analysis' | 'generation' | 'storage';
  quantity: number;
  unit: string;
  metadata?: Record<string, any>;
}

export class UsageTrackingService {
  async trackUsage(data: UsageEventData): Promise<number> {
    const { companyId, eventType, quantity, metadata = {} } = data;
    
    if (quantity <= 0) {
      throw new Error('Quantity must be greater than 0');
    }
    
    const cost = this.calculateEventCost(eventType, quantity, metadata);
    const billingPeriod = await this.getCurrentBillingPeriod(companyId);
    
    const credit = await this.findAvailableCredit(companyId, eventType, quantity);
    
    let finalCost = cost;
    let isIncluded = false;
    let creditUsed = 0;
    
    if (credit) {
      const remaining = credit.quantity - (credit.usedQuantity || 0);
      creditUsed = Math.min(quantity, Math.max(0, remaining));
      
      if (creditUsed > 0) {
        // Try to apply credit atomically - if it fails, charge full cost
        const creditApplied = await this.useCredit(credit.id, creditUsed);
        if (creditApplied) {
          if (creditUsed < quantity) {
            finalCost = cost * ((quantity - creditUsed) / quantity);
            isIncluded = false;
          } else {
            finalCost = 0;
            isIncluded = true;
          }
        } else {
          // Credit application failed (likely race condition), charge full cost
          creditUsed = 0;
          finalCost = cost;
          isIncluded = false;
        }
      }
    }
    
    const unitCost = quantity > 0 ? cost / quantity : 0;
    
    const [event] = await db.insert(usageEvents).values({
      companyId,
      projectId: data.projectId,
      userId: data.userId,
      eventType,
      eventCategory: data.eventCategory,
      quantity,
      unit: data.unit,
      unitCost,
      totalCost: finalCost,
      metadata,
      billingPeriodStart: billingPeriod.start,
      billingPeriodEnd: billingPeriod.end,
      isIncluded,
      isBilled: false,
    }).returning();
    
    return event.id;
  }
  
  private calculateEventCost(
    eventType: string,
    quantity: number,
    metadata: Record<string, any>
  ): number {
    switch (eventType) {
      case 'document_processed':
        return costCalculator.calculateDocumentProcessingCost(
          metadata.documentType || 'pdf',
          quantity,
          metadata.requiresOCR || false
        );
      
      case 'deep_analysis':
        return costCalculator.calculateAnalysisCost('deep');
      
      case 'basic_analysis':
        return costCalculator.calculateAnalysisCost('basic');
      
      case 'bid_generated':
        return costCalculator.calculateGenerationCost(
          metadata.model || 'deepseek',
          metadata.inputTokens || 0,
          metadata.outputTokens || 0
        );
      
      case 'blueprint_analyzed':
        return costCalculator.calculateBlueprintCost(
          metadata.analysisType || 'sketch'
        );
      
      case 'rfp_analysis':
        // RFP analysis uses deep analysis pricing by default
        return costCalculator.calculateAnalysisCost('deep');
      
      default:
        return 0;
    }
  }
  
  private async findAvailableCredit(
    companyId: number,
    eventType: string,
    quantity: number
  ) {
    const creditTypeMap: Record<string, string> = {
      'deep_analysis': 'deep_analysis',
      'rfp_analysis': 'deep_analysis',
      'bid_generated': 'bid_generation',
      'document_processed': 'document_page',
      'blueprint_analyzed': 'blueprint_analysis',
    };
    
    const creditType = creditTypeMap[eventType];
    if (!creditType) return null;
    
    const now = new Date();
    
    const [credit] = await db
      .select()
      .from(usageCredits)
      .where(
        and(
          eq(usageCredits.companyId, companyId),
          eq(usageCredits.creditType, creditType),
          lte(usageCredits.validFrom, now),
          gte(usageCredits.validUntil, now),
          sql`${usageCredits.quantity} - COALESCE(${usageCredits.usedQuantity}, 0) > 0`
        )
      )
      .orderBy(desc(usageCredits.validUntil))
      .limit(1);
    
    return credit;
  }
  
  private async useCredit(creditId: number, quantity: number): Promise<boolean> {
    // Use atomic update with remaining check to prevent race conditions
    const result = await db
      .update(usageCredits)
      .set({
        usedQuantity: sql`COALESCE(${usageCredits.usedQuantity}, 0) + ${quantity}`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(usageCredits.id, creditId),
          sql`${usageCredits.quantity} - COALESCE(${usageCredits.usedQuantity}, 0) >= ${quantity}`
        )
      )
      .returning();
    
    // Return true if the update affected a row (credit was successfully applied)
    return result.length > 0;
  }
  
  private async getCurrentBillingPeriod(companyId: number): Promise<{
    start: Date;
    end: Date;
  }> {
    try {
      const subscription = await subscriptionService.getCompanySubscription(companyId);
      
      if (subscription?.subscription) {
        return {
          start: subscription.subscription.currentPeriodStart,
          end: subscription.subscription.currentPeriodEnd,
        };
      }
    } catch (error) {
      console.error('Error getting subscription for billing period:', error);
    }
    
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    
    return { start, end };
  }
  
  async getUsageSummary(companyId: number, periodStart: Date, periodEnd: Date) {
    const events = await db
      .select()
      .from(usageEvents)
      .where(
        and(
          eq(usageEvents.companyId, companyId),
          gte(usageEvents.billingPeriodStart, periodStart),
          lte(usageEvents.billingPeriodEnd, periodEnd)
        )
      );
    
    const now = new Date();
    const credits = await db
      .select()
      .from(usageCredits)
      .where(
        and(
          eq(usageCredits.companyId, companyId),
          lte(usageCredits.validFrom, now),
          gte(usageCredits.validUntil, now)
        )
      );
    
    const creditsRemaining: Record<string, number> = {};
    for (const credit of credits) {
      const remaining = credit.quantity - (credit.usedQuantity || 0);
      creditsRemaining[credit.creditType] = Math.max(0, remaining);
    }
    
    const breakdown: Record<string, { count: number; cost: number; included: number; overage: number }> = {};
    let totalCost = 0;
    let includedCost = 0;
    let overageCost = 0;
    
    for (const event of events) {
      const type = event.eventType;
      if (!breakdown[type]) {
        breakdown[type] = { count: 0, cost: 0, included: 0, overage: 0 };
      }
      
      breakdown[type].count += 1;
      breakdown[type].cost += event.totalCost;
      totalCost += event.totalCost;
      
      if (event.isIncluded) {
        breakdown[type].included += 1;
        includedCost += event.totalCost;
      } else {
        breakdown[type].overage += 1;
        overageCost += event.totalCost;
      }
    }
    
    return {
      period_start: periodStart,
      period_end: periodEnd,
      credits_remaining: creditsRemaining,
      usage_summary: {
        total_cost: totalCost,
        included_cost: includedCost,
        overage_cost: overageCost,
      },
      breakdown: Object.entries(breakdown).map(([event_type, data]) => ({
        event_type,
        ...data,
      })),
    };
  }
}

export const usageTracking = new UsageTrackingService();
