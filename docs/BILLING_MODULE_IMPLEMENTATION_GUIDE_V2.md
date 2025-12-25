# BidForge AI - Billing Module Implementation Guide (Simplified)

**Version:** 2.0  
**Last Updated:** December 2024  
**Status:** Fresh Implementation - Simplified Schema  
**Reference:** `updated_billing_schema.md`

---

## 🎯 Overview

This guide implements a **simplified billing module** with:
- **4 Tiers**: Free Trial (Tier 0), The Sifter (Tier 1), The Estimator (Tier 2), Enterprise (Tier 3)
- **Direct Limits**: Simple integer columns for project, document, and bid limits
- **7-Day Trial**: Automatic trial with hard expiry after 168 hours
- **Extra Project Add-on**: $25 per project (+10 documents) for Tier 1 & 2
- **Deep Analysis**: Available for all tiers including trial

---

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Phase 1: Database Schema](#phase-1-database-schema)
3. [Phase 2: Core Services](#phase-2-core-services)
4. [Phase 3: API Endpoints](#phase-3-api-endpoints)
5. [Phase 4: Limit Enforcement](#phase-4-limit-enforcement)
6. [Phase 5: Trial Management](#phase-5-trial-management)
7. [Phase 6: Frontend Components](#phase-6-frontend-components)
8. [Phase 7: Testing](#phase-7-testing)

---

## Prerequisites

### Required Dependencies

```bash
npm install stripe @stripe/stripe-js
npm install --save-dev @types/stripe
```

### Environment Variables

Add to `.env`:
```env
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

---

## Phase 1: Database Schema

### Step 1.1: Create Subscription Plans Table

**File:** `shared/schema.ts`

**Action:** Add after existing tables:

```typescript
export const subscriptionPlans = pgTable("subscription_plans", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: varchar("name", { length: 100 }).notNull().unique(), // 'trial', 'sifter', 'estimator', 'enterprise'
  displayName: varchar("display_name", { length: 255 }).notNull(),
  tier: integer("tier").notNull(), // 0, 1, 2, 3
  
  // Pricing
  monthlyPrice: real("monthly_price").notNull(),
  annualPrice: real("annual_price"), // NULL for trial tier
  
  // Volume Limits (direct columns)
  monthlyProjectLimit: integer("monthly_project_limit"), // NULL = unlimited
  monthlyDocumentLimit: integer("monthly_document_limit").notNull(),
  monthlyBidLimit: integer("monthly_bid_limit"), // NULL = unlimited
  
  // Add-on Rules (for Tier 1 & 2 only)
  extraProjectFee: real("extra_project_fee"), // NULL if not available
  extraProjectDocBonus: integer("extra_project_doc_bonus"), // NULL if not available
  
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type SubscriptionPlan = typeof subscriptionPlans.$inferSelect;
export type InsertSubscriptionPlan = typeof subscriptionPlans.$inferInsert;
```

### Step 1.2: Create Company Subscriptions Table

**File:** `shared/schema.ts`

**Action:** Add after subscription plans:

```typescript
export const companySubscriptions = pgTable("company_subscriptions", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  companyId: integer("company_id")
    .notNull()
    .references(() => companies.id, { onDelete: "cascade" }),
  planId: integer("plan_id")
    .notNull()
    .references(() => subscriptionPlans.id),
  
  status: varchar("status", { length: 50 }).notNull().default("active"), // 'active', 'cancelled', 'expired'
  billingCycle: varchar("billing_cycle", { length: 20 }).default("monthly"), // 'trial', 'monthly', 'annual'
  
  currentPeriodStart: timestamp("current_period_start").notNull(),
  currentPeriodEnd: timestamp("current_period_end").notNull(),
  
  // Pricing
  monthlyPrice: real("monthly_price").notNull(),
  annualPrice: real("annual_price"),
  finalPrice: real("final_price").notNull(), // Actual price paid (after discounts)
  
  // Extra Projects Add-on
  extraProjectsPurchased: integer("extra_projects_purchased").default(0),
  
  // Payment
  stripeSubscriptionId: varchar("stripe_subscription_id", { length: 255 }),
  stripeCustomerId: varchar("stripe_customer_id", { length: 255 }),
  paymentMethodId: varchar("payment_method_id", { length: 255 }),
  
  autoRenew: boolean("auto_renew").default(true),
  
  // Cancellation
  cancelledAt: timestamp("cancelled_at"),
  cancelReason: text("cancel_reason"),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").default(false),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type CompanySubscription = typeof companySubscriptions.$inferSelect;
export type InsertCompanySubscription = typeof companySubscriptions.$inferInsert;
```

### Step 1.3: Create Company Usage Limits Table

**File:** `shared/schema.ts`

**Action:** Add after company subscriptions. This table tracks current period usage for fast limit checking:

```typescript
export const companyUsageLimits = pgTable("company_usage_limits", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  companyId: integer("company_id")
    .notNull()
    .references(() => companies.id, { onDelete: "cascade" })
    .unique(), // One record per company
  
  // Current Billing Period
  currentPeriodStart: timestamp("current_period_start").notNull(),
  currentPeriodEnd: timestamp("current_period_end").notNull(),
  
  // Usage Counters (reset each period)
  projectsUsed: integer("projects_used").default(0),
  documentsUsed: integer("documents_used").default(0),
  bidsUsed: integer("bids_used").default(0),
  
  // Current Limits (includes extra projects)
  projectLimit: integer("project_limit").notNull(),
  documentLimit: integer("document_limit").notNull(),
  bidLimit: integer("bid_limit"), // NULL = unlimited
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type CompanyUsageLimits = typeof companyUsageLimits.$inferSelect;
export type InsertCompanyUsageLimits = typeof companyUsageLimits.$inferInsert;
```

### Step 1.4: Create Database Indexes

**Action:** Run SQL to create indexes:

```sql
-- Company subscriptions indexes
CREATE INDEX IF NOT EXISTS company_subscriptions_company_idx 
ON company_subscriptions(company_id);

CREATE INDEX IF NOT EXISTS company_subscriptions_status_idx 
ON company_subscriptions(status);

CREATE UNIQUE INDEX IF NOT EXISTS company_subscriptions_active_unique 
ON company_subscriptions(company_id) WHERE status = 'active';

-- Usage limits indexes
CREATE INDEX IF NOT EXISTS company_usage_limits_company_idx 
ON company_usage_limits(company_id);

CREATE INDEX IF NOT EXISTS company_usage_limits_period_idx 
ON company_usage_limits(current_period_start, current_period_end);
```

### Step 1.5: Seed Subscription Plans

**File:** `server/scripts/seed-plans.ts`

**Action:** Create seed script:

```typescript
import { db } from '../db';
import { subscriptionPlans } from '../../shared/schema';

async function seedPlans() {
  const plans = [
    {
      name: 'trial',
      displayName: 'Free Trial',
      tier: 0,
      monthlyPrice: 0.00,
      annualPrice: null,
      monthlyProjectLimit: 1,
      monthlyDocumentLimit: 1,
      monthlyBidLimit: 2,
      extraProjectFee: null,
      extraProjectDocBonus: null,
    },
    {
      name: 'sifter',
      displayName: 'The Sifter',
      tier: 1,
      monthlyPrice: 99.00,
      annualPrice: 1099.00,
      monthlyProjectLimit: 5,
      monthlyDocumentLimit: 50,
      monthlyBidLimit: 15,
      extraProjectFee: 25.00,
      extraProjectDocBonus: 10,
    },
    {
      name: 'estimator',
      displayName: "The Estimator's Assistant",
      tier: 2,
      monthlyPrice: 299.00,
      annualPrice: 3289.00,
      monthlyProjectLimit: 20,
      monthlyDocumentLimit: 200,
      monthlyBidLimit: 60,
      extraProjectFee: 25.00,
      extraProjectDocBonus: 10,
    },
    {
      name: 'enterprise',
      displayName: 'Enterprise',
      tier: 3,
      monthlyPrice: 1500.00,
      annualPrice: 16500.00,
      monthlyProjectLimit: 200,
      monthlyDocumentLimit: 2000,
      monthlyBidLimit: null, // Unlimited
      extraProjectFee: null,
      extraProjectDocBonus: null,
    },
  ];
  
  for (const plan of plans) {
    try {
      await db.insert(subscriptionPlans).values(plan);
      console.log(`✓ Seeded plan: ${plan.displayName}`);
    } catch (error: any) {
      if (error.code === '23505') {
        console.log(`⚠ Plan ${plan.name} already exists, skipping`);
      } else {
        console.error(`✗ Error seeding plan ${plan.name}:`, error);
        throw error;
      }
    }
  }
  
  console.log('Plans seeded successfully');
}

seedPlans().catch(console.error);
```

**Run:** `npx tsx server/scripts/seed-plans.ts`

---

## Phase 2: Core Services

### Step 2.1: Create Subscription Service

**File:** `server/lib/subscription-service.ts`

**Action:** Create service:

```typescript
import { db } from '../db';
import { 
  subscriptionPlans, 
  companySubscriptions,
  companyUsageLimits
} from '../../shared/schema';
import { eq, and, sql } from 'drizzle-orm';

export class SubscriptionService {
  /**
   * Get active subscription for company
   */
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
  
  /**
   * Create subscription
   */
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
      // Trial: 7 days
      periodEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      finalPrice = 0;
    } else if (billingCycle === 'annual') {
      // Annual: 12 months
      periodEnd = new Date(now);
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
      finalPrice = plan.annualPrice || plan.monthlyPrice * 12;
    } else {
      // Monthly: 1 month
      periodEnd = new Date(now);
      periodEnd.setMonth(periodEnd.getMonth() + 1);
      finalPrice = plan.monthlyPrice;
    }
    
    return await db.transaction(async (tx) => {
      // Create subscription
      const [subscription] = await tx
        .insert(companySubscriptions)
        .values({
          companyId,
          planId,
          status: 'active',
          billingCycle: plan.tier === 0 ? 'trial' : billingCycle,
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          monthlyPrice: plan.monthlyPrice,
          annualPrice: plan.annualPrice,
          finalPrice,
          stripeSubscriptionId,
          stripeCustomerId,
          autoRenew: plan.tier !== 0, // Trials don't auto-renew
          extraProjectsPurchased: 0,
        })
        .returning();
      
      // Initialize usage limits
      await this.initializeUsageLimits(companyId, subscription, plan, tx);
      
      return subscription;
    });
  }
  
  /**
   * Initialize usage limits for subscription
   */
  private async initializeUsageLimits(
    companyId: number,
    subscription: typeof companySubscriptions.$inferSelect,
    plan: typeof subscriptionPlans.$inferSelect,
    tx?: any
  ) {
    const dbInstance = tx || db;
    
    // Calculate effective limits (base + extra projects)
    const extraProjects = subscription.extraProjectsPurchased || 0;
    const effectiveProjectLimit = plan.monthlyProjectLimit 
      ? plan.monthlyProjectLimit + extraProjects 
      : 999999999; // Unlimited
    const effectiveDocumentLimit = plan.monthlyDocumentLimit 
      ? plan.monthlyDocumentLimit + (extraProjects * (plan.extraProjectDocBonus || 0))
      : 999999999;
    const effectiveBidLimit = plan.monthlyBidLimit || null; // NULL = unlimited
    
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
          projectsUsed: 0, // Reset on new period
          documentsUsed: 0,
          bidsUsed: 0,
          updatedAt: new Date(),
        },
      });
  }
  
  /**
   * Add extra projects to subscription
   */
  async addExtraProjects(
    companyId: number,
    quantity: number
  ) {
    const subscription = await this.getCompanySubscription(companyId);
    if (!subscription) {
      throw new Error('No active subscription');
    }
    
    const plan = subscription.plan;
    
    // Check if add-on is available
    if (plan.tier === 0 || plan.tier === 3 || !plan.extraProjectFee) {
      throw new Error('Extra projects not available for this tier');
    }
    
    return await db.transaction(async (tx) => {
      // Update subscription
      const [updated] = await tx
        .update(companySubscriptions)
        .set({
          extraProjectsPurchased: sql`${companySubscriptions.extraProjectsPurchased} + ${quantity}`,
          updatedAt: new Date(),
        })
        .where(eq(companySubscriptions.companyId, companyId))
        .returning();
      
      // Recalculate limits
      await this.initializeUsageLimits(companyId, updated, plan, tx);
      
      return {
        quantity,
        cost: plan.extraProjectFee * quantity,
        bonusDocuments: (plan.extraProjectDocBonus || 0) * quantity,
      };
    });
  }
  
  /**
   * Cancel subscription
   */
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
}

export const subscriptionService = new SubscriptionService();
```

### Step 2.2: Create Limit Checker Service

**File:** `server/lib/limit-checker.ts`

**Action:** Create service for limit enforcement:

```typescript
import { db } from '../db';
import { companyUsageLimits } from '../../shared/schema';
import { eq, sql } from 'drizzle-orm';

export interface LimitCheckResult {
  allowed: boolean;
  reason?: string;
  current: number;
  limit: number;
  remaining: number;
}

export class LimitCheckerService {
  /**
   * Check if company can create a project
   */
  async checkProjectLimit(companyId: number): Promise<LimitCheckResult> {
    const limits = await this.getCompanyLimits(companyId);
    if (!limits) {
      return {
        allowed: false,
        reason: 'No active subscription',
        current: 0,
        limit: 0,
        remaining: 0,
      };
    }
    
    const current = limits.projectsUsed || 0;
    const limit = limits.projectLimit || 999999999;
    const allowed = current < limit;
    
    return {
      allowed,
      reason: allowed ? undefined : 'Project limit exceeded',
      current,
      limit,
      remaining: Math.max(0, limit - current),
    };
  }
  
  /**
   * Check if company can upload a document
   */
  async checkDocumentLimit(companyId: number): Promise<LimitCheckResult> {
    const limits = await this.getCompanyLimits(companyId);
    if (!limits) {
      return {
        allowed: false,
        reason: 'No active subscription',
        current: 0,
        limit: 0,
        remaining: 0,
      };
    }
    
    const current = limits.documentsUsed || 0;
    const limit = limits.documentLimit || 999999999;
    const allowed = current < limit;
    
    return {
      allowed,
      reason: allowed ? undefined : 'Document limit exceeded',
      current,
      limit,
      remaining: Math.max(0, limit - current),
    };
  }
  
  /**
   * Check if company can generate a bid
   */
  async checkBidLimit(companyId: number): Promise<LimitCheckResult> {
    const limits = await this.getCompanyLimits(companyId);
    if (!limits) {
      return {
        allowed: false,
        reason: 'No active subscription',
        current: 0,
        limit: 0,
        remaining: 0,
      };
    }
    
    const current = limits.bidsUsed || 0;
    const limit = limits.bidLimit; // NULL means unlimited
    const allowed = limit === null || current < limit;
    
    return {
      allowed,
      reason: allowed ? undefined : 'Bid generation limit exceeded',
      current,
      limit: limit || 999999999,
      remaining: limit === null ? 999999999 : Math.max(0, limit - current),
    };
  }
  
  /**
   * Increment usage counter
   */
  async incrementUsage(
    companyId: number,
    type: 'projects' | 'documents' | 'bids',
    amount: number = 1
  ): Promise<void> {
    const fieldMap = {
      projects: 'projectsUsed',
      documents: 'documentsUsed',
      bids: 'bidsUsed',
    };
    
    await db
      .update(companyUsageLimits)
      .set({
        [fieldMap[type]]: sql`${companyUsageLimits[fieldMap[type]]} + ${amount}`,
        updatedAt: new Date(),
      })
      .where(eq(companyUsageLimits.companyId, companyId));
  }
  
  /**
   * Get company usage limits
   */
  private async getCompanyLimits(companyId: number) {
    const [limits] = await db
      .select()
      .from(companyUsageLimits)
      .where(eq(companyUsageLimits.companyId, companyId))
      .limit(1);
    
    return limits;
  }
  
  /**
   * Get usage summary for company
   */
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
        used: limits.projectsUsed,
        limit: limits.projectLimit,
        remaining: Math.max(0, limits.projectLimit - limits.projectsUsed),
      },
      documents: {
        used: limits.documentsUsed,
        limit: limits.documentLimit,
        remaining: Math.max(0, limits.documentLimit - limits.documentsUsed),
      },
      bids: {
        used: limits.bidsUsed,
        limit: limits.bidLimit,
        remaining: limits.bidLimit === null 
          ? 999999999 
          : Math.max(0, limits.bidLimit - limits.bidsUsed),
      },
    };
  }
}

export const limitChecker = new LimitCheckerService();
```

### Step 2.3: Create Trial Service

**File:** `server/lib/trial-service.ts`

**Action:** Create service for trial management:

```typescript
import { db } from '../db';
import { companySubscriptions, subscriptionPlans } from '../../shared/schema';
import { eq, and, sql, lte } from 'drizzle-orm';
import { subscriptionService } from './subscription-service';

export class TrialService {
  /**
   * Check if trial has expired
   */
  async isTrialExpired(companyId: number): Promise<boolean> {
    const subscription = await this.getTrialSubscription(companyId);
    if (!subscription) return false;
    
    const now = new Date();
    return now > subscription.subscription.currentPeriodEnd;
  }
  
  /**
   * Get trial subscription for company
   */
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
  
  /**
   * Create trial subscription for new company
   */
  async createTrial(companyId: number): Promise<void> {
    // Check if trial already exists
    const existing = await this.getTrialSubscription(companyId);
    if (existing) {
      return; // Trial already exists
    }
    
    // Get trial plan
    const [trialPlan] = await db
      .select()
      .from(subscriptionPlans)
      .where(
        and(
          eq(subscriptionPlans.name, 'trial'),
          eq(subscriptionPlans.isActive, true)
        )
      )
      .limit(1);
    
    if (!trialPlan) {
      throw new Error('Trial plan not found');
    }
    
    await subscriptionService.createSubscription(
      companyId,
      trialPlan.id,
      'monthly' // Will be set to 'trial' in createSubscription
    );
  }
  
  /**
   * Expire trial subscription
   */
  async expireTrial(companyId: number): Promise<void> {
    await db
      .update(companySubscriptions)
      .set({
        status: 'expired',
        cancelledAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(companySubscriptions.companyId, companyId),
          sql`EXISTS (
            SELECT 1 FROM subscription_plans 
            WHERE subscription_plans.id = company_subscriptions.plan_id 
            AND subscription_plans.tier = 0
          )`
        )
      );
  }
  
  /**
   * Check and expire all expired trials (cron job)
   */
  async expireExpiredTrials(): Promise<number> {
    const now = new Date();
    
    const result = await db
      .update(companySubscriptions)
      .set({
        status: 'expired',
        cancelledAt: now,
        updatedAt: now,
      })
      .where(
        and(
          sql`EXISTS (
            SELECT 1 FROM subscription_plans 
            WHERE subscription_plans.id = company_subscriptions.plan_id 
            AND subscription_plans.tier = 0
          )`,
          eq(companySubscriptions.status, 'active'),
          lte(companySubscriptions.currentPeriodEnd, now)
        )
      );
    
    return result.rowCount || 0;
  }
}

export const trialService = new TrialService();
```

---

## Phase 3: API Endpoints

### Step 3.1: Create Billing Routes

**File:** `server/routes/billing.ts`

**Action:** Create billing routes:

```typescript
import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { subscriptionPlans } from '../../shared/schema';
import { subscriptionService } from '../lib/subscription-service';
import { limitChecker } from '../lib/limit-checker';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { eq } from 'drizzle-orm';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * GET /api/billing/subscription
 * Get current subscription and usage
 */
router.get('/subscription', async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const companyId = req.user.companyId;
    const subscription = await subscriptionService.getCompanySubscription(companyId);
    const usage = await limitChecker.getUsageSummary(companyId);
    
    if (!subscription) {
      return res.json({ 
        subscription: null,
        usage: null,
      });
    }
    
    res.json({
      subscription: {
        ...subscription.subscription,
        plan: subscription.plan,
      },
      usage,
    });
  } catch (error) {
    console.error('Error getting subscription:', error);
    res.status(500).json({ error: 'Failed to get subscription' });
  }
});

/**
 * GET /api/billing/plans
 * List all available plans
 */
router.get('/plans', async (req, res) => {
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

/**
 * POST /api/billing/subscribe
 * Subscribe to a plan
 */
router.post('/subscribe', async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const schema = z.object({
      plan_id: z.number().int().positive(),
      billing_cycle: z.enum(['monthly', 'annual']).default('monthly'),
      payment_method_id: z.string().optional(), // For Stripe
    });
    
    const { plan_id, billing_cycle, payment_method_id } = schema.parse(req.body);
    const companyId = req.user.companyId;
    
    // Check if company already has active subscription
    const existing = await subscriptionService.getCompanySubscription(companyId);
    if (existing && existing.plan.tier !== 0) {
      return res.status(400).json({ 
        error: 'Company already has an active subscription' 
      });
    }
    
    // TODO: Create Stripe subscription if payment_method_id provided
    // For now, create local subscription
    
    const subscription = await subscriptionService.createSubscription(
      companyId,
      plan_id,
      billing_cycle
    );
    
    res.json({ subscription });
  } catch (error: any) {
    console.error('Error creating subscription:', error);
    res.status(500).json({ error: error.message || 'Failed to create subscription' });
  }
});

/**
 * POST /api/billing/extra-projects
 * Purchase extra project add-on
 */
router.post('/extra-projects', async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const schema = z.object({
      quantity: z.number().int().positive().max(10),
    });
    
    const { quantity } = schema.parse(req.body);
    const companyId = req.user.companyId;
    
    const result = await subscriptionService.addExtraProjects(companyId, quantity);
    
    // TODO: Process payment via Stripe
    
    res.json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    console.error('Error purchasing extra projects:', error);
    res.status(500).json({ error: error.message || 'Failed to purchase extra projects' });
  }
});

/**
 * POST /api/billing/cancel
 * Cancel subscription
 */
router.post('/cancel', async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const schema = z.object({
      cancel_at_period_end: z.boolean().default(true),
      reason: z.string().optional(),
    });
    
    const { cancel_at_period_end, reason } = schema.parse(req.body);
    const companyId = req.user.companyId;
    
    await subscriptionService.cancelSubscription(
      companyId,
      cancel_at_period_end,
      reason
    );
    
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error cancelling subscription:', error);
    res.status(500).json({ error: error.message || 'Failed to cancel subscription' });
  }
});

/**
 * GET /api/billing/usage
 * Get usage summary
 */
router.get('/usage', async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const companyId = req.user.companyId;
    const usage = await limitChecker.getUsageSummary(companyId);
    
    if (!usage) {
      return res.status(404).json({ error: 'No usage data found' });
    }
    
    res.json(usage);
  } catch (error) {
    console.error('Error getting usage:', error);
    res.status(500).json({ error: 'Failed to get usage' });
  }
});

export default router;
```

### Step 3.2: Register Billing Routes

**File:** `server/routes.ts`

**Action:** Add billing routes registration. Find where other routes are registered and add:

```typescript
import billingRoutes from './routes/billing';

// ... existing routes ...

// ==================== BILLING ====================
app.use('/api/billing', billingRoutes);
```

---

## Phase 4: Limit Enforcement

### Step 4.1: Add Limit Check to Project Creation

**File:** `server/routes/projects.ts` (or wherever projects are created)

**Action:** Add limit checking:

```typescript
import { limitChecker } from '../lib/limit-checker';

// In project creation endpoint, BEFORE creating project:
const projectLimit = await limitChecker.checkProjectLimit(companyId);
if (!projectLimit.allowed) {
  return res.status(403).json({
    error: 'Project limit exceeded',
    message: projectLimit.reason,
    current: projectLimit.current,
    limit: projectLimit.limit,
    remaining: projectLimit.remaining,
  });
}

// AFTER successful project creation:
await limitChecker.incrementUsage(companyId, 'projects', 1);
```

### Step 4.2: Add Limit Check to Document Upload

**File:** `server/routes/documents.ts`

**Action:** Add limit checking:

```typescript
import { limitChecker } from '../lib/limit-checker';

// In document upload endpoint, BEFORE processing:
const docLimit = await limitChecker.checkDocumentLimit(companyId);
if (!docLimit.allowed) {
  return res.status(403).json({
    error: 'Document limit exceeded',
    message: docLimit.reason,
    current: docLimit.current,
    limit: docLimit.limit,
    remaining: docLimit.remaining,
  });
}

// AFTER successful document processing:
await limitChecker.incrementUsage(companyId, 'documents', 1);
```

### Step 4.3: Add Limit Check to Bid Generation

**File:** `server/routes/bids.ts` or `server/lib/bid-generation-service.ts`

**Action:** Add limit checking:

```typescript
import { limitChecker } from '../lib/limit-checker';

// In bid generation endpoint/method, BEFORE generating:
const bidLimit = await limitChecker.checkBidLimit(companyId);
if (!bidLimit.allowed) {
  throw new Error(`Bid generation limit exceeded: ${bidLimit.reason}`);
  // Or return appropriate error response
}

// AFTER successful bid generation:
await limitChecker.incrementUsage(companyId, 'bids', 1);
```

---

## Phase 5: Trial Management

### Step 5.1: Auto-Create Trial on Company Signup

**File:** `server/routes/auth.ts` (or wherever companies are created)

**Action:** After company creation, automatically create trial:

```typescript
import { trialService } from '../lib/trial-service';

// After company is created:
await trialService.createTrial(companyId);
```

### Step 5.2: Add Trial Expiration Check Middleware

**File:** `server/middleware/trial-check.ts`

**Action:** Create middleware:

```typescript
import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import { trialService } from '../lib/trial-service';

export async function checkTrialExpiration(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  if (!req.user?.companyId) {
    return next();
  }
  
  try {
    const isExpired = await trialService.isTrialExpired(req.user.companyId);
    if (isExpired) {
      await trialService.expireTrial(req.user.companyId);
      return res.status(403).json({
        error: 'Trial expired',
        message: 'Your 7-day trial has ended. Please subscribe to continue using BidForge AI.',
      });
    }
  } catch (error) {
    console.error('Error checking trial expiration:', error);
    // Don't block request on error
  }
  
  next();
}
```

**Usage:** Apply to protected routes (optional - can also check in each endpoint)

### Step 5.3: Create Cron Job for Trial Expiration

**File:** `server/scripts/expire-trials.ts`

**Action:** Create script to expire trials (run via cron):

```typescript
import { trialService } from '../lib/trial-service';

async function expireTrials() {
  const count = await trialService.expireExpiredTrials();
  console.log(`Expired ${count} trial(s)`);
}

expireTrials().catch(console.error);
```

---

## Phase 6: Frontend Components

### Step 6.1: Add Billing Route to App

**File:** `client/src/App.tsx`

**Action:** Add billing route. Find the routes section and add:

**FIND:**
```typescript
      <Route path="/settings">
        {() => <ProtectedRoute component={Settings} />}
      </Route>
```

**ADD AFTER:**
```typescript
      <Route path="/billing">
        {() => <ProtectedRoute component={Billing} />}
      </Route>
```

**Action:** Add import at the top:

**FIND:**
```typescript
import Settings from "@/pages/Settings";
```

**ADD AFTER:**
```typescript
import Billing from "@/pages/Billing";
```

---

### Step 6.2: Add Billing Button to Sidebar

**File:** `client/src/components/layout/AppSidebar.tsx`

**Action:** Add billing icon import and navigation item.

**FIND:** The imports section with icons:
```typescript
import { 
  LayoutDashboard, 
  FolderKanban, 
  Settings, 
  FileText,
  LogOut,
  Home,
  MessageSquare,
  BarChart3,
  Shield,
  ChevronLeft,
  ChevronRight,
  Pin,
  PinOff,
  Upload,
  ShieldCheck,
  AlertTriangle,
  Sparkles,
  FileSearch,
  Database,
  ExternalLink
} from "lucide-react";
```

**ADD:** `CreditCard` to the imports:
```typescript
import { 
  LayoutDashboard, 
  FolderKanban, 
  Settings, 
  FileText,
  LogOut,
  Home,
  MessageSquare,
  BarChart3,
  Shield,
  ChevronLeft,
  ChevronRight,
  Pin,
  PinOff,
  Upload,
  ShieldCheck,
  AlertTriangle,
  Sparkles,
  FileSearch,
  Database,
  ExternalLink,
  CreditCard  // Add this
} from "lucide-react";
```

**FIND:** The `navItems` array:
```typescript
  const navItems = [
    { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
    { href: "/projects", icon: FolderKanban, label: "Projects" },
    { href: "/analytics", icon: BarChart3, label: "Analytics" },
    { href: "/templates", icon: FileText, label: "Templates" },
    { href: "/whatsapp", icon: MessageSquare, label: "WhatsApp" },
    { href: "/admin", icon: Shield, label: "Admin" },
    { href: "/settings", icon: Settings, label: "Settings" },
  ];
```

**REPLACE WITH:** (Add billing after settings)
```typescript
  const navItems = [
    { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
    { href: "/projects", icon: FolderKanban, label: "Projects" },
    { href: "/analytics", icon: BarChart3, label: "Analytics" },
    { href: "/templates", icon: FileText, label: "Templates" },
    { href: "/whatsapp", icon: MessageSquare, label: "WhatsApp" },
    { href: "/admin", icon: Shield, label: "Admin" },
    { href: "/settings", icon: Settings, label: "Settings" },
    { href: "/billing", icon: CreditCard, label: "Billing" },
  ];
```

---

### Step 6.3: Create Billing Page

**File:** `client/src/pages/Billing.tsx`

**Action:** Create comprehensive billing page component:

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
  CreditCard, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Loader2,
  Plus,
  Calendar,
  TrendingUp,
  Zap,
  FolderKanban,
  FileText
} from 'lucide-react';
import { apiRequest } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';

interface SubscriptionData {
  subscription: {
    id: number;
    status: string;
    billingCycle: string;
    currentPeriodStart: string;
    currentPeriodEnd: string;
    finalPrice: number;
    extraProjectsPurchased: number;
    plan: {
      id: number;
      name: string;
      displayName: string;
      tier: number;
      monthlyPrice: number;
      annualPrice: number | null;
      extraProjectFee: number | null;
      extraProjectDocBonus: number | null;
    };
  };
  usage: {
    period: {
      start: string;
      end: string;
    };
    projects: {
      used: number;
      limit: number;
      remaining: number;
    };
    documents: {
      used: number;
      limit: number;
      remaining: number;
    };
    bids: {
      used: number;
      limit: number;
      remaining: number;
    };
  } | null;
}

export default function Billing() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const { data, isLoading, error } = useQuery<SubscriptionData>({
    queryKey: ['billing', 'subscription'],
    queryFn: async () => {
      const response = await apiRequest('/api/billing/subscription');
      if (!response.ok) {
        throw new Error('Failed to fetch subscription');
      }
      return response.json();
    },
  });
  
  const purchaseExtraProjects = useMutation({
    mutationFn: async (quantity: number) => {
      const response = await apiRequest('/api/billing/extra-projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to purchase extra projects');
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['billing', 'subscription'] });
      toast({
        title: 'Success',
        description: `Added ${data.quantity} extra project(s) with ${data.bonusDocuments} bonus documents`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
  
  const cancelSubscription = useMutation({
    mutationFn: async (cancelAtPeriodEnd: boolean) => {
      const response = await apiRequest('/api/billing/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cancel_at_period_end: cancelAtPeriodEnd }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to cancel subscription');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing', 'subscription'] });
      toast({
        title: 'Success',
        description: 'Subscription cancellation scheduled',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
  
  if (isLoading) {
    return (
      <div className="flex h-screen">
        <AppSidebar />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="flex h-screen">
        <AppSidebar />
        <div className="flex-1 p-6">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>
              Failed to load billing information. Please try again.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }
  
  const { subscription, usage } = data || {};
  const isTrial = subscription?.plan.tier === 0;
  const isExpired = subscription?.status === 'expired';
  
  return (
    <div className="flex h-screen bg-background">
      <AppSidebar />
      <div className="flex-1 overflow-y-auto">
        <div className="container mx-auto p-6 space-y-6 max-w-6xl">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Billing & Subscription</h1>
              <p className="text-muted-foreground mt-1">
                Manage your subscription and view usage limits
              </p>
            </div>
            {subscription && !isTrial && (
              <Badge 
                variant={subscription.status === 'active' ? 'default' : 'secondary'}
                className="text-sm px-3 py-1"
              >
                {subscription.status === 'active' ? (
                  <>
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Active
                  </>
                ) : (
                  <>
                    <XCircle className="h-3 w-3 mr-1" />
                    {subscription.status}
                  </>
                )}
              </Badge>
            )}
          </div>
          
          {/* Trial Expiration Warning */}
          {isTrial && subscription && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Trial Period</AlertTitle>
              <AlertDescription>
                Your free trial expires on {new Date(subscription.currentPeriodEnd).toLocaleDateString()}. 
                Subscribe to continue using BidForge AI.
              </AlertDescription>
            </Alert>
          )}
          
          {/* Expired Subscription Warning */}
          {isExpired && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertTitle>Subscription Expired</AlertTitle>
              <AlertDescription>
                Your subscription has expired. Please subscribe to continue using BidForge AI.
              </AlertDescription>
            </Alert>
          )}
          
          {/* Current Subscription Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Current Subscription</CardTitle>
                  <CardDescription>
                    {subscription 
                      ? `You're on the ${subscription.plan.displayName} plan`
                      : 'No active subscription'
                    }
                  </CardDescription>
                </div>
                {subscription && (
                  <Badge variant="outline" className="text-lg px-4 py-2">
                    Tier {subscription.plan.tier}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {subscription ? (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Plan</p>
                      <p className="text-2xl font-semibold">{subscription.plan.displayName}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Price</p>
                      <p className="text-2xl font-semibold">
                        ${subscription.finalPrice.toFixed(2)}
                        <span className="text-sm font-normal text-muted-foreground">
                          /{subscription.billingCycle === 'annual' ? 'year' : 'month'}
                        </span>
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">
                        {isTrial ? 'Expires' : 'Renews'}
                      </p>
                      <p className="text-2xl font-semibold">
                        {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  
                  {subscription.extraProjectsPurchased > 0 && (
                    <div className="pt-4 border-t">
                      <p className="text-sm text-muted-foreground mb-1">Extra Projects</p>
                      <p className="text-lg font-semibold">
                        {subscription.extraProjectsPurchased} extra project(s) purchased
                      </p>
                    </div>
                  )}
                  
                  {!isTrial && subscription.status === 'active' && (
                    <div className="flex gap-2 pt-4 border-t">
                      <Button 
                        variant="outline"
                        onClick={() => {
                          if (confirm('Are you sure you want to cancel your subscription?')) {
                            cancelSubscription.mutate(true);
                          }
                        }}
                        disabled={cancelSubscription.isPending}
                      >
                        {cancelSubscription.isPending ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Cancelling...
                          </>
                        ) : (
                          'Cancel Subscription'
                        )}
                      </Button>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-8">
                  <p className="text-muted-foreground mb-4">No active subscription</p>
                  <Button>View Plans & Subscribe</Button>
                </div>
              )}
            </CardContent>
          </Card>
          
          {/* Usage & Limits Card */}
          {usage && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Usage & Limits</CardTitle>
                    <CardDescription>
                      Current billing period: {new Date(usage.period.start).toLocaleDateString()} - {new Date(usage.period.end).toLocaleDateString()}
                    </CardDescription>
                  </div>
                  <Calendar className="h-5 w-5 text-muted-foreground" />
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Projects Usage */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <FolderKanban className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">Projects</span>
                    </div>
                    <div className="text-right">
                      <span className="font-semibold">
                        {usage.projects.used} / {usage.projects.limit === 999999999 ? 'Unlimited' : usage.projects.limit}
                      </span>
                      <span className="text-sm text-muted-foreground ml-2">
                        ({usage.projects.remaining} remaining)
                      </span>
                    </div>
                  </div>
                  <Progress 
                    value={usage.projects.limit === 999999999 
                      ? 0 
                      : Math.min(100, (usage.projects.used / usage.projects.limit) * 100)
                    } 
                    className="h-2"
                  />
                  {usage.projects.used >= usage.projects.limit * 0.8 && usage.projects.limit !== 999999999 && (
                    <Alert className="mt-2">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription className="text-xs">
                        You're approaching your project limit
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
                
                {/* Documents Usage */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">Documents</span>
                    </div>
                    <div className="text-right">
                      <span className="font-semibold">
                        {usage.documents.used} / {usage.documents.limit === 999999999 ? 'Unlimited' : usage.documents.limit}
                      </span>
                      <span className="text-sm text-muted-foreground ml-2">
                        ({usage.documents.remaining} remaining)
                      </span>
                    </div>
                  </div>
                  <Progress 
                    value={usage.documents.limit === 999999999 
                      ? 0 
                      : Math.min(100, (usage.documents.used / usage.documents.limit) * 100)
                    } 
                    className="h-2"
                  />
                  {usage.documents.used >= usage.documents.limit * 0.8 && usage.documents.limit !== 999999999 && (
                    <Alert className="mt-2">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription className="text-xs">
                        You're approaching your document limit
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
                
                {/* Bid Generations Usage */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Zap className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">Bid Generations</span>
                    </div>
                    <div className="text-right">
                      <span className="font-semibold">
                        {usage.bids.used} / {usage.bids.limit === 999999999 ? 'Unlimited' : usage.bids.limit}
                      </span>
                      {usage.bids.limit !== 999999999 && (
                        <span className="text-sm text-muted-foreground ml-2">
                          ({usage.bids.remaining} remaining)
                        </span>
                      )}
                    </div>
                  </div>
                  <Progress 
                    value={usage.bids.limit === 999999999 
                      ? 0 
                      : Math.min(100, (usage.bids.used / usage.bids.limit) * 100)
                    } 
                    className="h-2"
                  />
                  {usage.bids.used >= (usage.bids.limit || 0) * 0.8 && usage.bids.limit !== 999999999 && (
                    <Alert className="mt-2">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription className="text-xs">
                        You're approaching your bid generation limit
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
                
                {/* Extra Project Purchase (Tier 1 & 2 only) */}
                {subscription && 
                 (subscription.plan.tier === 1 || subscription.plan.tier === 2) &&
                 subscription.plan.extraProjectFee && (
                  <div className="mt-6 p-4 border-2 border-dashed rounded-lg bg-muted/50">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-semibold mb-1 flex items-center gap-2">
                          <Plus className="h-4 w-4" />
                          Need More Projects?
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          Add extra projects for ${subscription.plan.extraProjectFee.toFixed(2)} each
                          <br />
                          <span className="text-xs">
                            Each purchase includes +{subscription.plan.extraProjectDocBonus} bonus documents
                          </span>
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        onClick={() => purchaseExtraProjects.mutate(1)}
                        disabled={purchaseExtraProjects.isPending}
                        size="sm"
                      >
                        {purchaseExtraProjects.isPending ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Processing...
                          </>
                        ) : (
                          <>
                            <Plus className="h-4 w-4 mr-2" />
                            Add 1 Extra Project
                          </>
                        )}
                      </Button>
                      <Button 
                        variant="outline"
                        onClick={() => purchaseExtraProjects.mutate(3)}
                        disabled={purchaseExtraProjects.isPending}
                        size="sm"
                      >
                        Add 3 Extra Projects
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
          
          {/* Plan Comparison / Upgrade Card */}
          {subscription && subscription.plan.tier < 3 && (
            <Card>
              <CardHeader>
                <CardTitle>Upgrade Your Plan</CardTitle>
                <CardDescription>
                  Get more projects, documents, and bid generations
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" className="w-full">
                  <TrendingUp className="h-4 w-4 mr-2" />
                  View Available Plans
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
```

**Note:** Add missing imports:
```typescript
import { FolderKanban, FileText } from 'lucide-react';
```

---

## Phase 7: Testing

### Step 7.1: Test Plan Seeding

```bash
npx tsx server/scripts/seed-plans.ts
```

Verify all 4 plans are created.

### Step 7.2: Test Trial Creation

- Create a new company
- Verify trial subscription is automatically created
- Verify trial expires after 7 days

### Step 7.3: Test Limit Enforcement

- Create projects up to limit
- Verify limit blocking works
- Test document limits
- Test bid generation limits

### Step 7.4: Test Extra Project Purchase

- Subscribe to Tier 1 or 2
- Purchase extra project
- Verify limits are updated
- Verify bonus documents are added

---

## ✅ Implementation Checklist

- [ ] Phase 1: Database schema created
- [ ] Phase 2: Services implemented
- [ ] Phase 3: API endpoints created
- [ ] Phase 4: Limit enforcement added
- [ ] Phase 5: Trial management implemented
- [ ] Phase 6: Frontend components created
- [ ] Phase 7: Testing completed

---

## 🚀 Deployment Steps

1. Run database migration: `npx drizzle-kit push`
2. Seed plans: `npx tsx server/scripts/seed-plans.ts`
3. Set up Stripe webhook endpoint
4. Configure environment variables
5. Test trial creation
6. Test subscription flow
7. Monitor limit enforcement

---

**Document End**

*This is a fresh, simplified implementation. Follow steps in order.*

