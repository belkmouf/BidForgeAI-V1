# BidForge AI - Billing Module Design Document

**Version:** 1.0  
**Last Updated:** December 2024  
**Document Type:** Design Specification  
**Status:** Draft

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Monetization Strategy](#monetization-strategy)
3. [Pricing Tiers](#pricing-tiers)
4. [Usage-Based Billing](#usage-based-billing)
5. [Cost Management](#cost-management)
6. [Database Schema](#database-schema)
7. [API Design](#api-design)
8. [UI/UX Design](#uiux-design)
9. [Billing Workflows](#billing-workflows)
10. [Integration Points](#integration-points)
11. [Security & Compliance](#security--compliance)

---

## Executive Summary

The BidForge AI billing module implements a **hybrid pricing model** combining subscription tiers with usage-based billing. This approach ensures profitability by aligning pricing with the high-value nature of construction bidding while managing the significant costs of AI document processing.

### Key Design Principles

1. **Value-Based Pricing**: Align pricing with the value delivered (winning bids worth millions)
2. **Cost Protection**: Prevent users from consuming more in AI costs than their subscription value
3. **Transparency**: Clear visibility into usage and costs
4. **Flexibility**: Multiple pricing tiers to serve different customer segments
5. **Profitability**: Ensure each tier is profitable even with heavy usage

### Critical Cost Centers

- **Token Consumption**: Large PDF processing (500+ pages)
- **OCR/Image Processing**: Blueprint and drawing analysis
- **RAG Operations**: Vector search and context retrieval
- **Multi-Model AI**: Different models have different costs

---

## Monetization Strategy

### The Problem

Construction RFPs are massive documents (500+ pages) that require expensive AI processing. Without proper cost management, a single user can cost more in compute than their monthly subscription.

### The Solution

**Hybrid Model**: Base subscription + usage-based add-ons

- **Base Subscription**: Covers core features and includes usage credits
- **Usage-Based Add-ons**: Pay-per-use for high-cost operations
- **Tier Limits**: Prevent cost overruns through hard limits

### Revenue Streams

1. **Monthly Subscriptions**: Recurring revenue from 4 pricing tiers
2. **Usage-Based Charges**: Per-project analysis, per-page processing
3. **Bid Packs**: Pre-paid analysis credits
4. **Enterprise Contracts**: Annual commitments with volume discounts
5. **Marketplace Commissions**: Future revenue from subcontractor matching

---

## Pricing Tiers

### Tier 1: "The Sifter" (Entry Level)

**Target Audience**: Small subcontractors, freelancers, solo estimators

**Pricing**: $49 - $99 / month

**Value Proposition**: "Don't miss a bid" - Smart filtering and basic analysis

#### Features Included

- ✅ **Tender Aggregation**: Access to aggregated tenders from various portals
- ✅ **Smart Filtering**: AI-powered filtering based on win probability (>80% threshold)
- ✅ **Basic RFP Analysis**: Text-only analysis (no blueprints)
- ✅ **Win Probability Score**: Go/No-Go decision support
- ✅ **Basic Bid Generation**: Limited to 3 bids per month
- ✅ **Document Upload**: Up to 10 documents per project
- ✅ **Email Support**: Standard support

#### Usage Limits

- **Projects**: 5 active projects per month
- **Documents**: 50 documents total per month
- **Bid Generations**: 3 per month (additional: $25 each)
- **Analysis Depth**: Basic only (no deep analysis)
- **Storage**: 1 GB total

#### Restrictions

- ❌ No blueprint/drawing analysis
- ❌ No knowledge base uploads
- ❌ No team collaboration
- ❌ No custom branding
- ❌ No API access

---

### Tier 2: "The Estimator's Assistant" (Usage-Based)

**Target Audience**: Mid-sized General Contractors (10-50 employees)

**Pricing**: $299 / month base + usage-based charges

**Value Proposition**: "Cut estimation time by 50%" - Advanced analysis and automation

#### Features Included

- ✅ **Everything in Tier 1**
- ✅ **Auto-Summarization**: 200-page RFP → 2-page executive summary
- ✅ **Compliance Matrix**: Automatic extraction of "Shall" and "Must" requirements to Excel
- ✅ **Deep Analysis**: Multi-dimensional scoring (Quality, Clarity, Doability, Risk)
- ✅ **Conflict Detection**: Semantic and numeric conflict identification
- ✅ **Unlimited Bid Generation**: With usage tracking
- ✅ **Knowledge Base**: Upload company templates and standards
- ✅ **Team Collaboration**: Up to 10 team members
- ✅ **Custom Branding**: Company logo and colors
- ✅ **Priority Support**: Email + chat support

#### Usage-Based Pricing

**Included Credits** (per month):
- **5 Deep Analyses**: Included (value: $250)
- **50 Document Pages**: Included for processing
- **10 Bid Generations**: Included

**Overage Charges**:
- **Deep Analysis**: $50 per additional analysis
- **Document Processing**: $0.50 per page over limit
- **Bid Generation**: $15 per additional generation
- **Blueprint Analysis**: $25 per drawing (OCR processing)

#### Usage Limits

- **Projects**: 20 active projects per month
- **Documents**: 200 documents total per month
- **Storage**: 10 GB total
- **Team Members**: 10 users
- **API Calls**: 1,000 per month

---

### Tier 3: "The Enterprise Brain" (Private Data Moat)

**Target Audience**: Large Construction Firms (Tier 1, 50+ employees)

**Pricing**: $2,000+ / month (Annual contracts with volume discounts)

**Value Proposition**: "Your internal knowledge base" - Company-specific AI training

#### Features Included

- ✅ **Everything in Tier 2**
- ✅ **Private Knowledge Base**: Upload 5+ years of winning bids
- ✅ **Company Voice Training**: AI learns your writing style and protocols
- ✅ **Custom AI Instructions**: Company-specific generation rules
- ✅ **Unlimited Usage**: No per-project or per-page charges
- ✅ **Advanced Analytics**: Custom reporting and insights
- ✅ **Dedicated Support**: Account manager + priority support
- ✅ **SLA Guarantees**: 99.9% uptime, response time guarantees
- ✅ **API Access**: Full API for integrations
- ✅ **White-Label Options**: Custom branding and domain

#### Enterprise Add-ons

- **Custom Integrations**: CRM, ERP, project management tools
- **On-Premise Deployment**: For maximum security (premium pricing)
- **Training & Onboarding**: Dedicated training sessions
- **Custom Development**: Tailored features for your workflow

#### Usage Limits

- **Projects**: Unlimited
- **Documents**: Unlimited
- **Storage**: 100 GB (expandable)
- **Team Members**: Unlimited
- **API Calls**: Unlimited

---

### Tier 4: "The Marketplace" (Future - Commission Model)

**Target Audience**: All users + subcontractor network

**Pricing**: Commission-based (10-15% of lead value)

**Value Proposition**: "Connect with the right subcontractors" - Automated matching

#### Features

- **Subcontractor Matching**: AI identifies needed trades and matches with vetted subcontractors
- **Lead Generation**: Subcontractors pay for qualified leads
- **Project Collaboration**: Multi-party bid collaboration
- **Commission Tracking**: Transparent fee structure

**Note**: This tier is planned for future release (Phase 2)

---

## Usage-Based Billing

### Cost Tracking

Track all AI operations that incur costs:

#### 1. Document Processing Costs

**Text Extraction**:
- PDF parsing: $0.001 per page
- DOCX parsing: $0.0005 per page
- OCR (scanned PDFs): $0.01 per page

**Embedding Generation**:
- Vector embeddings: $0.0001 per 1K tokens
- Chunking: Included in processing

#### 2. Analysis Costs

**Basic Analysis** (Tier 1):
- Win probability: $0.50 per analysis
- Basic scoring: $1.00 per document

**Deep Analysis** (Tier 2+):
- Multi-dimensional scoring: $50 per analysis
- Risk assessment: Included
- Compliance matrix: Included

#### 3. Generation Costs

**Bid Generation**:
- GPT-4o: $0.03 per 1K input tokens, $0.06 per 1K output tokens
- Claude Sonnet 4: $0.003 per 1K input, $0.015 per 1K output
- Gemini Flash: $0.0001 per 1K input, $0.0004 per 1K output
- DeepSeek: $0.00014 per 1K input, $0.00028 per 1K output

**Model Selection Impact**:
- Users can choose model (cost vs. quality trade-off)
- Default to cost-effective models for basic operations
- Premium models for critical bids

#### 4. Specialized Processing

**Blueprint/Drawing Analysis**:
- OCR processing: $25 per drawing
- Sketch agent analysis: $10 per image
- CAD file parsing: $50 per file

**RAG Operations**:
- Vector search: $0.0001 per query
- Context assembly: Included

### Usage Metering

**Real-Time Tracking**:
- Track all operations as they occur
- Store usage events in database
- Calculate costs in real-time
- Update user balance immediately

**Billing Period**:
- Monthly billing cycle (aligned with subscription)
- Usage resets at start of new billing period
- Overage charges billed separately

---

## Cost Management

### Cost Protection Mechanisms

#### 1. Hard Limits

**Per-Tier Limits**:
- Tier 1: Hard stop at $99 usage (subscription value)
- Tier 2: Hard stop at $500 usage (base + included credits)
- Tier 3: No hard limits (unlimited usage)

**User Controls**:
- Set monthly spending limits
- Receive alerts at 50%, 75%, 90% of limit
- Auto-pause at limit (optional)

#### 2. RAG Optimization

**Efficient Processing**:
- Vectorize documents once (cheap operation)
- Only fetch relevant chunks for queries (not entire document)
- Cache embeddings to avoid re-processing
- Batch operations when possible

**Cost Reduction Strategies**:
- Use cheaper models for non-critical operations
- Cache frequently accessed data
- Optimize chunk sizes for cost/quality balance

#### 3. Usage Alerts

**Proactive Notifications**:
- Email alerts at usage thresholds
- In-app notifications
- Dashboard warnings
- Account manager contact (Enterprise)

### Cost Transparency

**Usage Dashboard**:
- Real-time usage tracking
- Cost breakdown by operation type
- Projected monthly cost
- Historical usage trends

**Invoice Details**:
- Line-item breakdown
- Cost per operation
- Included vs. overage charges
- Tax information

---

## Database Schema

### Subscription Plans Table

```sql
CREATE TABLE subscription_plans (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,  -- 'sifter', 'estimator', 'enterprise'
  display_name VARCHAR(255) NOT NULL,  -- 'The Sifter', 'The Estimator's Assistant'
  tier INTEGER NOT NULL,  -- 1, 2, 3, 4
  base_price DECIMAL(10, 2) NOT NULL,  -- Monthly base price
  currency VARCHAR(3) DEFAULT 'USD',
  
  -- Feature flags
  features JSONB DEFAULT '{}',  -- Feature availability
  
  -- Usage limits
  limits JSONB DEFAULT '{}',  -- {
    --   "projects": 5,
    --   "documents": 50,
    --   "bid_generations": 3,
    --   "deep_analyses": 0,
    --   "storage_gb": 1,
    --   "team_members": 1
  -- }
  
  -- Included credits
  included_credits JSONB DEFAULT '{}',  -- {
    --   "deep_analyses": 5,
    --   "document_pages": 50,
    --   "bid_generations": 10
  -- }
  
  -- Overage pricing
  overage_pricing JSONB DEFAULT '{}',  -- {
    --   "deep_analysis": 50.00,
    --   "document_page": 0.50,
    --   "bid_generation": 15.00,
    --   "blueprint_analysis": 25.00
  -- }
  
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Company Subscriptions Table

```sql
CREATE TABLE company_subscriptions (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  plan_id INTEGER NOT NULL REFERENCES subscription_plans(id),
  
  -- Subscription details
  status VARCHAR(50) NOT NULL DEFAULT 'active',  -- active, cancelled, expired, suspended
  billing_cycle VARCHAR(20) DEFAULT 'monthly',  -- monthly, annual
  current_period_start TIMESTAMP NOT NULL,
  current_period_end TIMESTAMP NOT NULL,
  
  -- Pricing
  base_price DECIMAL(10, 2) NOT NULL,  -- Snapshot at time of subscription
  discount_percent DECIMAL(5, 2) DEFAULT 0,
  final_price DECIMAL(10, 2) NOT NULL,
  
  -- Payment
  payment_method_id VARCHAR(255),  -- Stripe payment method ID
  auto_renew BOOLEAN DEFAULT true,
  
  -- Cancellation
  cancelled_at TIMESTAMP,
  cancel_reason TEXT,
  cancel_at_period_end BOOLEAN DEFAULT false,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(company_id)  -- One active subscription per company
);
```

### Usage Events Table

```sql
CREATE TABLE usage_events (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  project_id VARCHAR REFERENCES projects(id) ON DELETE SET NULL,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  
  -- Event details
  event_type VARCHAR(100) NOT NULL,  -- 'document_processed', 'deep_analysis', 'bid_generated', 'blueprint_analyzed'
  event_category VARCHAR(50) NOT NULL,  -- 'processing', 'analysis', 'generation', 'storage'
  
  -- Usage metrics
  quantity DECIMAL(10, 4) NOT NULL,  -- Pages, tokens, analyses, etc.
  unit VARCHAR(50) NOT NULL,  -- 'pages', 'tokens', 'analyses', 'gb'
  
  -- Cost calculation
  unit_cost DECIMAL(10, 4) NOT NULL,
  total_cost DECIMAL(10, 2) NOT NULL,
  
  -- Metadata
  metadata JSONB DEFAULT '{}',  -- {
    --   "model_used": "gpt-4o",
    --   "document_type": "pdf",
    --   "pages": 250,
    --   "tokens_input": 150000,
    --   "tokens_output": 50000
  -- }
  
  -- Billing period
  billing_period_start TIMESTAMP NOT NULL,
  billing_period_end TIMESTAMP NOT NULL,
  
  -- Status
  is_included BOOLEAN DEFAULT false,  -- Covered by subscription credits
  is_billed BOOLEAN DEFAULT false,  -- Included in invoice
  
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_usage_events_company_period ON usage_events(company_id, billing_period_start, billing_period_end);
CREATE INDEX idx_usage_events_type ON usage_events(event_type);
CREATE INDEX idx_usage_events_billed ON usage_events(is_billed) WHERE is_billed = false;
```

### Usage Credits Table

```sql
CREATE TABLE usage_credits (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  subscription_id INTEGER REFERENCES company_subscriptions(id) ON DELETE CASCADE,
  
  -- Credit details
  credit_type VARCHAR(100) NOT NULL,  -- 'deep_analysis', 'document_page', 'bid_generation', 'blueprint_analysis'
  quantity DECIMAL(10, 4) NOT NULL,  -- Number of credits
  used_quantity DECIMAL(10, 4) DEFAULT 0,
  remaining_quantity DECIMAL(10, 4) GENERATED ALWAYS AS (quantity - used_quantity) STORED,
  
  -- Validity
  valid_from TIMESTAMP NOT NULL,
  valid_until TIMESTAMP NOT NULL,
  
  -- Source
  source VARCHAR(50) NOT NULL,  -- 'subscription', 'purchase', 'promotion', 'refund'
  source_reference VARCHAR(255),  -- Reference to purchase, promotion code, etc.
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_usage_credits_company_valid ON usage_credits(company_id, valid_from, valid_until);
CREATE INDEX idx_usage_credits_type ON usage_credits(credit_type);
```

### Invoices Table

```sql
CREATE TABLE invoices (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  subscription_id INTEGER REFERENCES company_subscriptions(id) ON DELETE SET NULL,
  
  -- Invoice details
  invoice_number VARCHAR(50) NOT NULL UNIQUE,  -- 'INV-2024-001234'
  status VARCHAR(50) NOT NULL DEFAULT 'draft',  -- draft, pending, paid, failed, refunded
  
  -- Billing period
  period_start TIMESTAMP NOT NULL,
  period_end TIMESTAMP NOT NULL,
  
  -- Amounts
  base_amount DECIMAL(10, 2) NOT NULL,  -- Subscription base price
  usage_amount DECIMAL(10, 2) DEFAULT 0,  -- Overage charges
  discount_amount DECIMAL(10, 2) DEFAULT 0,
  tax_amount DECIMAL(10, 2) DEFAULT 0,
  total_amount DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'USD',
  
  -- Payment
  paid_at TIMESTAMP,
  payment_method VARCHAR(100),
  payment_reference VARCHAR(255),  -- Stripe payment intent ID
  
  -- Line items (detailed breakdown)
  line_items JSONB DEFAULT '[]',  -- Array of line items
  
  -- PDF generation
  pdf_url TEXT,  -- Link to generated invoice PDF
  pdf_generated_at TIMESTAMP,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_invoices_company ON invoices(company_id);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_period ON invoices(period_start, period_end);
```

### Payment Methods Table

```sql
CREATE TABLE payment_methods (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  
  -- Payment provider
  provider VARCHAR(50) NOT NULL,  -- 'stripe', 'paypal'
  provider_customer_id VARCHAR(255),  -- Stripe customer ID
  provider_payment_method_id VARCHAR(255),  -- Stripe payment method ID
  
  -- Card details (masked)
  card_type VARCHAR(50),  -- 'visa', 'mastercard', 'amex'
  last4 VARCHAR(4),
  expiry_month INTEGER,
  expiry_year INTEGER,
  cardholder_name VARCHAR(255),
  
  -- Status
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

---

## API Design

### Subscription Management Endpoints

#### GET /api/billing/subscription
Get current subscription details

**Response**:
```json
{
  "subscription": {
    "id": 123,
    "plan": {
      "id": 2,
      "name": "estimator",
      "display_name": "The Estimator's Assistant",
      "tier": 2,
      "base_price": 299.00
    },
    "status": "active",
    "current_period_start": "2024-12-01T00:00:00Z",
    "current_period_end": "2025-01-01T00:00:00Z",
    "auto_renew": true
  },
  "usage": {
    "period_start": "2024-12-01T00:00:00Z",
    "period_end": "2025-01-01T00:00:00Z",
    "credits_remaining": {
      "deep_analyses": 3,
      "document_pages": 25,
      "bid_generations": 7
    },
    "usage_summary": {
      "total_cost": 125.50,
      "included_cost": 100.00,
      "overage_cost": 25.50
    }
  }
}
```

#### GET /api/billing/plans
List all available subscription plans

#### POST /api/billing/subscribe
Subscribe to a plan

**Request**:
```json
{
  "plan_id": 2,
  "billing_cycle": "monthly",
  "payment_method_id": "pm_1234567890"
}
```

#### PUT /api/billing/subscription
Update subscription (upgrade/downgrade)

#### DELETE /api/billing/subscription
Cancel subscription

**Request**:
```json
{
  "cancel_at_period_end": true,
  "reason": "Too expensive"
}
```

### Usage Tracking Endpoints

#### GET /api/billing/usage
Get current period usage

**Query Parameters**:
- `start_date`: Optional start date
- `end_date`: Optional end date
- `group_by`: `day`, `week`, `month`, `project`, `event_type`

**Response**:
```json
{
  "period": {
    "start": "2024-12-01T00:00:00Z",
    "end": "2025-01-01T00:00:00Z"
  },
  "summary": {
    "total_events": 145,
    "total_cost": 125.50,
    "included_cost": 100.00,
    "overage_cost": 25.50
  },
  "breakdown": [
    {
      "event_type": "deep_analysis",
      "count": 8,
      "cost": 50.00,
      "included": 5,
      "overage": 3
    },
    {
      "event_type": "bid_generation",
      "count": 12,
      "cost": 30.00,
      "included": 10,
      "overage": 2
    }
  ],
  "daily_usage": [
    {
      "date": "2024-12-15",
      "cost": 15.50,
      "events": 12
    }
  ]
}
```

#### GET /api/billing/usage/events
Get detailed usage events

**Query Parameters**:
- `page`: Page number
- `limit`: Items per page
- `event_type`: Filter by event type
- `project_id`: Filter by project

### Invoice Endpoints

#### GET /api/billing/invoices
List all invoices

#### GET /api/billing/invoices/:id
Get invoice details

**Response**:
```json
{
  "invoice": {
    "id": 456,
    "invoice_number": "INV-2024-001234",
    "status": "paid",
    "period_start": "2024-11-01T00:00:00Z",
    "period_end": "2024-12-01T00:00:00Z",
    "base_amount": 299.00,
    "usage_amount": 25.50,
    "discount_amount": 0.00,
    "tax_amount": 25.95,
    "total_amount": 350.45,
    "paid_at": "2024-12-05T10:30:00Z",
    "pdf_url": "https://..."
  },
  "line_items": [
    {
      "description": "The Estimator's Assistant - Monthly",
      "quantity": 1,
      "unit_price": 299.00,
      "total": 299.00
    },
    {
      "description": "Deep Analysis (Overage) - 3 analyses",
      "quantity": 3,
      "unit_price": 50.00,
      "total": 150.00
    }
  ]
}
```

#### GET /api/billing/invoices/:id/pdf
Download invoice PDF

### Payment Methods Endpoints

#### GET /api/billing/payment-methods
List payment methods

#### POST /api/billing/payment-methods
Add payment method

#### PUT /api/billing/payment-methods/:id
Update payment method

#### DELETE /api/billing/payment-methods/:id
Remove payment method

#### POST /api/billing/payment-methods/:id/set-default
Set as default payment method

---

## UI/UX Design

### Billing Dashboard

**Route**: `/settings/billing`

**Layout**:
```
┌─────────────────────────────────────────────────────────┐
│  Billing & Subscription                                 │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │  Current Subscription                          │   │
│  │  ┌─────────────────────────────────────────┐   │   │
│  │  │ The Estimator's Assistant                │   │   │
│  │  │ $299/month                               │   │   │
│  │  │ Active until Jan 1, 2025                │   │   │
│  │  │ [Manage Subscription] [Upgrade]          │   │   │
│  │  └─────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │  Usage This Month                               │   │
│  │  ┌─────────────────────────────────────────┐   │   │
│  │  │ Deep Analyses: 8/5 (3 overage)         │   │   │
│  │  │ Bid Generations: 12/10 (2 overage)      │   │   │
│  │  │ Document Pages: 75/50 (25 overage)      │   │   │
│  │  │                                         │   │   │
│  │  │ Estimated Overage: $25.50               │   │   │
│  │  └─────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │  Usage Chart (Last 30 Days)                     │   │
│  │  [Line chart showing daily usage]               │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │  Recent Invoices                                │   │
│  │  [Table of invoices]                            │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Subscription Management Page

**Route**: `/settings/billing/subscription`

**Features**:
- Current plan display
- Plan comparison table
- Upgrade/downgrade options
- Cancellation flow
- Billing cycle selector (monthly/annual)

### Usage Details Page

**Route**: `/settings/billing/usage`

**Features**:
- Real-time usage tracking
- Usage breakdown by type
- Cost projection
- Usage alerts configuration
- Historical usage trends

### Invoice History Page

**Route**: `/settings/billing/invoices`

**Features**:
- List of all invoices
- Filter by date range, status
- Download PDF
- Payment status
- Line item details

### Payment Methods Page

**Route**: `/settings/billing/payment-methods`

**Features**:
- List of saved payment methods
- Add new payment method
- Set default
- Remove payment method
- Security indicators

---

## Billing Workflows

### Subscription Workflow

#### 1. New Subscription

```
User selects plan
    ↓
Enter payment method
    ↓
Create subscription (Stripe)
    ↓
Activate subscription
    ↓
Allocate included credits
    ↓
Send welcome email
    ↓
Redirect to dashboard
```

#### 2. Upgrade Subscription

```
User clicks "Upgrade"
    ↓
Show plan comparison
    ↓
Select new plan
    ↓
Calculate prorated amount
    ↓
Charge difference
    ↓
Update subscription
    ↓
Allocate new credits
    ↓
Notify user
```

#### 3. Downgrade Subscription

```
User clicks "Downgrade"
    ↓
Show plan comparison
    ↓
Select new plan
    ↓
Calculate prorated credit
    ↓
Schedule downgrade at period end
    ↓
Notify user of effective date
```

#### 4. Cancel Subscription

```
User clicks "Cancel"
    ↓
Show cancellation form
    ↓
Collect reason
    ↓
Schedule cancellation
    ↓
Set cancel_at_period_end = true
    ↓
Send confirmation email
    ↓
Show retention offer (optional)
```

### Usage Tracking Workflow

#### 1. Document Processing

```
User uploads document
    ↓
Calculate processing cost
    ↓
Check if credits available
    ↓
If credits: Deduct from credits
If no credits: Charge overage
    ↓
Create usage event
    ↓
Update usage dashboard
    ↓
Send alert if threshold reached
```

#### 2. Deep Analysis

```
User requests deep analysis
    ↓
Check if included credits available
    ↓
If credits: Use credit
If no credits: Check if within limit
    ↓
If within limit: Charge overage
If over limit: Block or require approval
    ↓
Create usage event
    ↓
Update dashboard
```

### Invoice Generation Workflow

```
End of billing period
    ↓
Aggregate usage events
    ↓
Calculate base + overage
    ↓
Apply discounts
    ↓
Calculate tax
    ↓
Generate invoice
    ↓
Create PDF
    ↓
Send invoice email
    ↓
Attempt payment
    ↓
If successful: Mark paid
If failed: Retry + notify
```

---

## Integration Points

### Stripe Integration

**Payment Processing**:
- Subscription management
- Payment method storage
- Invoice generation
- Webhook handling

**Webhooks**:
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_succeeded`
- `invoice.payment_failed`
- `charge.succeeded`
- `charge.failed`

### Usage Tracking Integration

**Event Creation Points**:
- Document upload → `document_processed`
- Analysis request → `deep_analysis` or `basic_analysis`
- Bid generation → `bid_generated`
- Blueprint upload → `blueprint_analyzed`
- Storage usage → `storage_used`

**Middleware**:
```typescript
async function trackUsage(
  companyId: number,
  eventType: string,
  quantity: number,
  metadata: Record<string, any>
) {
  // Calculate cost
  const cost = calculateCost(eventType, quantity, metadata);
  
  // Check credits
  const credit = await findAvailableCredit(companyId, eventType);
  
  if (credit) {
    // Use credit
    await useCredit(credit.id, quantity);
    await createUsageEvent({
      companyId,
      eventType,
      quantity,
      cost: 0, // Covered by credit
      is_included: true
    });
  } else {
    // Charge overage
    await createUsageEvent({
      companyId,
      eventType,
      quantity,
      cost,
      is_included: false
    });
    
    // Check limits
    await checkUsageLimits(companyId);
  }
}
```

### Cost Calculation Service

```typescript
class CostCalculator {
  calculateDocumentProcessingCost(
    documentType: string,
    pages: number,
    requiresOCR: boolean
  ): number {
    let cost = 0;
    
    if (documentType === 'pdf') {
      cost += pages * 0.001;
    } else if (documentType === 'docx') {
      cost += pages * 0.0005;
    }
    
    if (requiresOCR) {
      cost += pages * 0.01;
    }
    
    return cost;
  }
  
  calculateAnalysisCost(
    analysisType: 'basic' | 'deep',
    documentSize: number
  ): number {
    if (analysisType === 'basic') {
      return 1.00;
    } else {
      return 50.00; // Deep analysis flat rate
    }
  }
  
  calculateGenerationCost(
    model: string,
    inputTokens: number,
    outputTokens: number
  ): number {
    const pricing = {
      'gpt-4o': { input: 0.03, output: 0.06 },
      'claude-sonnet-4': { input: 0.003, output: 0.015 },
      'gemini-flash': { input: 0.0001, output: 0.0004 },
      'deepseek': { input: 0.00014, output: 0.00028 }
    };
    
    const rates = pricing[model];
    const inputCost = (inputTokens / 1000) * rates.input;
    const outputCost = (outputTokens / 1000) * rates.output;
    
    return inputCost + outputCost;
  }
}
```

---

## Security & Compliance

### Payment Security

- **PCI Compliance**: No card data stored locally
- **Tokenization**: All payment methods tokenized via Stripe
- **Encryption**: All financial data encrypted at rest
- **Audit Logging**: All billing actions logged

### Data Privacy

- **GDPR Compliance**: User data handling
- **Financial Data**: Separate encryption keys
- **Access Control**: Only authorized users can view billing
- **Data Retention**: Invoice data retained per legal requirements

### Fraud Prevention

- **Rate Limiting**: Prevent abuse of free tiers
- **Usage Monitoring**: Detect unusual patterns
- **Payment Verification**: 3D Secure for high-value transactions
- **Account Verification**: Email and phone verification

---

## Implementation Phases

### Phase 1: Foundation (MVP)
- Basic subscription management
- Tier 1 and Tier 2 plans
- Usage tracking for key operations
- Basic invoice generation
- Stripe integration

### Phase 2: Advanced Features
- Tier 3 (Enterprise) features
- Advanced usage analytics
- Cost optimization tools
- Automated billing workflows
- Payment method management

### Phase 3: Optimization
- Marketplace commission model
- Advanced cost controls
- Predictive usage analytics
- Custom pricing for enterprise
- White-label billing

---

## Success Metrics

### Financial Metrics
- **MRR Growth**: Monthly Recurring Revenue
- **ARPU**: Average Revenue Per User
- **Churn Rate**: Subscription cancellations
- **LTV**: Customer Lifetime Value
- **CAC**: Customer Acquisition Cost

### Usage Metrics
- **Usage per User**: Track average usage
- **Credit Utilization**: How much of included credits are used
- **Overage Rate**: Percentage of users hitting overage
- **Cost per Operation**: Track actual AI costs

### User Metrics
- **Upgrade Rate**: Tier upgrades
- **Downgrade Rate**: Tier downgrades
- **Payment Success Rate**: Successful payments
- **Support Tickets**: Billing-related issues

---

**Document End**

*This document serves as the design specification for the BidForge AI billing module. It should be updated as the implementation progresses and requirements evolve.*

