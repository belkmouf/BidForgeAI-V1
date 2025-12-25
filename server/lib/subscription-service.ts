import { db } from '../db.js';
import { companySubscriptions, subscriptionPlans, usageCredits } from '../../shared/schema.js';
import { eq, and, sql } from 'drizzle-orm';

export class SubscriptionService {
  async getCompanySubscription(companyId: number) {
    const [subscription] = await db
      .select()
      .from(companySubscriptions)
      .where(
        and(
          eq(companySubscriptions.companyId, companyId),
          eq(companySubscriptions.status, 'active')
        )
      )
      .limit(1);
    
    if (!subscription) {
      return null;
    }
    
    const [plan] = await db
      .select()
      .from(subscriptionPlans)
      .where(eq(subscriptionPlans.id, subscription.planId))
      .limit(1);
    
    return {
      subscription,
      plan: plan || null,
    };
  }
  
  async createSubscription(
    companyId: number,
    planId: number,
    paymentMethodId: string
  ) {
    const [plan] = await db
      .select()
      .from(subscriptionPlans)
      .where(eq(subscriptionPlans.id, planId))
      .limit(1);
    
    if (!plan) {
      throw new Error('Plan not found');
    }
    
    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + 1);
    
    const [subscription] = await db.transaction(async (tx) => {
      const [newSubscription] = await tx.insert(companySubscriptions).values({
        companyId,
        planId,
        status: 'active',
        billingCycle: 'monthly',
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        basePrice: plan.basePrice,
        discountPercent: 0,
        finalPrice: plan.basePrice,
        paymentMethodId,
        autoRenew: true,
      }).returning();
      
      const includedCredits = plan.includedCredits as Record<string, number> || {};
      for (const [creditType, quantity] of Object.entries(includedCredits)) {
        if (quantity > 0) {
          await tx.insert(usageCredits).values({
            companyId,
            subscriptionId: newSubscription.id,
            creditType,
            quantity,
            usedQuantity: 0,
            validFrom: now,
            validUntil: periodEnd,
            source: 'subscription',
            sourceReference: `plan_${planId}`,
          });
        }
      }
      
      return [newSubscription];
    });
    
    return subscription;
  }
  
  async cancelSubscription(subscriptionId: number, reason?: string) {
    const [updated] = await db
      .update(companySubscriptions)
      .set({
        cancelAtPeriodEnd: true,
        cancelReason: reason || null,
        updatedAt: new Date(),
      })
      .where(eq(companySubscriptions.id, subscriptionId))
      .returning();
    
    return updated;
  }
  
  async updateSubscriptionStatus(subscriptionId: number, status: string) {
    const [updated] = await db
      .update(companySubscriptions)
      .set({
        status,
        cancelledAt: status === 'cancelled' ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(companySubscriptions.id, subscriptionId))
      .returning();
    
    return updated;
  }
  
  async getPlans(activeOnly = true) {
    let query = db.select().from(subscriptionPlans);
    
    if (activeOnly) {
      query = query.where(eq(subscriptionPlans.isActive, true)) as typeof query;
    }
    
    return query.orderBy(subscriptionPlans.tier);
  }
}

export const subscriptionService = new SubscriptionService();
