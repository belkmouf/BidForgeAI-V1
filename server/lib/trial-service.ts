import { db } from '../db.js';
import { companySubscriptions, subscriptionPlans } from '../../shared/schema.js';
import { eq, and, lte } from 'drizzle-orm';
import { subscriptionService } from './subscription-service.js';

export class TrialService {
  async isTrialExpired(companyId: number): Promise<boolean> {
    const subscription = await this.getTrialSubscription(companyId);
    if (!subscription) return false;
    
    const now = new Date();
    return now > subscription.subscription.currentPeriodEnd;
  }
  
  async getTrialSubscription(companyId: number) {
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
          eq(subscriptionPlans.tier, 0),
          eq(companySubscriptions.status, 'active')
        )
      )
      .limit(1);
    
    return subscription;
  }
  
  async createTrial(companyId: number): Promise<void> {
    const existing = await subscriptionService.getCompanySubscription(companyId);
    if (existing) {
      return;
    }
    
    const [trialPlan] = await db
      .select()
      .from(subscriptionPlans)
      .where(eq(subscriptionPlans.tier, 0))
      .limit(1);
    
    if (!trialPlan) {
      console.error('Trial plan not found in database');
      return;
    }
    
    await subscriptionService.createSubscription(companyId, trialPlan.id, 'monthly');
    console.log(`Created trial subscription for company ${companyId}`);
  }
  
  async expireTrial(companyId: number): Promise<void> {
    await db
      .update(companySubscriptions)
      .set({
        status: 'expired',
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(companySubscriptions.companyId, companyId),
          eq(companySubscriptions.status, 'active')
        )
      );
  }
  
  async expireExpiredTrials(): Promise<number> {
    const now = new Date();
    
    const expiredTrials = await db
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
          eq(subscriptionPlans.tier, 0),
          eq(companySubscriptions.status, 'active'),
          lte(companySubscriptions.currentPeriodEnd, now)
        )
      );
    
    for (const trial of expiredTrials) {
      await this.expireTrial(trial.subscription.companyId);
    }
    
    return expiredTrials.length;
  }
  
  async getTrialRemainingTime(companyId: number): Promise<{
    remainingHours: number;
    remainingDays: number;
    expiresAt: Date | null;
    isExpired: boolean;
  } | null> {
    const subscription = await this.getTrialSubscription(companyId);
    if (!subscription) {
      return null;
    }
    
    const now = new Date();
    const expiresAt = subscription.subscription.currentPeriodEnd;
    const remainingMs = expiresAt.getTime() - now.getTime();
    
    return {
      remainingHours: Math.max(0, Math.floor(remainingMs / (1000 * 60 * 60))),
      remainingDays: Math.max(0, Math.floor(remainingMs / (1000 * 60 * 60 * 24))),
      expiresAt,
      isExpired: remainingMs <= 0,
    };
  }
}

export const trialService = new TrialService();
