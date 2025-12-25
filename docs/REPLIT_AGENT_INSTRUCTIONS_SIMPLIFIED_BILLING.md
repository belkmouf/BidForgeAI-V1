# Replit Agent Instructions: Implement Simplified Billing Schema

**Version:** 1.0  
**Date:** December 2024  
**Target:** Update billing module to simplified schema  
**Reference:** `C:\Users\Owner\Downloads\updated_billing_schema.md`

---

## 🎯 Objective

Update the billing module implementation to match the simplified schema design. The new design:
- Removes complex JSONB fields
- Uses direct integer columns for limits
- Adds Tier 0 (Free Trial)
- Implements "Extra Project" add-on system
- Simplifies overall architecture

---

## 📋 Pre-Implementation Checklist

- [ ] Read `updated_billing_schema.md` from Downloads folder
- [ ] Review current `docs/BILLING_MODULE_IMPLEMENTATION_GUIDE.md`
- [ ] Understand the schema differences
- [ ] Backup current schema file

---

## 🔄 Phase 1: Update Database Schema

### Step 1.1: Update Subscription Plans Table

**File:** `shared/schema.ts`

**Action:** Replace the existing `subscriptionPlans` table definition with the simplified version:

**FIND:**
```typescript
export const subscriptionPlans = pgTable("subscription_plans", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: varchar("name", { length: 100 }).notNull().unique(),
  displayName: varchar("display_name", { length: 255 }).notNull(),
  tier: integer("tier").notNull(),
  basePrice: real("base_price").notNull(), // Using real for decimal values
  currency: varchar("currency", { length: 3 }).default("USD"),
  
  features: jsonb("features").$type<Record<string, any>>().default(sql`'{}'::jsonb`),
  limits: jsonb("limits").$type<Record<string, any>>().default(sql`'{}'::jsonb`),
  includedCredits: jsonb("included_credits").$type<Record<string, number>>().default(sql`'{}'::jsonb`),
  overagePricing: jsonb("overage_pricing").$type<Record<string, number>>().default(sql`'{}'::jsonb`),
  
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
```

**REPLACE WITH:**
```typescript
export const subscriptionPlans = pgTable("subscription_plans", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: varchar("name", { length: 100 }).notNull().unique(), // 'trial', 'sifter', 'estimator', 'enterprise'
  displayName: varchar("display_name", { length: 255 }).notNull(),
  tier: integer("tier").notNull(), // 0, 1, 2, 3
  
  // Pricing
  monthlyPrice: real("monthly_price").notNull(),
  annualPrice: real("annual_price"), // NULL for trial tier
  
  // Volume Limits (direct columns, not JSONB)
  monthlyProjectLimit: integer("monthly_project_limit"), // 1, 5, 20, 200, NULL for unlimited
  monthlyDocumentLimit: integer("monthly_document_limit"), // 1, 50, 200, 2000
  monthlyBidLimit: integer("monthly_bid_limit"), // 2, 15, 60, NULL for unlimited
  
  // Add-on Rules
  extraProjectFee: real("extra_project_fee").default(25.00), // $25 per extra project
  extraProjectDocBonus: integer("extra_project_doc_bonus").default(10), // +10 docs per extra project
  
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
```

**Validation:** Update Zod schema:
```typescript
export const subscriptionPlanSchema = createInsertSchema(subscriptionPlans);
```

---

### Step 1.2: Add Company Subscriptions - Extra Projects Tracking

**File:** `shared/schema.ts`

**Action:** Add field to track extra projects purchased. Find the `companySubscriptions` table and add:

**FIND:**
```typescript
  stripeSubscriptionId: varchar("stripe_subscription_id", { length: 255 }),
  autoRenew: boolean("auto_renew").default(true),
```

**ADD AFTER:**
```typescript
  extraProjectsPurchased: integer("extra_projects_purchased").default(0), // Track add-on purchases
  autoRenew: boolean("auto_renew").default(true),
```

**Result:** This field tracks how many extra projects the company has purchased this billing period.

---

### Step 1.3: Create Usage Limits Tracking Table (NEW)

**File:** `shared/schema.ts`

**Action:** Add a new table to track current period usage for limit enforcement:

**ADD AFTER:** `companySubscriptions` table

```typescript
export const companyUsageLimits = pgTable("company_usage_limits", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  companyId: integer("company_id")
    .notNull()
    .references(() => companies.id, { onDelete: "cascade" })
    .unique(), // One record per company
  
  // Current Period Usage
  currentPeriodStart: timestamp("current_period_start").notNull(),
  currentPeriodEnd: timestamp("current_period_end").notNull(),
  
  // Usage Counters
  projectsUsed: integer("projects_used").default(0),
  documentsUsed: integer("documents_used").default(0),
  bidsUsed: integer("bids_used").default(0),
  
  // Limits (copied from subscription for quick lookup)
  projectLimit: integer("project_limit").notNull(),
  documentLimit: integer("document_limit").notNull(),
  bidLimit: integer("bid_limit"), // NULL means unlimited
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type CompanyUsageLimits = typeof companyUsageLimits.$inferSelect;
export type InsertCompanyUsageLimits = typeof companyUsageLimits.$inferInsert;
```

**Purpose:** This table provides fast lookups for limit checking without joining multiple tables.

---

### Step 1.4: Update Seed Script

**File:** `server/scripts/seed-plans.ts`

**Action:** Replace the entire seed script with the new simplified plan data:

**REPLACE ENTIRE FILE WITH:**
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
      extraProjectFee: null, // Not available for trial
      extraProjectDocBonus: null,
    },
    {
      name: 'sifter',
      displayName: 'The Sifter',
      tier: 1,
      monthlyPrice: 99.00,
      annualPrice: 1099.00, // $1,099/year (save ~$89)
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
      annualPrice: 3289.00, // $3,289/year (save ~$299)
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
      annualPrice: 16500.00, // $16,500/year (save ~$1,500)
      monthlyProjectLimit: 200,
      monthlyDocumentLimit: 2000,
      monthlyBidLimit: null, // Unlimited
      extraProjectFee: null, // Not available for enterprise
      extraProjectDocBonus: null,
    },
  ];
  
  for (const plan of plans) {
    try {
      await db.insert(subscriptionPlans).values(plan);
      console.log(`✓ Seeded plan: ${plan.displayName}`);
    } catch (error: any) {
      if (error.code === '23505') { // Unique violation
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

---

## 🔄 Phase 2: Update Services

### Step 2.1: Update Subscription Service

**File:** `server/lib/subscription-service.ts`

**Action:** Update the `allocateIncludedCredits` method to work with the simplified schema.

**FIND:**
```typescript
  private async allocateIncludedCredits(
    companyId: number,
    subscriptionId: number,
    plan: typeof subscriptionPlans.$inferSelect,
    tx?: any
  ) {
    const dbInstance = tx || db;
    const credits = plan.includedCredits as Record<string, number> || {};
    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + 1);
    
    for (const [creditType, quantity] of Object.entries(credits)) {
      // Handle unlimited (-1) or positive quantities
      if (quantity === -1 || quantity > 0) {
        await dbInstance.insert(usageCredits).values({
          companyId,
          subscriptionId,
          creditType,
          quantity: quantity === -1 ? 999999999 : quantity, // Use large number for unlimited
          usedQuantity: 0,
          validFrom: now,
          validUntil: periodEnd,
          source: 'subscription',
          sourceReference: subscriptionId.toString(),
        });
      }
    }
  }
```

**REPLACE WITH:**
```typescript
  /**
   * Initialize usage limits for a new subscription
   */
  private async initializeUsageLimits(
    companyId: number,
    subscription: typeof companySubscriptions.$inferSelect,
    plan: typeof subscriptionPlans.$inferSelect,
    tx?: any
  ) {
    const dbInstance = tx || db;
    const { companyUsageLimits } = await import('../../shared/schema');
    
    // Calculate effective limits (base + extra projects)
    const extraProjects = subscription.extraProjectsPurchased || 0;
    const effectiveProjectLimit = plan.monthlyProjectLimit 
      ? plan.monthlyProjectLimit + extraProjects 
      : null; // Unlimited
    const effectiveDocumentLimit = plan.monthlyDocumentLimit 
      ? plan.monthlyDocumentLimit + (extraProjects * (plan.extraProjectDocBonus || 0))
      : null;
    
    // Create or update usage limits record
    await dbInstance
      .insert(companyUsageLimits)
      .values({
        companyId,
        currentPeriodStart: subscription.currentPeriodStart,
        currentPeriodEnd: subscription.currentPeriodEnd,
        projectsUsed: 0,
        documentsUsed: 0,
        bidsUsed: 0,
        projectLimit: effectiveProjectLimit || 999999999, // Large number for unlimited
        documentLimit: effectiveDocumentLimit || 999999999,
        bidLimit: plan.monthlyBidLimit,
      })
      .onConflictDoUpdate({
        target: companyUsageLimits.companyId,
        set: {
          currentPeriodStart: subscription.currentPeriodStart,
          currentPeriodEnd: subscription.currentPeriodEnd,
          projectLimit: effectiveProjectLimit || 999999999,
          documentLimit: effectiveDocumentLimit || 999999999,
          bidLimit: plan.monthlyBidLimit,
          projectsUsed: 0, // Reset on new period
          documentsUsed: 0,
          bidsUsed: 0,
          updatedAt: new Date(),
        },
      });
  }
```

**Action:** Update `createSubscription` method to call `initializeUsageLimits` instead of `allocateIncludedCredits`:

**FIND:**
```typescript
    // Allocate included credits
    await this.allocateIncludedCredits(companyId, subscription.id, plan, tx);
```

**REPLACE WITH:**
```typescript
    // Initialize usage limits
    await this.initializeUsageLimits(companyId, subscription, plan, tx);
```

---

### Step 2.2: Create Limit Checking Service

**File:** `server/lib/limit-checker.ts` (NEW FILE)

**Action:** Create a new service for checking and enforcing limits:

```typescript
import { db } from '../db';
import { companyUsageLimits, subscriptionPlans, companySubscriptions } from '../../shared/schema';
import { eq, and, gte, lte } from 'drizzle-orm';

export interface LimitCheckResult {
  allowed: boolean;
  reason?: string;
  current: number;
  limit: number;
  remaining: number;
}

export class LimitCheckerService {
  /**
   * Check if company can create a new project
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
    const { companyUsageLimits } = await import('../../shared/schema');
    
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
    const { companyUsageLimits } = await import('../../shared/schema');
    
    const [limits] = await db
      .select()
      .from(companyUsageLimits)
      .where(eq(companyUsageLimits.companyId, companyId))
      .limit(1);
    
    return limits;
  }
}

export const limitChecker = new LimitCheckerService();
```

**Note:** Add import for `sql` at top:
```typescript
import { sql } from 'drizzle-orm';
```

---

### Step 2.3: Update Usage Tracking Service

**File:** `server/lib/usage-tracking.ts`

**Action:** Remove or simplify credit-based tracking since we're using direct limits now. The usage tracking can be simplified to just track events for analytics, not for billing.

**Note:** Keep the service but simplify it - we'll use `limitChecker` for enforcement instead.

---

## 🔄 Phase 3: Update API Routes

### Step 3.1: Add Limit Checking to Project Creation

**File:** `server/routes/projects.ts` (or wherever projects are created)

**Action:** Add limit checking before creating a project:

**ADD AT TOP:**
```typescript
import { limitChecker } from '../lib/limit-checker';
```

**FIND:** Project creation endpoint

**ADD BEFORE:** Creating the project:
```typescript
// Check project limit
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
```

**ADD AFTER:** Successful project creation:
```typescript
// Increment project usage
await limitChecker.incrementUsage(companyId, 'projects', 1);
```

---

### Step 3.2: Add Limit Checking to Document Upload

**File:** `server/routes/documents.ts`

**Action:** Add limit checking before uploading documents:

**ADD AT TOP:**
```typescript
import { limitChecker } from '../lib/limit-checker';
```

**FIND:** Document upload endpoint

**ADD BEFORE:** Processing the document:
```typescript
// Check document limit
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
```

**ADD AFTER:** Successful document processing:
```typescript
// Increment document usage
await limitChecker.incrementUsage(companyId, 'documents', 1);
```

---

### Step 3.3: Add Limit Checking to Bid Generation

**File:** `server/routes/bids.ts` or `server/lib/bid-generation-service.ts`

**Action:** Add limit checking before generating bids:

**ADD AT TOP:**
```typescript
import { limitChecker } from '../lib/limit-checker';
```

**FIND:** Bid generation endpoint/method

**ADD BEFORE:** Generating the bid:
```typescript
// Check bid limit
const bidLimit = await limitChecker.checkBidLimit(companyId);
if (!bidLimit.allowed) {
  throw new Error(`Bid generation limit exceeded: ${bidLimit.reason}`);
  // Or return appropriate error response
}
```

**ADD AFTER:** Successful bid generation:
```typescript
// Increment bid usage
await limitChecker.incrementUsage(companyId, 'bids', 1);
```

---

### Step 3.4: Add Extra Project Purchase Endpoint

**File:** `server/routes/billing.ts`

**Action:** Add endpoint to purchase extra projects:

**ADD:**
```typescript
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
      quantity: z.number().int().positive().max(10), // Max 10 at a time
    });
    
    const { quantity } = schema.parse(req.body);
    const companyId = req.user.companyId;
    
    // Get current subscription
    const subscription = await subscriptionService.getCompanySubscription(companyId);
    if (!subscription) {
      return res.status(404).json({ error: 'No active subscription' });
    }
    
    const plan = subscription.plan;
    
    // Check if add-on is available for this tier
    if (plan.tier === 0 || plan.tier === 3) {
      return res.status(400).json({ 
        error: 'Extra projects not available for this tier' 
      });
    }
    
    if (!plan.extraProjectFee) {
      return res.status(400).json({ 
        error: 'Extra projects not available for this plan' 
      });
    }
    
    // Calculate cost
    const totalCost = plan.extraProjectFee * quantity;
    
    // TODO: Process payment via Stripe
    // For now, just update the subscription
    
    // Update subscription with extra projects
    await db
      .update(companySubscriptions)
      .set({
        extraProjectsPurchased: sql`${companySubscriptions.extraProjectsPurchased} + ${quantity}`,
        updatedAt: new Date(),
      })
      .where(eq(companySubscriptions.companyId, companyId));
    
    // Recalculate and update usage limits
    await subscriptionService.initializeUsageLimits(
      companyId,
      subscription.subscription,
      plan
    );
    
    res.json({
      success: true,
      quantity,
      cost: totalCost,
      message: `Added ${quantity} extra project(s) with ${plan.extraProjectDocBonus * quantity} bonus documents`,
    });
  } catch (error) {
    console.error('Error purchasing extra projects:', error);
    res.status(500).json({ error: 'Failed to purchase extra projects' });
  }
});
```

---

## 🔄 Phase 4: Trial Management

### Step 4.1: Create Trial Expiration Service

**File:** `server/lib/trial-service.ts` (NEW FILE)

**Action:** Create service to handle trial expiration:

```typescript
import { db } from '../db';
import { companySubscriptions, subscriptionPlans } from '../../shared/schema';
import { eq, and, lte } from 'drizzle-orm';

export class TrialService {
  /**
   * Check if trial has expired
   */
  async isTrialExpired(companyId: number): Promise<boolean> {
    const subscription = await this.getTrialSubscription(companyId);
    if (!subscription) return false;
    
    const now = new Date();
    return now > subscription.currentPeriodEnd;
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
          eq(subscriptionPlans.tier, 0), // Tier 0 = Trial
          eq(companySubscriptions.status, 'active')
        )
      )
      .limit(1);
    
    return subscription;
  }
  
  /**
   * Expire trial subscription
   */
  async expireTrial(companyId: number): Promise<void> {
    await db
      .update(companySubscriptions)
      .set({
        status: 'cancelled',
        cancelledAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(companySubscriptions.companyId, companyId),
          // Only expire if it's a trial
          sql`EXISTS (
            SELECT 1 FROM subscription_plans 
            WHERE subscription_plans.id = company_subscriptions.plan_id 
            AND subscription_plans.tier = 0
          )`
        )
      );
  }
  
  /**
   * Create trial subscription for new company
   */
  async createTrial(companyId: number): Promise<void> {
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
    
    const now = new Date();
    const trialEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days
    
    await db.insert(companySubscriptions).values({
      companyId,
      planId: trialPlan.id,
      status: 'active',
      billingCycle: 'trial',
      currentPeriodStart: now,
      currentPeriodEnd: trialEnd,
      basePrice: 0,
      discountPercent: 0,
      finalPrice: 0,
      autoRenew: false, // Trials don't auto-renew
      extraProjectsPurchased: 0,
    });
    
    // Initialize usage limits
    const subscription = await this.getTrialSubscription(companyId);
    if (subscription) {
      await subscriptionService.initializeUsageLimits(
        companyId,
        subscription.subscription,
        subscription.plan
      );
    }
  }
}

export const trialService = new TrialService();
```

**Note:** Add imports:
```typescript
import { sql } from 'drizzle-orm';
import { subscriptionService } from './subscription-service';
```

---

### Step 4.2: Add Trial Expiration Check Middleware

**File:** `server/middleware/trial-check.ts` (NEW FILE)

**Action:** Create middleware to check trial expiration:

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

---

## 🔄 Phase 5: Update Frontend

### Step 5.1: Update Billing Page

**File:** `client/src/pages/Billing.tsx`

**Action:** Update to show simplified limits and extra project purchase option:

**ADD:** Display for limits:
```typescript
{subscription?.subscription && (
  <Card>
    <CardHeader>
      <CardTitle>Usage & Limits</CardTitle>
    </CardHeader>
    <CardContent>
      <div className="space-y-4">
        <div>
          <div className="flex justify-between mb-2">
            <span>Projects</span>
            <span>{usage.projectsUsed} / {usage.projectLimit === 999999999 ? 'Unlimited' : usage.projectLimit}</span>
          </div>
          <Progress value={(usage.projectsUsed / usage.projectLimit) * 100} />
        </div>
        
        <div>
          <div className="flex justify-between mb-2">
            <span>Documents</span>
            <span>{usage.documentsUsed} / {usage.documentLimit === 999999999 ? 'Unlimited' : usage.documentLimit}</span>
          </div>
          <Progress value={(usage.documentsUsed / usage.documentLimit) * 100} />
        </div>
        
        <div>
          <div className="flex justify-between mb-2">
            <span>Bid Generations</span>
            <span>{usage.bidsUsed} / {usage.bidLimit === 999999999 ? 'Unlimited' : usage.bidLimit}</span>
          </div>
          <Progress value={usage.bidLimit === 999999999 ? 0 : (usage.bidsUsed / usage.bidLimit) * 100} />
        </div>
        
        {/* Extra Project Purchase (Tier 1 & 2 only) */}
        {subscription.subscription.plan.tier === 1 || subscription.subscription.plan.tier === 2 ? (
          <div className="mt-4 p-4 border rounded-lg">
            <h3 className="font-semibold mb-2">Need More Projects?</h3>
            <p className="text-sm text-muted-foreground mb-3">
              Add extra projects for ${subscription.subscription.plan.extraProjectFee} each
              (+{subscription.subscription.plan.extraProjectDocBonus} documents per project)
            </p>
            <Button onClick={() => handlePurchaseExtraProjects(1)}>
              Add 1 Extra Project
            </Button>
          </div>
        ) : null}
      </div>
    </CardContent>
  </Card>
)}
```

---

## 🔄 Phase 6: Database Migration

### Step 6.1: Create Migration Script

**File:** `server/scripts/migrate-to-simplified-billing.ts`

**Action:** Create migration script to update existing data:

```typescript
import { db } from '../db';
import { subscriptionPlans, companySubscriptions } from '../../shared/schema';
import { sql } from 'drizzle-orm';

async function migrateToSimplifiedBilling() {
  console.log('Starting migration to simplified billing schema...');
  
  // 1. Update existing plans (if any) or they'll be replaced by seed
  console.log('✓ Plans will be updated via seed script');
  
  // 2. Migrate existing subscriptions to new schema
  // This assumes you have existing subscriptions - adjust as needed
  console.log('✓ Existing subscriptions will continue to work');
  
  // 3. Create usage limits records for existing subscriptions
  const subscriptions = await db.select().from(companySubscriptions);
  
  for (const sub of subscriptions) {
    // Initialize usage limits for each subscription
    // This will be handled by the subscription service
    console.log(`Processing subscription ${sub.id}...`);
  }
  
  console.log('Migration complete!');
}

migrateToSimplifiedBilling().catch(console.error);
```

---

## ✅ Implementation Checklist

### Phase 1: Schema Updates
- [ ] Update `subscriptionPlans` table definition
- [ ] Add `extraProjectsPurchased` to `companySubscriptions`
- [ ] Create `companyUsageLimits` table
- [ ] Update seed script with new plan data
- [ ] Run migration: `npx drizzle-kit push`

### Phase 2: Services
- [ ] Update `subscription-service.ts` - replace `allocateIncludedCredits` with `initializeUsageLimits`
- [ ] Create `limit-checker.ts` service
- [ ] Create `trial-service.ts` service
- [ ] Update `usage-tracking.ts` (simplify if needed)

### Phase 3: API Routes
- [ ] Add limit checking to project creation
- [ ] Add limit checking to document upload
- [ ] Add limit checking to bid generation
- [ ] Add extra project purchase endpoint
- [ ] Update billing routes

### Phase 4: Trial Management
- [ ] Create trial expiration service
- [ ] Add trial check middleware
- [ ] Add trial creation on company signup

### Phase 5: Frontend
- [ ] Update billing page to show limits
- [ ] Add extra project purchase UI
- [ ] Add trial expiration warning

### Phase 6: Testing
- [ ] Test limit enforcement
- [ ] Test extra project purchase
- [ ] Test trial expiration
- [ ] Test all tier limits

---

## 🚨 Important Notes

1. **Backward Compatibility:** If you have existing subscriptions, ensure the migration handles them gracefully.

2. **Trial Auto-Creation:** Consider automatically creating a trial subscription when a new company is created.

3. **Limit Reset:** Usage limits should reset at the start of each billing period.

4. **Extra Projects:** Extra projects purchased should reset at the start of each billing period (or persist - clarify requirement).

5. **Database Migration:** Run `npx drizzle-kit push` after schema changes.

---

## 📝 Next Steps After Implementation

1. Test all limit enforcement
2. Test trial creation and expiration
3. Test extra project purchase flow
4. Update documentation
5. Deploy to staging for testing

---

**Document End**

*Follow these steps in order. Test each phase before moving to the next.*

