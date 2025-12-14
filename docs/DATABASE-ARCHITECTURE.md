# BidForge AI - Database Architecture Documentation

**Last Updated:** December 11, 2025
**Database:** PostgreSQL (Neon Serverless)
**ORM:** Drizzle ORM with TypeScript
**Vector Extension:** pgvector (1536 dimensions)

---

## Table of Contents

1. [Database Technology Stack](#database-technology-stack)
2. [Multi-Tenancy Architecture](#multi-tenancy-architecture)
3. [Core Business Tables](#core-business-tables)
4. [RAG & AI Tables](#rag--ai-tables)
5. [Analysis & Intelligence Tables](#analysis--intelligence-tables)
6. [Enterprise & Collaboration Tables](#enterprise--collaboration-tables)
7. [Agent System Tables](#agent-system-tables)
8. [Database Relationships](#database-relationships)
9. [Indexes & Performance](#indexes--performance)
10. [Data Types & Special Features](#data-types--special-features)

---

## Database Technology Stack

### PostgreSQL with Neon Serverless

```typescript
// server/db.ts
import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle({ client: pool, schema });
```

**Key Features:**

- ✅ Serverless PostgreSQL with auto-scaling
- ✅ WebSocket-based connections for edge runtime
- ✅ pgvector extension for semantic search
- ✅ Full JSONB support for flexible data structures
- ✅ Type-safe queries with Drizzle ORM
- ✅ Automatic schema inference

---

## Multi-Tenancy Architecture

### 🏢 Companies Table

**Table:** `companies`
**Purpose:** Multi-tenant organization management

| Column      | Type         | Description                |
| ----------- | ------------ | -------------------------- |
| `id`        | serial       | Primary key                |
| `name`      | varchar(255) | Company name               |
| `slug`      | varchar(100) | Unique URL-safe identifier |
| `logo`      | text         | Logo URL or base64         |
| `settings`  | jsonb        | Company-wide settings      |
| `isActive`  | boolean      | Soft delete flag           |
| `createdAt` | timestamp    | Creation timestamp         |
| `updatedAt` | timestamp    | Last update timestamp      |
| `deletedAt` | timestamp    | Soft deletion timestamp    |

**Business Rules:**

- Each company is fully isolated (data separation)
- Slug must be unique and URL-safe
- Settings store company-specific configurations

---

### 👥 Users Table

**Table:** `users`
**Purpose:** User authentication and profile management

| Column             | Type         | Description                    |
| ------------------ | ------------ | ------------------------------ |
| `id`               | serial       | Primary key                    |
| `companyId`        | integer      | FK to companies (CASCADE)      |
| `email`            | varchar(255) | Unique email address           |
| `passwordHash`     | varchar(255) | Bcrypt hashed password         |
| `name`             | varchar(255) | User display name              |
| `role`             | text         | User role (see Role Hierarchy) |
| `isActive`         | boolean      | Account status                 |
| `onboardingStatus` | varchar(20)  | Onboarding progress            |
| `brandingProfile`  | jsonb        | Company branding data          |
| `createdAt`        | timestamp    | Account creation               |
| `updatedAt`        | timestamp    | Last profile update            |
| `lastLoginAt`      | timestamp    | Last login timestamp           |
| `deletedAt`        | timestamp    | Soft deletion                  |

**Role Hierarchy:**

```typescript
type UserRole = 'system_admin' | 'system_user' | 'company_admin' | 'company_user';

// System-level roles (cross-company access)
- system_admin: Full platform access
- system_user: View across platform, limited actions

// Company-level roles (scoped to companyId)
- company_admin: Full access within company
- company_user: Limited access within company
```

**BrandingProfile Schema:**

```typescript
type BrandingProfile = {
  // Basic Information
  companyName?: string;
  tagline?: string;
  websiteUrl?: string;
  primaryColor?: string;
  logoUrl?: string;
  aboutUs?: string;
  fullAboutContent?: string; // AI-extracted content

  // Contact Information
  contactName?: string;
  contactTitle?: string;
  contactPhone?: string;
  contactEmail?: string;
  streetAddress?: string;
  city?: string;
  state?: string;
  zip?: string;
  licenseNumber?: string;

  // Extended Fields (AI-populated)
  industry?: string;
  founded?: string;
  companySize?: string;
  products?: CompanyProductService[];
  services?: CompanyProductService[];
  socialMedia?: SocialMediaLinks;

  // Metadata
  dataSource?: "manual" | "website" | "mixed";
  lastFetchedAt?: string; // ISO timestamp
  fetchConfidence?: number; // 0-100
};
```

---

### 🎫 Company Invitations Table

**Table:** `company_invites`
**Purpose:** Team member invitation system

| Column       | Type         | Description                      |
| ------------ | ------------ | -------------------------------- |
| `id`         | serial       | Primary key                      |
| `companyId`  | integer      | FK to companies                  |
| `email`      | varchar(255) | Invitee email                    |
| `role`       | text         | Assigned role                    |
| `inviteCode` | varchar(64)  | Unique invite code               |
| `invitedBy`  | integer      | FK to users                      |
| `status`     | text         | pending/accepted/expired/revoked |
| `expiresAt`  | timestamp    | Expiration timestamp             |
| `acceptedAt` | timestamp    | Acceptance timestamp             |
| `createdAt`  | timestamp    | Creation timestamp               |

**Workflow:**

1. Admin creates invite → generates unique `inviteCode`
2. User receives email with invite link
3. User accepts → creates account + joins company
4. Invite status changes to 'accepted'

---

### 🔐 Sessions Table

**Table:** `sessions`
**Purpose:** JWT refresh token management

| Column      | Type         | Description           |
| ----------- | ------------ | --------------------- |
| `id`        | serial       | Primary key           |
| `userId`    | integer      | FK to users (CASCADE) |
| `tokenHash` | varchar(255) | Hashed refresh token  |
| `expiresAt` | timestamp    | Token expiration      |
| `createdAt` | timestamp    | Session creation      |

**Security:**

- Tokens are hashed before storage (bcrypt)
- CASCADE delete on user deletion
- Expired tokens cleaned via cron job

---

## Core Business Tables

### 📁 Projects Table

**Table:** `projects`
**Purpose:** RFP/Bid project management

| Column       | Type      | Description                             |
| ------------ | --------- | --------------------------------------- |
| `id`         | varchar   | UUID (gen_random_uuid())                |
| `companyId`  | integer   | FK to companies (CASCADE)               |
| `name`       | text      | Project name                            |
| `clientName` | text      | Client/vendor name                      |
| `status`     | text      | Active/Submitted/Closed-Won/Closed-Lost |
| `isArchived` | boolean   | Archive status                          |
| `metadata`   | jsonb     | Custom project data                     |
| `createdAt`  | timestamp | Project creation                        |
| `deletedAt`  | timestamp | Soft deletion                           |

**Status Workflow:**

```
Active → Submitted → [Closed-Won | Closed-Lost]
   ↓
Archived (isArchived = true)
```

---

### 📄 Documents Table

**Table:** `documents`
**Purpose:** RFQ document storage and processing

| Column        | Type         | Description              |
| ------------- | ------------ | ------------------------ |
| `id`          | serial       | Primary key              |
| `projectId`   | varchar      | FK to projects (CASCADE) |
| `filename`    | text         | Original filename        |
| `content`     | text         | Extracted text content   |
| `isProcessed` | boolean      | Processing status        |
| `uploadedAt`  | timestamp    | Upload timestamp         |
| `deletedAt`   | timestamp    | Soft deletion            |
| `version`     | integer      | Document version         |
| `groupId`     | varchar(255) | Group related docs       |

**Processing Pipeline:**

1. Upload → PDF/DOCX/ZIP extraction
2. Text extraction → `content` field
3. Chunking → `document_chunks` table
4. Embedding generation → vector search ready
5. `isProcessed` = true

---

### 📝 Templates Table

**Table:** `templates`
**Purpose:** Reusable bid proposal templates

| Column        | Type         | Description               |
| ------------- | ------------ | ------------------------- |
| `id`          | serial       | Primary key               |
| `companyId`   | integer      | FK to companies (CASCADE) |
| `name`        | varchar(255) | Template name             |
| `description` | text         | Template description      |
| `category`    | varchar(100) | Template category         |
| `sections`    | jsonb        | Template sections array   |
| `createdAt`   | timestamp    | Creation timestamp        |
| `updatedAt`   | timestamp    | Last update               |

**Sections Schema:**

```typescript
type TemplateSection = {
  title: string;
  content: string; // Rich text/HTML
}[];
```

---

## RAG & AI Tables

### 🧩 Document Chunks Table

**Table:** `document_chunks`
**Purpose:** Semantic chunking for RAG

| Column       | Type         | Description               |
| ------------ | ------------ | ------------------------- |
| `id`         | serial       | Primary key               |
| `documentId` | integer      | FK to documents (CASCADE) |
| `companyId`  | integer      | FK to companies (CASCADE) |
| `content`    | text         | Chunk text content        |
| `embedding`  | vector(1536) | OpenAI embedding          |
| `chunkIndex` | integer      | Sequential chunk number   |

**RAG Strategy:**

- Chunk size: ~500 tokens
- Overlap: 50 tokens
- Embedding model: `text-embedding-3-small`
- Search: Hybrid (70% vector + 30% full-text)

---

### 📚 Knowledge Base Documents Table

**Table:** `knowledge_base_documents`
**Purpose:** Company knowledge repository

| Column         | Type      | Description               |
| -------------- | --------- | ------------------------- |
| `id`           | serial    | Primary key               |
| `companyId`    | integer   | FK to companies (CASCADE) |
| `filename`     | text      | Storage filename          |
| `originalName` | text      | Original upload name      |
| `fileType`     | text      | csv/docx/pdf/txt/xlsx     |
| `fileSize`     | integer   | File size in bytes        |
| `content`      | text      | Extracted text            |
| `isProcessed`  | boolean   | Processing status         |
| `chunkCount`   | integer   | Number of chunks          |
| `uploadedAt`   | timestamp | Upload timestamp          |

**Use Cases:**

- Past proposals ("Closed-Won" projects)
- Company policies and guidelines
- Technical specifications
- Standard response templates

---

### 🧩 Knowledge Base Chunks Table

**Table:** `knowledge_base_chunks`
**Purpose:** Knowledge base semantic search

| Column       | Type         | Description                    |
| ------------ | ------------ | ------------------------------ |
| `id`         | serial       | Primary key                    |
| `documentId` | integer      | FK to knowledge_base_documents |
| `companyId`  | integer      | FK to companies (CASCADE)      |
| `content`    | text         | Chunk text content             |
| `embedding`  | vector(1536) | OpenAI embedding               |
| `chunkIndex` | integer      | Sequential chunk number        |

**Search Performance:**

- Indexed by embedding (HNSW or IVFFlat)
- Company-scoped queries (data isolation)
- Cosine similarity search

---

### 🤖 AI Instructions Table

**Table:** `ai_instructions`
**Purpose:** Company-specific AI generation presets

| Column         | Type      | Description                |
| -------------- | --------- | -------------------------- |
| `id`           | serial    | Primary key                |
| `companyId`    | integer   | FK to companies (CASCADE)  |
| `name`         | text      | Instruction preset name    |
| `instructions` | text      | System prompt instructions |
| `isDefault`    | boolean   | Default preset flag        |
| `createdAt`    | timestamp | Creation timestamp         |
| `updatedAt`    | timestamp | Last update                |

**Examples:**

- "Formal Government Bid"
- "Informal Private Sector"
- "Technical Emphasis"

---

### 📋 Generated Bids Table

**Table:** `bids`
**Purpose:** AI-generated bid proposals

| Column         | Type        | Description                |
| -------------- | ----------- | -------------------------- |
| `id`           | serial      | Primary key                |
| `projectId`    | varchar     | FK to projects (CASCADE)   |
| `companyId`    | integer     | FK to companies (CASCADE)  |
| `userId`       | integer     | FK to users (SET NULL)     |
| `content`      | text        | Final bid HTML             |
| `rawContent`   | text        | Original AI output         |
| `instructions` | text        | Custom instructions used   |
| `tone`         | text        | professional/casual/formal |
| `model`        | text        | AI model used              |
| `searchMethod` | text        | RAG search method          |
| `chunksUsed`   | integer     | RAG chunks count           |
| `version`      | integer     | Bid version number         |
| `isLatest`     | boolean     | Latest version flag        |
| `shareToken`   | varchar(64) | Public sharing token       |
| `createdAt`    | timestamp   | Generation timestamp       |
| `deletedAt`    | timestamp   | Soft deletion              |

**Versioning:**

- Each edit creates new version
- `isLatest` flag marks current version
- All versions retained for audit

---

## Analysis & Intelligence Tables

### 🔍 RFP Analyses Table

**Table:** `rfp_analyses`
**Purpose:** AI-powered RFP analysis results

| Column                | Type      | Description              |
| --------------------- | --------- | ------------------------ |
| `id`                  | serial    | Primary key              |
| `projectId`           | varchar   | FK to projects (CASCADE) |
| `qualityScore`        | real      | 0-100 quality score      |
| `doabilityScore`      | real      | 0-100 feasibility score  |
| `clarityScore`        | real      | 0-100 clarity score      |
| `vendorRiskScore`     | real      | 0-100 risk score         |
| `overallRiskLevel`    | text      | Low/Medium/High/Critical |
| `missingDocuments`    | jsonb     | Array of missing docs    |
| `unclearRequirements` | jsonb     | Ambiguous requirements   |
| `redFlags`            | jsonb     | Warning indicators       |
| `opportunities`       | jsonb     | Competitive advantages   |
| `recommendations`     | jsonb     | Action items             |
| `vendorName`          | text      | Client/vendor name       |
| `vendorPaymentRating` | text      | Payment reliability      |
| `paymentHistory`      | jsonb     | Historical payment data  |
| `industryReputation`  | jsonb     | Reputation indicators    |
| `analyzedAt`          | timestamp | Analysis timestamp       |
| `analysisVersion`     | text      | Model version            |

**Analysis Scores:**

```typescript
// Quality Score (0-100)
- Document organization
- Professional presentation
- Completeness

// Clarity Score (0-100)
- Requirement specificity
- Scope definition
- Deliverable clarity

// Doability Score (0-100)
- Technical feasibility
- Resource availability
- Timeline reasonableness

// Vendor Risk Score (0-100)
- Payment history
- Communication quality
- Past disputes
```

---

### ⚠️ Analysis Alerts Table

**Table:** `analysis_alerts`
**Purpose:** Critical issues from RFP analysis

| Column              | Type      | Description                  |
| ------------------- | --------- | ---------------------------- |
| `id`                | serial    | Primary key                  |
| `analysisId`        | integer   | FK to rfp_analyses (CASCADE) |
| `alertType`         | text      | Alert category               |
| `severity`          | text      | low/medium/high/critical     |
| `title`             | text      | Alert title                  |
| `description`       | text      | Detailed description         |
| `recommendedAction` | text      | Suggested resolution         |
| `isResolved`        | boolean   | Resolution status            |
| `createdAt`         | timestamp | Alert timestamp              |

**Alert Types:**

- Missing documents
- Unclear requirements
- Payment risk
- Unrealistic timeline
- Scope creep indicators

---

### ⚔️ Document Conflicts Table

**Table:** `document_conflicts`
**Purpose:** Contradiction detection in RFQ documents

| Column                | Type      | Description                           |
| --------------------- | --------- | ------------------------------------- |
| `id`                  | serial    | Primary key                           |
| `projectId`           | varchar   | FK to projects (CASCADE)              |
| `conflictType`        | text      | semantic/numeric/temporal/scope       |
| `severity`            | text      | low/medium/high/critical              |
| `status`              | text      | detected/reviewing/resolved/dismissed |
| `sourceDocumentId`    | integer   | FK to documents                       |
| `sourceChunkId`       | integer   | FK to document_chunks                 |
| `sourceText`          | text      | Conflicting text A                    |
| `sourceLocation`      | jsonb     | {page, paragraph, sentence}           |
| `targetDocumentId`    | integer   | FK to documents                       |
| `targetChunkId`       | integer   | FK to document_chunks                 |
| `targetText`          | text      | Conflicting text B                    |
| `targetLocation`      | jsonb     | {page, paragraph, sentence}           |
| `description`         | text      | Conflict explanation                  |
| `suggestedResolution` | text      | How to resolve                        |
| `confidenceScore`     | real      | 0-1 confidence                        |
| `semanticSimilarity`  | real      | 0-1 similarity score                  |
| `resolvedBy`          | integer   | FK to users                           |
| `resolvedAt`          | timestamp | Resolution timestamp                  |
| `resolution`          | text      | Resolution notes                      |
| `metadata`            | jsonb     | Additional data                       |
| `detectedAt`          | timestamp | Detection timestamp                   |
| `updatedAt`           | timestamp | Last update                           |

**Conflict Types:**

```typescript
// Semantic: Contradictory statements
"Project duration: 6 months" vs "Complete by Q1 (3 months)"

// Numeric: Inconsistent numbers
"Budget: $500k" vs "Expected cost: $750k"

// Temporal: Timeline conflicts
"Deadline: Dec 15" vs "Submit before Nov 30"

// Scope: Scope mismatches
"3 deliverables" vs detailed list of 7 items
```

---

### 📊 Conflict Detection Runs Table

**Table:** `conflict_detection_runs`
**Purpose:** Track conflict detection jobs

| Column              | Type      | Description              |
| ------------------- | --------- | ------------------------ |
| `id`                | serial    | Primary key              |
| `projectId`         | varchar   | FK to projects (CASCADE) |
| `status`            | text      | running/completed/failed |
| `startedAt`         | timestamp | Job start time           |
| `completedAt`       | timestamp | Job completion time      |
| `totalConflicts`    | integer   | Total conflicts found    |
| `semanticConflicts` | integer   | Semantic conflict count  |
| `numericConflicts`  | integer   | Numeric conflict count   |
| `temporalConflicts` | integer   | Temporal conflict count  |
| `error`             | text      | Error message if failed  |
| `metadata`          | jsonb     | Run configuration        |

---

### 🏆 Win Probability Predictions Table

**Table:** `win_probability_predictions`
**Purpose:** ML-based bid success prediction

| Column            | Type      | Description              |
| ----------------- | --------- | ------------------------ |
| `id`              | serial    | Primary key              |
| `projectId`       | varchar   | FK to projects (CASCADE) |
| `probability`     | real      | 0-1 win probability      |
| `confidence`      | real      | 0-1 model confidence     |
| `predictionDate`  | timestamp | Prediction timestamp     |
| `featureScores`   | jsonb     | Feature values           |
| `featureWeights`  | jsonb     | Feature importance       |
| `breakdown`       | jsonb     | Feature breakdown array  |
| `riskFactors`     | jsonb     | Negative factors         |
| `strengthFactors` | jsonb     | Positive factors         |
| `recommendations` | jsonb     | Improvement suggestions  |
| `modelVersion`    | text      | ML model version         |
| `createdAt`       | timestamp | Record creation          |

**Feature Engineering:**

```typescript
type FeatureBreakdown = {
  name: string;            // Feature name
  displayName: string;     // User-friendly name
  score: number;           // Raw feature score
  weight: number;          // Feature importance
  contribution: number;    // Weighted contribution
  status: 'positive' | 'neutral' | 'negative';
  insight: string;         // Explanation
}[];

// 8 Core Features
1. projectTypeScore       // Past performance on similar projects
2. clientRelationshipScore // Existing relationship strength
3. competitivenessScore   // Market competition level
4. teamCapacityScore      // Resource availability
5. timelineScore          // Schedule feasibility
6. complexityScore        // Technical complexity
7. requirementsClarityScore // Requirement quality
8. budgetAlignmentScore   // Budget fit
```

---

### 📈 Project Features Table

**Table:** `project_features`
**Purpose:** Feature extraction for ML models

| Column                     | Type      | Description                  |
| -------------------------- | --------- | ---------------------------- |
| `id`                       | serial    | Primary key                  |
| `projectId`                | varchar   | FK to projects (CASCADE)     |
| `projectTypeScore`         | real      | Project type match score     |
| `clientRelationshipScore`  | real      | Client relationship strength |
| `competitivenessScore`     | real      | Competition level            |
| `teamCapacityScore`        | real      | Team availability            |
| `timelineScore`            | real      | Timeline feasibility         |
| `complexityScore`          | real      | Technical complexity         |
| `requirementsClarityScore` | real      | Requirement quality          |
| `budgetAlignmentScore`     | real      | Budget alignment             |
| `historicalWinRate`        | real      | Historical success rate      |
| `similarProjectsWon`       | integer   | Past wins count              |
| `similarProjectsLost`      | integer   | Past losses count            |
| `rawFeatures`              | jsonb     | All extracted features       |
| `extractedAt`              | timestamp | Extraction timestamp         |
| `version`                  | text      | Feature version              |

---

### 📊 Bid Outcomes Table

**Table:** `bid_outcomes`
**Purpose:** Training data for ML models

| Column             | Type      | Description              |
| ------------------ | --------- | ------------------------ |
| `id`               | serial    | Primary key              |
| `projectId`        | varchar   | FK to projects (CASCADE) |
| `outcome`          | text      | won/lost/no_bid/pending  |
| `bidAmount`        | real      | Our bid amount           |
| `winningBidAmount` | real      | Winning bid amount       |
| `competitorCount`  | integer   | Number of competitors    |
| `outcomeFactors`   | jsonb     | Contributing factors     |
| `clientFeedback`   | text      | Client feedback          |
| `lessonsLearned`   | text      | Post-mortem notes        |
| `recordedAt`       | timestamp | Outcome timestamp        |
| `recordedBy`       | integer   | FK to users              |

**ML Training Pipeline:**

1. Project created → features extracted
2. Bid submitted → prediction made
3. Outcome recorded → model retrained
4. Accuracy improves over time

---

### 🗄️ Vendor Database Table

**Table:** `vendor_database`
**Purpose:** Vendor risk assessment data

| Column                | Type      | Description              |
| --------------------- | --------- | ------------------------ |
| `id`                  | serial    | Primary key              |
| `vendorName`          | text      | Unique vendor name       |
| `averagePaymentDays`  | integer   | Avg days to payment      |
| `onTimePaymentRate`   | real      | 0-1 on-time rate         |
| `totalProjects`       | integer   | Total project count      |
| `latePayments`        | integer   | Late payment count       |
| `disputedPayments`    | integer   | Disputed payment count   |
| `overallRating`       | text      | Excellent/Good/Fair/Poor |
| `paymentRating`       | text      | Payment reliability      |
| `communicationRating` | text      | Communication quality    |
| `industrySectors`     | jsonb     | Industry experience      |
| `typicalProjectSize`  | text      | Small/Medium/Large       |
| `geographicRegions`   | jsonb     | Service regions          |
| `notes`               | text      | Additional notes         |
| `lastUpdated`         | timestamp | Last update              |

---

## Enterprise & Collaboration Tables

### 👥 Project Team Members Table

**Table:** `project_team_members`
**Purpose:** Project-level access control

| Column           | Type      | Description              |
| ---------------- | --------- | ------------------------ |
| `id`             | serial    | Primary key              |
| `projectId`      | varchar   | FK to projects (CASCADE) |
| `userId`         | integer   | FK to users (CASCADE)    |
| `role`           | text      | owner/editor/viewer      |
| `addedBy`        | integer   | FK to users              |
| `addedAt`        | timestamp | Addition timestamp       |
| `lastAccessedAt` | timestamp | Last access time         |

**Role Permissions:**

```typescript
// owner: Full project control
- Delete project
- Manage team members
- All editor permissions

// editor: Content editing
- Edit bids
- Upload documents
- Run analysis
- All viewer permissions

// viewer: Read-only
- View bids
- View analysis
- Download documents
```

---

### 🟢 User Presence Table

**Table:** `user_presence`
**Purpose:** Real-time collaboration tracking

| Column         | Type      | Description              |
| -------------- | --------- | ------------------------ |
| `id`           | serial    | Primary key              |
| `userId`       | integer   | FK to users (CASCADE)    |
| `projectId`    | varchar   | FK to projects (CASCADE) |
| `status`       | text      | online/away/offline      |
| `currentPage`  | text      | Current page path        |
| `lastActiveAt` | timestamp | Last activity            |
| `socketId`     | text      | WebSocket connection ID  |

**Use Cases:**

- "User X is viewing this project"
- Prevent concurrent editing
- Activity indicators

---

### 📜 Audit Logs Table

**Table:** `audit_logs`
**Purpose:** Comprehensive audit trail

| Column         | Type      | Description               |
| -------------- | --------- | ------------------------- |
| `id`           | serial    | Primary key               |
| `userId`       | integer   | FK to users               |
| `userEmail`    | text      | User email (denormalized) |
| `action`       | text      | Action performed          |
| `resourceType` | text      | Resource type             |
| `resourceId`   | text      | Resource identifier       |
| `projectId`    | varchar   | FK to projects (SET NULL) |
| `details`      | jsonb     | Action details            |
| `ipAddress`    | text      | Client IP                 |
| `userAgent`    | text      | Client user agent         |
| `createdAt`    | timestamp | Action timestamp          |

**Tracked Actions:**

- User login/logout
- Project CRUD
- Document upload/delete
- Bid generation
- Team member changes
- Settings updates

---

### 📢 Team Activity Table

**Table:** `team_activity`
**Purpose:** Activity feed for collaboration

| Column         | Type      | Description                |
| -------------- | --------- | -------------------------- |
| `id`           | serial    | Primary key                |
| `projectId`    | varchar   | FK to projects (CASCADE)   |
| `userId`       | integer   | FK to users (CASCADE)      |
| `activityType` | text      | Activity category          |
| `description`  | text      | Human-readable description |
| `metadata`     | jsonb     | Activity metadata          |
| `createdAt`    | timestamp | Activity timestamp         |

**Activity Types:**

- document_uploaded
- bid_generated
- analysis_completed
- comment_added
- member_added
- status_changed

---

### 💬 Project Comments Table

**Table:** `project_comments`
**Purpose:** Discussion threads on projects

| Column       | Type      | Description                |
| ------------ | --------- | -------------------------- |
| `id`         | serial    | Primary key                |
| `projectId`  | varchar   | FK to projects (CASCADE)   |
| `userId`     | integer   | FK to users (CASCADE)      |
| `content`    | text      | Comment content            |
| `parentId`   | integer   | Parent comment (threading) |
| `isResolved` | boolean   | Resolution status          |
| `createdAt`  | timestamp | Comment timestamp          |
| `updatedAt`  | timestamp | Last edit timestamp        |

**Features:**

- Threaded discussions (parentId)
- Resolvable comments (task tracking)
- Edit history (updatedAt)

---

## Agent System Tables

### 🤖 Agent Executions Table

**Table:** `agent_executions`
**Purpose:** Agent workflow execution tracking

| Column        | Type         | Description              |
| ------------- | ------------ | ------------------------ |
| `id`          | serial       | Primary key              |
| `projectId`   | varchar      | FK to projects (CASCADE) |
| `agentName`   | varchar(100) | Agent identifier         |
| `status`      | varchar(50)  | running/completed/failed |
| `input`       | jsonb        | Agent input data         |
| `output`      | jsonb        | Agent output data        |
| `error`       | text         | Error message            |
| `startedAt`   | timestamp    | Execution start          |
| `completedAt` | timestamp    | Execution end            |
| `durationMs`  | integer      | Duration in milliseconds |

**Agent Types:**

- intake: Document processing
- analysis: RFP analysis
- decision: Go/No-Go decision
- generation: Bid generation
- review: Quality review

---

### 🔄 Agent States Table

**Table:** `agent_states`
**Purpose:** Workflow state persistence

| Column         | Type         | Description                      |
| -------------- | ------------ | -------------------------------- |
| `id`           | serial       | Primary key                      |
| `projectId`    | varchar      | FK to projects (UNIQUE CASCADE)  |
| `currentAgent` | varchar(100) | Current agent in workflow        |
| `status`       | varchar(50)  | pending/running/completed/failed |
| `state`        | jsonb        | Full workflow state              |
| `createdAt`    | timestamp    | State creation                   |
| `updatedAt`    | timestamp    | Last state update                |

**State Schema:**

```typescript
type AgentState = {
  documents?: DocumentInfo[];
  analysis?: AnalysisResult;
  decision?: DecisionResult;
  draft?: DraftResult;
  review?: ReviewResult;
  error?: string;
};
```

---

### ⚖️ Decision Logs Table

**Table:** `decision_logs`
**Purpose:** Go/No-Go decision tracking

| Column                  | Type      | Description               |
| ----------------------- | --------- | ------------------------- |
| `id`                    | serial    | Primary key               |
| `projectId`             | varchar   | FK to projects (CASCADE)  |
| `companyId`             | integer   | FK to companies (CASCADE) |
| `doabilityScore`        | real      | Feasibility score         |
| `minDoabilityThreshold` | real      | Threshold (default 30)    |
| `criticalRiskLevel`     | boolean   | Critical risk flag        |
| `vendorRiskScore`       | real      | Vendor risk score         |
| `decision`              | text      | PROCEED/REJECT            |
| `reason`                | text      | Decision rationale        |
| `triggeredRule`         | text      | Rule that triggered       |
| `bidStrategy`           | jsonb     | Recommended strategy      |
| `createdAt`             | timestamp | Decision timestamp        |

**Decision Rules:**

```typescript
// REJECT conditions
1. criticalRiskLevel = true
2. doabilityScore < 30
3. vendorRiskScore > 80

// PROCEED otherwise with strategy
- aggressive: doability ≥ 70, vendor risk ≤ 40
- balanced: doability ≥ 50, risk ≠ Critical
- conservative: all other PROCEED cases
```

**Bid Strategy Schema:**

```typescript
type BidStrategy = {
  approach: "aggressive" | "balanced" | "conservative";
  pricePositioning: "low" | "mid" | "premium";
  focusAreas: string[];
  confidenceLevel: number;
  recommendedMargin: string; // "10-13%"
};
```

---

### 🔐 Roles & Permissions Tables

#### Roles Table

**Table:** `roles`

| Column        | Type        | Description        |
| ------------- | ----------- | ------------------ |
| `id`          | serial      | Primary key        |
| `name`        | varchar(50) | Unique role name   |
| `permissions` | jsonb       | Permission array   |
| `description` | text        | Role description   |
| `createdAt`   | timestamp   | Creation timestamp |

#### User Roles Junction Table

**Table:** `user_roles`

| Column      | Type      | Description              |
| ----------- | --------- | ------------------------ |
| `id`        | serial    | Primary key              |
| `userId`    | integer   | FK to users (CASCADE)    |
| `roleId`    | integer   | FK to roles (CASCADE)    |
| `projectId` | varchar   | FK to projects (CASCADE) |
| `grantedAt` | timestamp | Grant timestamp          |

**RBAC System:**

- Base role from `users.role`
- Additional project-specific roles via `user_roles`
- Permission checks via middleware

---

## Database Relationships

### Entity Relationship Diagram (ERD)

```
┌─────────────┐
│  companies  │
└─────┬───────┘
      │ 1:N
      ├────────────────────────────────┐
      │                                │
      ▼                                ▼
┌──────────┐                    ┌───────────────────┐
│  users   │◄───────────────────┤ company_invites   │
└────┬─────┘                    └───────────────────┘
     │ 1:N
     │
     ▼
┌─────────────┐
│  sessions   │
└─────────────┘

┌──────────┐
│companies │
└────┬─────┘
     │ 1:N
     ├───────────────────┐
     ▼                   ▼
┌──────────┐      ┌─────────────────────────┐
│ projects │      │ knowledge_base_documents│
└────┬─────┘      └────┬────────────────────┘
     │ 1:N             │ 1:N
     ├──────────┐      ▼
     ▼          ▼  ┌──────────────────────────┐
┌───────────┐  │  │ knowledge_base_chunks    │
│ documents │  │  └──────────────────────────┘
└─────┬─────┘  │
      │ 1:N    │
      ▼        │
┌──────────────────┐
│ document_chunks  │
└──────────────────┘

┌──────────┐
│ projects │
└────┬─────┘
     │ 1:1
     ├──────────────┬──────────────┬──────────────┬────────────────┐
     ▼              ▼              ▼              ▼                ▼
┌───────────────┐ ┌────┐ ┌─────────────────┐ ┌────────────┐ ┌──────────────┐
│ rfp_analyses  │ │bids│ │ agent_states    │ │decision_logs│ │win_probability│
└───────┬───────┘ └────┘ └─────────────────┘ └────────────┘ └──────────────┘
        │ 1:N
        ▼
┌──────────────────┐
│ analysis_alerts  │
└──────────────────┘

┌──────────┐
│ projects │
└────┬─────┘
     │ 1:N
     ├──────────────────┬─────────────────┬──────────────────┐
     ▼                  ▼                 ▼                  ▼
┌──────────────────┐ ┌──────────┐ ┌──────────────┐ ┌──────────────┐
│document_conflicts│ │team_activity│ │project_comments│ │project_team_│
└──────────────────┘ └──────────┘ └──────────────┘ │   members    │
                                                     └──────────────┘
```

### Key Foreign Key Relationships

**CASCADE Deletions:**

- `companies` → `users`, `projects`, `templates`, `knowledge_base_documents`
- `projects` → `documents`, `bids`, `agent_states`, `conflicts`
- `documents` → `document_chunks`
- `users` → `sessions`, `user_roles`

**SET NULL Deletions:**

- `users` → `bids` (preserve bids if user deleted)
- `projects` → `audit_logs` (preserve audit trail)

---

## Indexes & Performance

### Recommended Indexes

```sql
-- Primary Keys (automatic)
-- All tables have auto-indexed primary keys

-- Foreign Keys (recommended)
CREATE INDEX idx_users_company_id ON users(company_id);
CREATE INDEX idx_projects_company_id ON projects(company_id);
CREATE INDEX idx_documents_project_id ON documents(project_id);
CREATE INDEX idx_bids_project_id ON bids(project_id);

-- Vector Search (pgvector)
CREATE INDEX idx_document_chunks_embedding ON document_chunks
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

CREATE INDEX idx_knowledge_chunks_embedding ON knowledge_base_chunks
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Composite Indexes
CREATE INDEX idx_documents_project_processed ON documents(project_id, is_processed);
CREATE INDEX idx_bids_project_latest ON bids(project_id, is_latest);
CREATE INDEX idx_conflicts_project_status ON document_conflicts(project_id, status);

-- Full-Text Search
CREATE INDEX idx_documents_content_fts ON documents USING gin(to_tsvector('english', content));

-- Timestamp Indexes (for sorting)
CREATE INDEX idx_projects_created_at ON projects(created_at DESC);
CREATE INDEX idx_bids_created_at ON bids(created_at DESC);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);
```

### Query Optimization Tips

```sql
-- Use company_id for all queries (multi-tenancy isolation)
SELECT * FROM projects WHERE company_id = $1 AND id = $2;

-- Vector search with company scoping
SELECT content, 1 - (embedding <=> $1) AS similarity
FROM document_chunks
WHERE company_id = $2
ORDER BY embedding <=> $1
LIMIT 10;

-- Hybrid search (vector + full-text)
WITH vector_results AS (
  SELECT id, content, 1 - (embedding <=> $1) AS vector_score
  FROM document_chunks WHERE company_id = $2
  ORDER BY embedding <=> $1 LIMIT 20
),
text_results AS (
  SELECT id, content, ts_rank(to_tsvector('english', content), plainto_tsquery($3)) AS text_score
  FROM document_chunks WHERE company_id = $2 AND to_tsvector('english', content) @@ plainto_tsquery($3)
  ORDER BY text_score DESC LIMIT 20
)
SELECT DISTINCT ON (id) id, content,
  (COALESCE(vector_score, 0) * 0.7 + COALESCE(text_score, 0) * 0.3) AS combined_score
FROM (
  SELECT * FROM vector_results
  UNION ALL
  SELECT * FROM text_results
) combined
ORDER BY combined_score DESC LIMIT 10;
```

---

## Data Types & Special Features

### JSONB Usage

**Advantages:**

- Schema flexibility
- Indexable (GIN indexes)
- Queryable with JSON operators
- Type-safe with Drizzle `.$type<T>()`

**Common Patterns:**

```typescript
// Type-safe JSONB
settings: jsonb("settings").$type<Record<string, any>>();
brandingProfile: jsonb("branding_profile").$type<BrandingProfile>();
sections: jsonb("sections").$type<{ title: string; content: string }[]>();

// Default values
metadata: jsonb("metadata").default(sql`'{}'::jsonb`);
permissions: jsonb("permissions").default(sql`'[]'::jsonb`);
```

### Vector Type (pgvector)

**Embedding Dimensions:** 1536 (OpenAI text-embedding-3-small)

```typescript
embedding: vector("embedding", { dimensions: 1536 });
```

**Distance Operators:**

- `<=>` : Cosine distance (0 = identical, 2 = opposite)
- `<->` : L2 distance
- `<#>` : Inner product

**Best Practices:**

- Normalize embeddings before storage
- Use HNSW or IVFFlat indexes
- Company-scoped searches for performance

### Soft Deletes

**Pattern:**

```typescript
deletedAt: timestamp("deleted_at");
```

**Query Pattern:**

```sql
-- Exclude soft-deleted records
SELECT * FROM projects WHERE deleted_at IS NULL;

-- Include soft-deleted (admin view)
SELECT * FROM projects; -- all records
```

### Auto-generated UUIDs

```typescript
id: varchar("id")
  .primaryKey()
  .default(sql`gen_random_uuid()`);
```

**Use Cases:**

- Projects (external sharing)
- Share tokens (security)

---

## Database Migrations

### Current Setup

**Tool:** Drizzle Kit
**Migration Location:** `drizzle/` directory
**Schema Source:** `shared/schema.ts`

### Migration Commands

```bash
# Generate migration from schema changes
npm run db:generate

# Push schema directly (development)
npm run db:push

# Apply migrations (production)
npm run db:migrate

# Open Drizzle Studio (database GUI)
npm run db:studio
```

### Migration Best Practices

1. **Always backup before migration**
2. **Test migrations on staging first**
3. **Use transactions for multi-step migrations**
4. **Add indexes CONCURRENTLY in production**
5. **Never drop columns with data (soft delete instead)**

---

## Security Considerations

### Multi-Tenancy Isolation

**Row-Level Security (RLS) Pattern:**

```sql
-- All queries MUST include company_id
SELECT * FROM projects WHERE company_id = current_user_company();

-- Enforced in application layer via middleware
```

### Password Storage

- ✅ Bcrypt hashing (10 rounds)
- ✅ Never store plaintext passwords
- ✅ Password reset via time-limited tokens

### Session Management

- ✅ Refresh tokens hashed before storage
- ✅ Automatic expiration
- ✅ Cascade delete on user deletion

### API Rate Limiting

- ✅ IP-based rate limiting (express-rate-limit)
- ✅ User-based rate limiting
- ✅ Logged to audit_logs

### Input Sanitization

- ✅ Zod schema validation
- ✅ SQL injection prevention (parameterized queries)
- ✅ XSS prevention (content sanitization)

---

## Backup & Recovery

### Recommended Backup Strategy

**Neon Automatic Backups:**

- Point-in-time recovery (PITR)
- 7-day retention (default)
- Cross-region replication (optional)

**Manual Backups:**

```bash
# Export full database
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql

# Restore from backup
psql $DATABASE_URL < backup_20250101.sql
```

**Critical Tables (priority backup):**

1. companies
2. users
3. projects
4. documents
5. bids
6. rfp_analyses

---

## Monitoring & Maintenance

### Database Health Checks

```sql
-- Table sizes
SELECT
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Index usage
SELECT
  schemaname, tablename, indexname,
  idx_scan as index_scans,
  idx_tup_read as tuples_read,
  idx_tup_fetch as tuples_fetched
FROM pg_stat_user_indexes
ORDER BY idx_scan ASC;

-- Slow queries (requires pg_stat_statements)
SELECT
  query,
  calls,
  total_time,
  mean_time,
  max_time
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 20;
```

### Maintenance Tasks

**Daily:**

- Monitor query performance
- Check error logs
- Verify backup completion

**Weekly:**

- Analyze slow queries
- Review index usage
- Clean expired sessions

**Monthly:**

- Vacuum analyze (Neon handles automatically)
- Review storage growth
- Archive old audit logs

---

## Performance Benchmarks

### Expected Query Times (Neon Pro)

| Query Type              | Expected Time | Notes                 |
| ----------------------- | ------------- | --------------------- |
| Primary key lookup      | <5ms          | Indexed               |
| Company-scoped list     | <20ms         | Indexed on company_id |
| Vector search (top 10)  | <50ms         | With IVFFlat index    |
| Hybrid search           | <100ms        | Vector + full-text    |
| Full-text search        | <30ms         | GIN index             |
| Complex join (5 tables) | <150ms        | Optimized             |
| RAG context retrieval   | <200ms        | 10 chunks + metadata  |

### Optimization Checklist

- ✅ Use connection pooling (Neon serverless)
- ✅ Add indexes on foreign keys
- ✅ Company-scope ALL queries
- ✅ Limit result sets (pagination)
- ✅ Use EXPLAIN ANALYZE for slow queries
- ✅ Cache frequently accessed data (Redis)
- ✅ Batch inserts when possible

---

## Future Considerations

### Scalability

**Current Capacity:**

- 10,000 companies
- 100,000 users
- 1,000,000 projects
- 10,000,000 documents

**When to Scale:**

- Vector search >100ms
- High connection count
- Storage >100GB

**Scaling Options:**

1. Neon Pro tier upgrade
2. Read replicas for analytics
3. Separate vector database (Pinecone/Weaviate)
4. Horizontal sharding by company_id

### Potential Optimizations

1. **Materialized Views**
   - Company statistics
   - Win rate aggregates
   - Popular search queries

2. **Partitioning**
   - Partition audit_logs by date
   - Partition projects by status

3. **Archival Strategy**
   - Move old projects to archive table
   - Compress old documents

---

## Appendix: Table Count Summary

**Total Tables:** 33

### By Category

| Category           | Tables                                                                                      | Count |
| ------------------ | ------------------------------------------------------------------------------------------- | ----- |
| **Multi-Tenancy**  | companies, users, sessions, company_invites                                                 | 4     |
| **Core Business**  | projects, documents, templates, bids                                                        | 4     |
| **RAG & AI**       | document_chunks, knowledge_base_documents, knowledge_base_chunks, ai_instructions           | 4     |
| **Analysis**       | rfp_analyses, analysis_alerts, document_conflicts, conflict_detection_runs, vendor_database | 5     |
| **Win Prediction** | win_probability_predictions, bid_outcomes, project_features                                 | 3     |
| **Enterprise**     | project_team_members, user_presence, audit_logs, team_activity, project_comments            | 5     |
| **RBAC**           | roles, user_roles                                                                           | 2     |
| **Agent System**   | agent_executions, agent_states, decision_logs                                               | 3     |

**Total Columns:** ~350
**Total Indexes:** ~50 (estimated)
**Total Foreign Keys:** ~45

---

## Contact & Support

**Database Issues:** Check Neon dashboard
**Schema Questions:** See `shared/schema.ts`
**Migration Help:** See Drizzle documentation

**Last Schema Update:** December 11, 2025
