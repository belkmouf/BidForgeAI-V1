import { db } from '../db.js';
import { 
  subscriptionPlans, 
  companySubscriptions,
  companyUsageLimits
} from '../../shared/schema.js';
import { eq, and, sql } from 'drizzle-orm';

export class SubscriptionService {
  async getCompanySubscription(companyId: number) {
    const [subscription] = await db
      .select({
        subscription: companySubscriptions,
        plan: subscriptionPlans,
      })
      .from(companySubscriptions)
      .innerJoin(
        subscriptionPlans,
        eq(companySubscriptions.planId, subscriptionPlans.id)
      )
      .where(
        and(
          eq(companySubscriptions.companyId, companyId),
          eq(companySubscriptions.status, 'active')
        )
      )
      .limit(1);
    
    return subscription;
  }
  
  async createSubscription(
    companyId: number,
    planId: number,
    billingCycle: 'monthly' | 'annual' = 'monthly',
    stripeSubscriptionId?: string,
    stripeCustomerId?: string
  ) {
    const [plan] = await db
      .select()
      .from(subscriptionPlans)
      .where(
        and(
          eq(subscriptionPlans.id, planId),
          eq(subscriptionPlans.isActive, true)
        )
      )
      .limit(1);
    
    if (!plan) {
      throw new Error('Plan not found');
    }
    
    const now = new Date();
    let periodEnd: Date;
    let finalPrice: number;
    
    if (plan.tier === 0) {
      periodEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      finalPrice = 0;
    } else if (billingCycle === 'annual') {
      periodEnd = new Date(now);
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
      finalPrice = plan.annualPrice || (plan.monthlyPrice || 0) * 12;
    } else {
      periodEnd = new Date(now);
      periodEnd.setMonth(periodEnd.getMonth() + 1);
      finalPrice = plan.monthlyPrice || 0;
    }
    
    return await db.transaction(async (tx) => {
      const [subscription] = await tx
        .insert(companySubscriptions)
        .values({
          companyId,
          planId,
          status: 'active',
          billingCycle: plan.tier === 0 ? 'trial' : billingCycle,
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          monthlyPrice: plan.monthlyPrice || 0,
          annualPrice: plan.annualPrice,
          finalPrice,
          stripeSubscriptionId,
          stripeCustomerId,
          autoRenew: plan.tier !== 0,
          extraProjectsPurchased: 0,
        })
        .returning();
      
      await this.initializeUsageLimits(companyId, subscription, plan, tx);
      
      return subscription;
    });
  }
  
  private async initializeUsageLimits(
    companyId: number,
    subscription: typeof companySubscriptions.$inferSelect,
    plan: typeof subscriptionPlans.$inferSelect,
    tx?: any
  ) {
    const dbInstance = tx || db;
    
    const extraProjects = subscription.extraProjectsPurchased || 0;
    const effectiveProjectLimit = plan.monthlyProjectLimit 
      ? plan.monthlyProjectLimit + extraProjects 
      : 999999999;
    const effectiveDocumentLimit = plan.monthlyDocumentLimit 
      ? plan.monthlyDocumentLimit + (extraProjects * (plan.extraProjectDocBonus || 0))
      : 999999999;
    const effectiveBidLimit = plan.monthlyBidLimit || null;
    
    await dbInstance
      .insert(companyUsageLimits)
      .values({
        companyId,
        currentPeriodStart: subscription.currentPeriodStart,
        currentPeriodEnd: subscription.currentPeriodEnd,
        projectsUsed: 0,
        documentsUsed: 0,
        bidsUsed: 0,
        projectLimit: effectiveProjectLimit,
        documentLimit: effectiveDocumentLimit,
        bidLimit: effectiveBidLimit,
      })
      .onConflictDoUpdate({
        target: companyUsageLimits.companyId,
        set: {
          currentPeriodStart: subscription.currentPeriodStart,
          currentPeriodEnd: subscription.currentPeriodEnd,
          projectLimit: effectiveProjectLimit,
          documentLimit: effectiveDocumentLimit,
          bidLimit: effectiveBidLimit,
          projectsUsed: 0,
          documentsUsed: 0,
          bidsUsed: 0,
          updatedAt: new Date(),
        },
      });
  }
  
  async addExtraProjects(companyId: number, quantity: number) {
    const subscription = await this.getCompanySubscription(companyId);
    if (!subscription) {
      throw new Error('No active subscription');
    }
    
    const plan = subscription.plan;
    
    if (plan.tier === 0 || plan.tier === 3 || !plan.extraProjectFee) {
      throw new Error('Extra projects not available for this tier');
    }
    
    return await db.transaction(async (tx) => {
      const [updated] = await tx
        .update(companySubscriptions)
        .set({
          extraProjectsPurchased: sql`${companySubscriptions.extraProjectsPurchased} + ${quantity}`,
          updatedAt: new Date(),
        })
        .where(eq(companySubscriptions.companyId, companyId))
        .returning();
      
      await this.initializeUsageLimits(companyId, updated, plan, tx);
      
      return {
        quantity,
        cost: plan.extraProjectFee * quantity,
        bonusDocuments: (plan.extraProjectDocBonus || 0) * quantity,
      };
    });
  }
  
  async cancelSubscription(
    companyId: number,
    cancelAtPeriodEnd: boolean = true,
    reason?: string
  ) {
    if (cancelAtPeriodEnd) {
      await db
        .update(companySubscriptions)
        .set({
          cancelAtPeriodEnd: true,
          cancelReason: reason,
          updatedAt: new Date(),
        })
        .where(eq(companySubscriptions.companyId, companyId));
    } else {
      await db
        .update(companySubscriptions)
        .set({
          status: 'cancelled',
          cancelledAt: new Date(),
          cancelReason: reason,
          updatedAt: new Date(),
        })
        .where(eq(companySubscriptions.companyId, companyId));
    }
  }

  async getAllPlans() {
    return await db
      .select()
      .from(subscriptionPlans)
      .where(eq(subscriptionPlans.isActive, true))
      .orderBy(subscriptionPlans.tier);
  }
  
  async getTrialPlan() {
    const [plan] = await db
      .select()
      .from(subscriptionPlans)
      .where(
        and(
          eq(subscriptionPlans.tier, 0),
          eq(subscriptionPlans.isActive, true)
        )
      )
      .limit(1);
    return plan;
  }
  
  async changePlan(
    companyId: number,
    newPlanId: number,
    billingCycle: 'monthly' | 'annual' = 'monthly'
  ) {
    const currentSub = await this.getCompanySubscription(companyId);
    
    const [newPlan] = await db
      .select()
      .from(subscriptionPlans)
      .where(
        and(
          eq(subscriptionPlans.id, newPlanId),
          eq(subscriptionPlans.isActive, true)
        )
      )
      .limit(1);
    
    if (!newPlan) {
      throw new Error('Plan not found');
    }
    
    // Check if downgrading and usage exceeds new limits
    if (currentSub) {
      const [currentUsage] = await db
        .select()
        .from(companyUsageLimits)
        .where(eq(companyUsageLimits.companyId, companyId))
        .limit(1);
      
      if (currentUsage) {
        const newProjectLimit = newPlan.monthlyProjectLimit || 999999999;
        const newDocLimit = newPlan.monthlyDocumentLimit || 999999999;
        const newBidLimit = newPlan.monthlyBidLimit || 999999999;
        
        if (currentUsage.projectsUsed > newProjectLimit) {
          throw new Error(`Cannot downgrade: you have ${currentUsage.projectsUsed} projects but new plan allows ${newProjectLimit}`);
        }
        if (currentUsage.documentsUsed > newDocLimit) {
          throw new Error(`Cannot downgrade: you have ${currentUsage.documentsUsed} documents but new plan allows ${newDocLimit}`);
        }
        if (newBidLimit !== 999999999 && currentUsage.bidsUsed > newBidLimit) {
          throw new Error(`Cannot downgrade: you have ${currentUsage.bidsUsed} bids but new plan allows ${newBidLimit}`);
        }
      }
    }
    
    const now = new Date();
    let periodEnd: Date;
    let finalPrice: number;
    
    if (newPlan.tier === 0) {
      periodEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      finalPrice = 0;
    } else if (billingCycle === 'annual') {
      periodEnd = new Date(now);
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
      finalPrice = newPlan.annualPrice || (newPlan.monthlyPrice || 0) * 12;
    } else {
      periodEnd = new Date(now);
      periodEnd.setMonth(periodEnd.getMonth() + 1);
      finalPrice = newPlan.monthlyPrice || 0;
    }
    
    return await db.transaction(async (tx) => {
      // Deactivate current subscription if exists
      if (currentSub) {
        await tx
          .update(companySubscriptions)
          .set({
            status: 'cancelled',
            cancelledAt: now,
            cancelReason: 'Plan changed',
            updatedAt: now,
          })
          .where(eq(companySubscriptions.id, currentSub.subscription.id));
      }
      
      // Create new subscription
      const [newSubscription] = await tx
        .insert(companySubscriptions)
        .values({
          companyId,
          planId: newPlanId,
          status: newPlan.tier === 0 ? 'active' : 'pending_payment',
          billingCycle: newPlan.tier === 0 ? 'trial' : billingCycle,
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          monthlyPrice: newPlan.monthlyPrice || 0,
          annualPrice: newPlan.annualPrice,
          finalPrice,
          autoRenew: newPlan.tier !== 0,
          extraProjectsPurchased: 0,
        })
        .returning();
      
      // Only initialize usage limits if active (trial or already paid)
      if (newPlan.tier === 0) {
        await this.initializeUsageLimits(companyId, newSubscription, newPlan, tx);
      }
      
      return {
        subscription: newSubscription,
        plan: newPlan,
        requiresPayment: newPlan.tier > 0,
      };
    });
  }
}

export const subscriptionService = new SubscriptionService();
