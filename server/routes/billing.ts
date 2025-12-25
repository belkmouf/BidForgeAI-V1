import { Router, Request, Response } from 'express';
import { db } from '../db.js';
import { subscriptionPlans, usageEvents, usageCredits, invoices } from '../../shared/schema.js';
import { eq, and, gte, lte, desc } from 'drizzle-orm';
import { z } from 'zod';
import { subscriptionService } from '../lib/subscription-service.js';
import { usageTracking } from '../lib/usage-tracking.js';

interface AuthRequest extends Request {
  user?: {
    id: number;
    companyId: number;
    role: string;
  };
}

const router = Router();

router.get('/subscription', async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const companyId = req.user.companyId;
    const result = await subscriptionService.getCompanySubscription(companyId);
    
    if (!result) {
      return res.json({ subscription: null, usage: null });
    }
    
    const usage = await usageTracking.getUsageSummary(
      companyId,
      result.subscription.currentPeriodStart,
      result.subscription.currentPeriodEnd
    );
    
    res.json({
      subscription: {
        ...result.subscription,
        plan: result.plan,
      },
      usage,
    });
  } catch (error) {
    console.error('Error getting subscription:', error);
    res.status(500).json({ error: 'Failed to get subscription' });
  }
});

router.get('/plans', async (req: Request, res: Response) => {
  try {
    const plans = await db
      .select()
      .from(subscriptionPlans)
      .where(eq(subscriptionPlans.isActive, true))
      .orderBy(subscriptionPlans.tier);
    
    res.json({ plans });
  } catch (error) {
    console.error('Error getting plans:', error);
    res.status(500).json({ error: 'Failed to get plans' });
  }
});

router.post('/subscribe', async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const schema = z.object({
      plan_id: z.number().int().positive(),
      payment_method_id: z.string().min(1),
    });
    
    const { plan_id, payment_method_id } = schema.parse(req.body);
    const companyId = req.user.companyId;
    
    const existing = await subscriptionService.getCompanySubscription(companyId);
    if (existing) {
      return res.status(400).json({ 
        error: 'Company already has an active subscription. Please cancel existing subscription first.' 
      });
    }
    
    const subscription = await subscriptionService.createSubscription(
      companyId,
      plan_id,
      payment_method_id
    );
    
    res.json({ subscription });
  } catch (error) {
    console.error('Error creating subscription:', error);
    res.status(500).json({ error: 'Failed to create subscription' });
  }
});

router.post('/cancel', async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const schema = z.object({
      reason: z.string().optional(),
    });
    
    const { reason } = schema.parse(req.body);
    const companyId = req.user.companyId;
    
    const existing = await subscriptionService.getCompanySubscription(companyId);
    if (!existing) {
      return res.status(404).json({ error: 'No active subscription found' });
    }
    
    const updated = await subscriptionService.cancelSubscription(
      existing.subscription.id,
      reason
    );
    
    res.json({ subscription: updated });
  } catch (error) {
    console.error('Error cancelling subscription:', error);
    res.status(500).json({ error: 'Failed to cancel subscription' });
  }
});

router.get('/usage', async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const companyId = req.user.companyId;
    const subscription = await subscriptionService.getCompanySubscription(companyId);
    
    let periodStart: Date;
    let periodEnd: Date;
    
    if (subscription) {
      periodStart = subscription.subscription.currentPeriodStart;
      periodEnd = subscription.subscription.currentPeriodEnd;
    } else {
      const now = new Date();
      periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
      periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    }
    
    const usage = await usageTracking.getUsageSummary(companyId, periodStart, periodEnd);
    res.json(usage);
  } catch (error) {
    console.error('Error getting usage:', error);
    res.status(500).json({ error: 'Failed to get usage' });
  }
});

router.get('/invoices', async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const companyId = req.user.companyId;
    const companyInvoices = await db
      .select()
      .from(invoices)
      .where(eq(invoices.companyId, companyId))
      .orderBy(desc(invoices.createdAt));
    
    res.json({ invoices: companyInvoices });
  } catch (error) {
    console.error('Error getting invoices:', error);
    res.status(500).json({ error: 'Failed to get invoices' });
  }
});

router.get('/credits', async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const companyId = req.user.companyId;
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
    
    const creditsRemaining: Record<string, { total: number; used: number; remaining: number }> = {};
    
    for (const credit of credits) {
      const used = credit.usedQuantity || 0;
      const remaining = credit.quantity - used;
      
      if (!creditsRemaining[credit.creditType]) {
        creditsRemaining[credit.creditType] = { total: 0, used: 0, remaining: 0 };
      }
      
      creditsRemaining[credit.creditType].total += credit.quantity;
      creditsRemaining[credit.creditType].used += used;
      creditsRemaining[credit.creditType].remaining += Math.max(0, remaining);
    }
    
    res.json({ credits: creditsRemaining });
  } catch (error) {
    console.error('Error getting credits:', error);
    res.status(500).json({ error: 'Failed to get credits' });
  }
});

export default router;
