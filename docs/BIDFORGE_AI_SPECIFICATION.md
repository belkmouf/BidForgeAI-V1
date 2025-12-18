# BidForge AI - Complete Technical Specification

## Executive Summary

BidForge AI is a construction bidding automation platform that streamlines proposal generation for construction companies. It ingests RFQ/RFP documents, uses AI-powered analysis with RAG (Retrieval-Augmented Generation), and generates professional HTML bid responses with iterative refinement capabilities.

---

## 1. System Architecture

### 1.1 Technology Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, TypeScript, Vite, Wouter (routing), TanStack Query |
| UI Framework | Shadcn UI (New York style), Radix UI, Tailwind CSS v4 |
| Backend | Node.js, Express.js, TypeScript |
| Database | PostgreSQL with pgvector extension (Neon serverless) |
| ORM | Drizzle ORM |
| AI Providers | OpenAI (GPT-4o), Anthropic (Claude Sonnet 4), Google Gemini, DeepSeek, Grok |
| Embeddings | OpenAI text-embedding-3-small (1536 dimensions) |
| File Processing | pdf-parse, mammoth (docx), xlsx, Pillow (Python) |
| Authentication | JWT (access + refresh tokens), bcrypt |

### 1.2 Directory Structure

```
/
├── client/
│   ├── src/
│   │   ├── components/
│   │   │   ├── ui/           # Shadcn UI components
│   │   │   ├── agents/       # Agent progress panel
│   │   │   ├── ai/           # Generate/Refine panels
│   │   │   ├── bid/          # Bid preview/history
│   │   │   ├── documents/    # Document summary components
│   │   │   ├── editor/       # Tiptap rich text editor
│   │   │   ├── layout/       # App sidebar
│   │   │   ├── onboarding/   # Company setup wizard
│   │   │   ├── upload/       # DropZone file upload
│   │   │   └── workflow/     # Project workflow layout
│   │   ├── hooks/            # Custom React hooks
│   │   ├── lib/              # API client, utilities
│   │   └── pages/            # Route pages
│   └── index.html
├── server/
│   ├── agents/               # Multi-shot AI agent system
│   ├── lib/                  # Business logic, AI integrations
│   ├── middleware/           # Auth, RBAC, versioning
│   ├── routes/               # API route handlers
│   └── config/               # Environment config
├── shared/
│   └── schema.ts             # Drizzle schema, Zod validation
├── sketch-agent/             # Python vision AI agent
│   └── agents/               # Sketch analysis agents
└── uploads/                  # File storage
```

---

## 2. Database Schema

### 2.1 Multi-Tenancy Tables

```sql
-- Companies (multi-tenant root)
CREATE TABLE companies (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) NOT NULL UNIQUE,
  logo TEXT,
  settings JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP
);

-- Users (company-scoped)
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  role TEXT DEFAULT 'company_user',  -- system_admin, system_user, company_admin, company_user
  is_active BOOLEAN DEFAULT true,
  onboarding_status VARCHAR(20) DEFAULT 'pending',
  branding_profile JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  last_login_at TIMESTAMP,
  deleted_at TIMESTAMP
);

-- Sessions (refresh tokens)
CREATE TABLE sessions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Company Invitations
CREATE TABLE company_invites (
  id SERIAL PRIMARY KEY,
  company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  role TEXT DEFAULT 'company_user',
  invite_code VARCHAR(64) NOT NULL UNIQUE,
  invited_by INTEGER REFERENCES users(id),
  status TEXT DEFAULT 'pending',  -- pending, accepted, expired, revoked
  expires_at TIMESTAMP NOT NULL,
  accepted_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### 2.2 Project & Document Tables

```sql
-- Projects
CREATE TABLE projects (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  client_name TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'Active',  -- Active, Submitted, Closed-Won, Closed-Lost
  workflow_status VARCHAR(50) DEFAULT 'uploading',
  is_archived BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP
);

-- Documents
CREATE TABLE documents (
  id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  project_id VARCHAR REFERENCES projects(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  original_filename TEXT,
  description TEXT,
  content TEXT,
  is_processed BOOLEAN DEFAULT false,
  uploaded_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP,
  version INTEGER DEFAULT 1,
  group_id VARCHAR(255)
);

-- Document Chunks (for RAG with pgvector)
CREATE TABLE document_chunks (
  id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  document_id INTEGER REFERENCES documents(id) ON DELETE CASCADE,
  company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  embedding VECTOR(1536),
  chunk_index INTEGER NOT NULL,
  source_type VARCHAR(20) DEFAULT 'original'  -- original, summary
);

-- Document Summaries (AI-generated)
CREATE TABLE document_summaries (
  id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  document_id INTEGER UNIQUE REFERENCES documents(id) ON DELETE CASCADE,
  project_id VARCHAR REFERENCES projects(id) ON DELETE CASCADE,
  summary_content TEXT NOT NULL,
  structured_data JSONB DEFAULT '{}',
  is_user_edited BOOLEAN DEFAULT false,
  extraction_confidence REAL,
  processing_time_ms INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Project Summaries (consolidated view)
CREATE TABLE project_summaries (
  id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  project_id VARCHAR UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
  overview TEXT,
  scope_of_work JSONB,
  key_requirements JSONB,
  risk_factors JSONB,
  opportunities JSONB,
  missing_information JSONB,
  coverage_score INTEGER DEFAULT 0,
  completeness_score INTEGER DEFAULT 0,
  is_user_edited BOOLEAN DEFAULT false,
  generated_at TIMESTAMP DEFAULT NOW()
);
```

### 2.3 Bid Generation Tables

```sql
-- Generated Bids
CREATE TABLE bids (
  id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  project_id VARCHAR REFERENCES projects(id) ON DELETE CASCADE,
  company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  raw_content TEXT,
  instructions TEXT,
  tone TEXT DEFAULT 'professional',
  model TEXT NOT NULL,
  search_method TEXT NOT NULL,
  chunks_used INTEGER DEFAULT 0,
  version INTEGER DEFAULT 1,
  is_latest BOOLEAN DEFAULT true,
  share_token VARCHAR(64) UNIQUE,
  lmm_cost REAL DEFAULT 0,
  generation_time_seconds INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP
);

-- Knowledge Base Documents (company-scoped for RAG)
CREATE TABLE knowledge_base_documents (
  id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  original_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  content TEXT,
  is_processed BOOLEAN DEFAULT false,
  chunk_count INTEGER DEFAULT 0,
  uploaded_at TIMESTAMP DEFAULT NOW()
);

-- Knowledge Base Chunks
CREATE TABLE knowledge_base_chunks (
  id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  document_id INTEGER REFERENCES knowledge_base_documents(id) ON DELETE CASCADE,
  company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  embedding VECTOR(1536),
  chunk_index INTEGER NOT NULL
);
```

### 2.4 Analysis & Conflict Detection Tables

```sql
-- RFP Analysis
CREATE TABLE rfp_analyses (
  id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  project_id VARCHAR REFERENCES projects(id) ON DELETE CASCADE,
  quality_score REAL,
  doability_score REAL,
  clarity_score REAL,
  vendor_risk_score REAL,
  overall_risk_level TEXT,
  missing_documents JSONB DEFAULT '[]',
  unclear_requirements JSONB DEFAULT '[]',
  red_flags JSONB DEFAULT '[]',
  opportunities JSONB DEFAULT '[]',
  recommendations JSONB DEFAULT '[]',
  vendor_name TEXT,
  vendor_payment_rating TEXT,
  payment_history JSONB,
  industry_reputation JSONB,
  analyzed_at TIMESTAMP DEFAULT NOW()
);

-- Document Conflicts
CREATE TABLE document_conflicts (
  id SERIAL PRIMARY KEY,
  project_id VARCHAR REFERENCES projects(id) ON DELETE CASCADE,
  conflict_type TEXT NOT NULL,  -- semantic, numeric, temporal, scope
  severity TEXT DEFAULT 'medium',  -- low, medium, high, critical
  status TEXT DEFAULT 'detected',  -- detected, reviewing, resolved, dismissed
  source_document_id INTEGER REFERENCES documents(id),
  source_text TEXT NOT NULL,
  source_location JSONB,
  target_document_id INTEGER REFERENCES documents(id),
  target_text TEXT NOT NULL,
  target_location JSONB,
  description TEXT NOT NULL,
  suggested_resolution TEXT,
  confidence_score REAL,
  semantic_similarity REAL,
  resolved_by INTEGER REFERENCES users(id),
  resolved_at TIMESTAMP,
  resolution TEXT,
  detected_at TIMESTAMP DEFAULT NOW()
);

-- Conflict Detection Runs
CREATE TABLE conflict_detection_runs (
  id SERIAL PRIMARY KEY,
  project_id VARCHAR REFERENCES projects(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'running',
  started_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  total_conflicts INTEGER DEFAULT 0,
  semantic_conflicts INTEGER DEFAULT 0,
  numeric_conflicts INTEGER DEFAULT 0,
  temporal_conflicts INTEGER DEFAULT 0
);
```

### 2.5 Agent Execution Tables

```sql
-- Agent Executions (workflow tracking)
CREATE TABLE agent_executions (
  id SERIAL PRIMARY KEY,
  project_id VARCHAR REFERENCES projects(id) ON DELETE CASCADE,
  agent_name VARCHAR(100) NOT NULL,
  status VARCHAR(50) NOT NULL,
  input JSONB,
  output JSONB,
  error TEXT,
  started_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  duration_ms INTEGER
);

-- Agent States (workflow state persistence)
CREATE TABLE agent_states (
  id SERIAL PRIMARY KEY,
  project_id VARCHAR UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
  current_agent VARCHAR(100) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending',
  state JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

---

## 3. Workflow Pipeline

### 3.1 9-State Pipeline

The system implements a sequential, state-driven workflow:

```
uploading → summarizing → summary_review → analyzing → analysis_review → conflict_check → generating → review → completed
```

| State | Description | User Action Required |
|-------|-------------|---------------------|
| `uploading` | Document upload phase | Upload RFP documents |
| `summarizing` | AI processing documents | Wait for processing |
| `summary_review` | Review AI summaries | Edit/Accept summaries |
| `analyzing` | RFP analysis in progress | Wait for analysis |
| `analysis_review` | Review risk assessment | Acknowledge risks |
| `conflict_check` | Detecting conflicts | Review conflicts |
| `generating` | Bid generation | Wait for generation |
| `review` | Final bid review | Edit/Approve bid |
| `completed` | Workflow complete | Export/Submit bid |

### 3.2 State Transitions

```typescript
const WORKFLOW_TRANSITIONS = {
  uploading: ['summarizing'],
  summarizing: ['summary_review'],
  summary_review: ['analyzing'],
  analyzing: ['analysis_review'],
  analysis_review: ['conflict_check'],
  conflict_check: ['generating'],
  generating: ['review'],
  review: ['completed'],
  completed: []
};
```

---

## 4. Multi-Shot AI Agent System

### 4.1 Agent Architecture

The system uses an iterative refinement architecture orchestrated by Anthropic Claude:

```
┌─────────────────────────────────────────────────────────────┐
│                   Master Orchestrator                        │
│  (Anthropic Claude Sonnet 4 - evaluates & coordinates)      │
└─────────────────────────────────────────────────────────────┘
                              │
    ┌─────────────────────────┼─────────────────────────┐
    ▼                         ▼                         ▼
┌─────────┐             ┌─────────┐              ┌─────────┐
│ Intake  │     →       │ Sketch  │      →       │Analysis │
│ Agent   │             │ Agent   │              │ Agent   │
└─────────┘             └─────────┘              └─────────┘
                              │
    ┌─────────────────────────┼─────────────────────────┐
    ▼                         ▼                         ▼
┌─────────┐             ┌─────────┐              ┌─────────┐
│Decision │     →       │Generate │      →       │ Review  │
│ Agent   │             │ Agent   │              │ Agent   │
└─────────┘             └─────────┘              └─────────┘
```

### 4.2 Agent Specifications

| Agent | Purpose | Model |
|-------|---------|-------|
| IntakeAgent | Parse and validate RFP documents | GPT-4o |
| SketchAgent | Analyze construction drawings (Python/Vision) | Gemini Vision |
| AnalysisAgent | Risk assessment and requirement extraction | Claude Sonnet |
| DecisionAgent | Bid/no-bid recommendation | Claude Sonnet |
| GenerationAgent | Generate bid content | User-selected |
| ReviewAgent | Quality check and refinement | Claude Sonnet |

### 4.3 Multi-Shot Refinement

Each agent can iterate up to 3 times until output meets acceptance threshold (75/100):

```typescript
interface OrchestratorEvaluation {
  accepted: boolean;
  score: number;          // 0-100
  reasoning: string;
  improvements: string[];
  criticalIssues: string[];
}

class MasterOrchestrator {
  maxIterationsPerAgent: number = 3;
  acceptanceThreshold: number = 75;
  
  async runAgent(agent, context, iteration) {
    const output = await agent.execute(context);
    const evaluation = await this.evaluate(output);
    
    if (evaluation.score >= this.acceptanceThreshold || iteration >= this.maxIterationsPerAgent) {
      return output;
    }
    
    // Request refinement with feedback
    return this.runAgent(agent, {
      ...context,
      feedback: evaluation
    }, iteration + 1);
  }
}
```

### 4.4 Progress Streaming

Real-time progress via Server-Sent Events (SSE):

```typescript
// Endpoint: GET /api/agent-progress/progress/:projectId
interface ProgressEvent {
  type: 'agent_start' | 'agent_output' | 'evaluation' | 'refinement_request' | 'agent_complete' | 'workflow_complete' | 'error';
  agentName: string;
  iteration: number;
  message: string;
  data?: unknown;
  timestamp: Date;
}
```

---

## 5. RAG Implementation

### 5.1 Document Ingestion Pipeline

```
Upload → Extract Text → Chunk (RecursiveCharacterTextSplitter) → Generate Embeddings → Store in pgvector
```

**Chunking Parameters:**
- Chunk size: 1000 characters
- Chunk overlap: 200 characters
- Separators: ["\n\n", "\n", " ", ""]

### 5.2 Hybrid Search

Combines vector similarity + full-text search:

```sql
-- Vector similarity search
SELECT content, 
       1 - (embedding <=> $1) as similarity
FROM document_chunks
WHERE company_id = $2
ORDER BY embedding <=> $1
LIMIT 10;

-- Full-text search augmentation
SELECT content,
       ts_rank(to_tsvector('english', content), plainto_tsquery('english', $1)) as rank
FROM document_chunks
WHERE to_tsvector('english', content) @@ plainto_tsquery('english', $1);
```

### 5.3 Context Sources

1. **Current Project Documents** - RFP/RFQ being bid on
2. **Historical "Closed-Won" Projects** - Successful past bids
3. **Company Knowledge Base** - Templates, standards, pricing

---

## 6. Authentication & Authorization

### 6.1 JWT Authentication

```typescript
// Access Token (15 min expiry)
interface AccessTokenPayload {
  userId: number;
  email: string;
  companyId: number;
  role: UserRole;
}

// Refresh Token (7 day expiry, stored in DB)
interface RefreshTokenPayload {
  userId: number;
  sessionId: number;
}
```

### 6.2 Role-Based Access Control (RBAC)

| Role | Scope | Permissions |
|------|-------|-------------|
| system_admin | All companies | Full platform access |
| system_user | All companies | Read access across platform |
| company_admin | Own company | Full company access, team management |
| company_user | Own company | Project CRUD, bid generation |

---

## 7. API Endpoints

### 7.1 Authentication

```
POST /api/auth/register          - Create account + company
POST /api/auth/login             - Login, get tokens
POST /api/auth/refresh           - Refresh access token
POST /api/auth/logout            - Invalidate session
GET  /api/auth/me                - Get current user
```

### 7.2 Projects

```
GET    /api/projects             - List projects (company-scoped)
POST   /api/projects             - Create project
GET    /api/projects/:id         - Get project details
PUT    /api/projects/:id         - Update project
DELETE /api/projects/:id         - Soft delete project
PUT    /api/projects/:id/workflow-status - Update workflow state
```

### 7.3 Documents

```
GET    /api/projects/:id/documents      - List documents
POST   /api/projects/:id/documents      - Upload document(s)
DELETE /api/documents/:id               - Delete document
GET    /api/documents/:id/summary       - Get document summary
PUT    /api/documents/:id/summary       - Update summary
POST   /api/documents/:id/regenerate-summary - Regenerate with AI
```

### 7.4 Bid Generation

```
POST /api/projects/:id/generate-bid     - Generate bid (single model)
POST /api/projects/:id/generate-multi   - Generate with multiple models
POST /api/projects/:id/refine-bid       - Refine existing bid
GET  /api/projects/:id/bids             - Get bid history
GET  /api/bids/:id                      - Get specific bid
GET  /api/bids/share/:token             - Public bid view
```

### 7.5 Analysis

```
POST /api/projects/:id/analyze          - Run RFP analysis
GET  /api/projects/:id/analysis         - Get analysis results
POST /api/conflicts/:id/detect          - Run conflict detection
GET  /api/conflicts/:id                 - Get conflicts
PUT  /api/conflicts/:id/resolve         - Resolve conflict
```

### 7.6 Agents

```
POST /api/agents/:projectId/start       - Start agent workflow
GET  /api/agent-progress/progress/:id   - SSE progress stream
GET  /api/agent-progress/state/:id      - Get current state
```

### 7.7 Team Management

```
GET  /api/team                          - List team members
POST /api/team/invite                   - Send invitation
GET  /api/team/invites                  - List pending invites
DELETE /api/team/invites/:id            - Revoke invite
POST /api/invite/:code/accept           - Accept invitation
PUT  /api/team/:userId/role             - Change user role
PUT  /api/team/:userId/status           - Activate/deactivate
```

---

## 8. Frontend Pages

### 8.1 Page Structure

| Route | Page | Description |
|-------|------|-------------|
| `/` | Landing | Marketing landing page |
| `/login` | Login | Authentication form |
| `/register` | Register | Account creation |
| `/setup/branding` | OnboardingWizard | Company branding setup |
| `/dashboard` | Dashboard | Overview with metrics |
| `/projects` | ProjectsList | All projects list |
| `/projects/new` | NewProject | Create new project |
| `/projects/:id` | ProjectWorkspace | Bid generation workspace |
| `/projects/:id/documents` | DocumentSummary | Document upload & summaries |
| `/projects/:id/analysis` | ProjectAnalysis | RFP analysis view |
| `/projects/:id/conflicts` | ProjectConflicts | Conflict review |
| `/settings` | Settings | User/company settings |
| `/templates` | Templates | Bid templates management |
| `/analytics` | Analytics | Performance metrics |
| `/admin` | Admin | System administration |

### 8.2 Key Components

**ProjectWorkflowLayout** - Stepper navigation for 4-step workflow:
1. Documents - Upload and verify
2. RFP Analysis - AI analysis review
3. Conflicts - Review conflicts
4. Bid Generation - Generate and refine

**GeneratePanel** - Multi-model AI selection with:
- Model checkboxes (Anthropic, OpenAI, Gemini, DeepSeek, Grok)
- Instructions textarea
- Tone selector
- Generate button with progress

**AgentProgressPanel** - Real-time agent execution display:
- Current agent indicator
- Iteration count
- Evaluation scores
- Refinement feedback

**TiptapEditor** - Rich text bid editing with:
- Formatting toolbar
- Table support
- Placeholder extension

---

## 9. Python Sketch Agent

### 9.1 Purpose

Analyzes construction drawings/sketches using vision AI before document summarization.

### 9.2 Integration

```typescript
// server/lib/pythonSketchClient.ts
async function analyzeSketch(imagePath: string, context?: string): Promise<SketchAnalysisResult> {
  return new Promise((resolve, reject) => {
    const python = spawn('python', ['sketch-agent/main_standalone.py', imagePath, context || '']);
    // Parse JSON output from stdout
  });
}
```

### 9.3 Output Format

```json
{
  "success": true,
  "result": {
    "drawing_type": "floor_plan",
    "scale": "1:100",
    "dimensions": {...},
    "rooms": [...],
    "features": [...],
    "materials": [...],
    "notes": [...]
  }
}
```

---

## 10. File Processing

### 10.1 Supported Formats

| Format | Library | Processing |
|--------|---------|------------|
| PDF | pdf-parse | Extract text content |
| DOCX | mammoth | Extract raw text |
| XLSX/CSV | xlsx | Parse sheets to text |
| TXT | native | Direct read |
| Images | Python Pillow + Vision AI | OCR + analysis |

### 10.2 Image Processing Flow

```
Upload Image → Save to uploads/images/ → Python Sketch Agent → Create Summary → Create RAG Chunks
```

---

## 11. Design System

### 11.1 Color Palette (Somerstone-inspired)

```css
:root {
  --charcoal: #2C3E50;      /* Primary text */
  --deep-teal: #1A5F5F;     /* Primary brand */
  --antique-gold: #C9A227;  /* Accent */
  --cream: #FAF8F5;         /* Background */
  --stone: #E8E4DE;         /* Secondary background */
}
```

### 11.2 Typography

| Element | Font | Weight |
|---------|------|--------|
| Headings | Syne | 600-700 |
| Body | Inter | 400-500 |
| Accents | Fraunces | 400 |

### 11.3 Component Library

Uses Shadcn UI (New York style) with customizations:
- Cards with subtle shadows
- Buttons with hover transitions
- Form inputs with clear focus states
- Toast notifications via Sonner

---

## 12. Security Measures

### 12.1 Backend Security

- **Helmet.js** - Security headers
- **Rate Limiting** - 100 requests/15 min per IP
- **CORS** - Configured allowed origins
- **Input Sanitization** - Zod validation on all inputs
- **SQL Injection** - Parameterized queries via Drizzle

### 12.2 Authentication Security

- Password hashing with bcrypt (12 rounds)
- JWT secret rotation support
- Refresh token stored hashed in DB
- Session invalidation on logout

### 12.3 Data Isolation

All queries scoped by `companyId` to ensure multi-tenant data isolation.

---

## 13. Environment Variables

```bash
# Database
DATABASE_URL=postgresql://...

# JWT
JWT_SECRET=...
JWT_REFRESH_SECRET=...

# AI Providers
OPENAI_API_KEY=...
ANTHROPIC_API_KEY=...
GOOGLE_GENERATIVE_AI_API_KEY=...
DEEPSEEK_API_KEY=...
XAI_API_KEY=...

# Optional
WHATSAPP_ACCESS_TOKEN=...
WHATSAPP_PHONE_NUMBER_ID=...
```

---

## 14. Deployment

### 14.1 Build Commands

```bash
# Development
npm run dev

# Production Build
npm run build

# Database Migrations
npx drizzle-kit push
```

### 14.2 Server Configuration

- Frontend binds to `0.0.0.0:5000`
- API served from same origin under `/api`
- Static files served from `dist/public`

---

## 15. Testing Strategy

### 15.1 Test Types

- **Unit Tests** - Jest for business logic
- **Integration Tests** - Supertest for API endpoints
- **E2E Tests** - Playwright for UI flows
- **Component Tests** - React Testing Library

### 15.2 Key Test Files

```
server/__tests__/auth.test.ts
server/lib/__tests__/auth.test.ts
client/src/components/ui/__tests__/button.test.tsx
```

---

## 16. Implementation Order

### Phase 1: Foundation
1. Set up project structure (Vite + Express)
2. Configure PostgreSQL with pgvector
3. Implement Drizzle schema
4. Build authentication system

### Phase 2: Core Features
5. Document upload and processing
6. RAG implementation (chunking + embeddings)
7. Single-model bid generation
8. Basic UI pages

### Phase 3: Advanced Features
9. Multi-shot agent system
10. Conflict detection
11. RFP analysis
12. Multi-model comparison

### Phase 4: Polish
13. Team management
14. Company branding
15. Analytics dashboard
16. Template system

---

## 17. Key Implementation Notes

### 17.1 Critical Patterns

1. **Company Scoping** - Every query must filter by `companyId`
2. **Workflow Gating** - Validate state transitions server-side
3. **Optimistic Updates** - Use TanStack Query for responsive UI
4. **SSE for Progress** - Stream agent progress in real-time
5. **Atomic Bid Creation** - Use transactions for version management

### 17.2 Common Pitfalls

1. Don't use virtual environments (Nix environment)
2. Always bind frontend to port 5000
3. Use `text().array()` not `array(text())` in Drizzle
4. Include `data-testid` on all interactive elements
5. Handle image files through Python agent, not Node.js

---

This specification provides a complete blueprint for recreating BidForge AI from scratch.
