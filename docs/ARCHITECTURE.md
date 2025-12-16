# BidForge AI - Architecture Design Document

## Executive Summary

BidForge AI is an enterprise-grade construction bidding automation platform that transforms company collective intelligence into persuasive, compliant, and winning bids. The system positions itself as "The Forge of Winning Proposals" - an AI-powered solution that acts as an "Iron Man Suit" for revenue teams.

---

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              BidForge AI Platform                           │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐   ┌─────────────────┐   ┌─────────────────────────┐   │
│  │   React SPA     │   │  Express API    │   │  PostgreSQL + pgvector  │   │
│  │   (Frontend)    │◄──►  (Backend)      │◄──►  (Database)             │   │
│  └─────────────────┘   └─────────────────┘   └─────────────────────────┘   │
│          │                     │                        │                   │
│          │                     ▼                        │                   │
│          │            ┌─────────────────┐               │                   │
│          │            │   AI Services   │               │                   │
│          │            │ ┌─────────────┐ │               │                   │
│          │            │ │   OpenAI    │ │               │                   │
│          │            │ │  Anthropic  │ │               │                   │
│          │            │ │   Gemini    │ │               │                   │
│          │            │ │  DeepSeek   │ │               │                   │
│          │            │ └─────────────┘ │               │                   │
│          │            └─────────────────┘               │                   │
└──────────┼──────────────────────────────────────────────┼───────────────────┘
           │                                              │
           ▼                                              ▼
    ┌─────────────┐                              ┌─────────────────┐
    │   Browser   │                              │  Vector Search  │
    │    Client   │                              │   (RAG Engine)  │
    └─────────────┘                              └─────────────────┘
```

---

## Technology Stack

### Frontend Layer

| Component | Technology | Purpose |
|-----------|------------|---------|
| Framework | React 18 + TypeScript | Component-based UI development |
| Build Tool | Vite | Fast development and production builds |
| Routing | Wouter | Lightweight client-side routing |
| State Management | TanStack Query + Zustand | Server state caching and client state |
| UI Components | Shadcn UI (New York) + Radix UI | Accessible, composable components |
| Styling | Tailwind CSS v4 | Utility-first CSS framework |
| Animations | GSAP | High-performance animations |
| Rich Text Editor | Tiptap | Extensible rich text editing |
| Charts | Recharts | Data visualization |

### Backend Layer

| Component | Technology | Purpose |
|-----------|------------|---------|
| Runtime | Node.js | JavaScript runtime |
| Framework | Express.js + TypeScript | RESTful API server |
| ORM | Drizzle ORM | Type-safe database queries |
| Validation | Zod + drizzle-zod | Schema validation |
| File Uploads | Multer | Multipart form handling |
| Authentication | JWT + bcrypt | Secure token-based auth |
| Security | Helmet.js + CORS + Rate Limiting | API protection |

### Database Layer

| Component | Technology | Purpose |
|-----------|------------|---------|
| Database | Neon PostgreSQL (Serverless) | Primary data storage |
| Vector Extension | pgvector | Semantic similarity search |
| Schema Management | Drizzle Kit | Database migrations |

### AI/ML Services

| Provider | Models | Use Case |
|----------|--------|----------|
| OpenAI | GPT-4o, text-embedding-3-small | Bid generation, embeddings |
| Anthropic | Claude Sonnet 4.5 | Alternative bid generation |
| Google | Gemini 2.5 Flash | Fast bid generation |
| DeepSeek | DeepSeek Chat | Cost-effective generation |

---

## Core Architecture Patterns

### 1. Retrieval-Augmented Generation (RAG)

The RAG system enhances AI-generated bids with context from historical winning projects:

```
┌──────────────────────────────────────────────────────────────────┐
│                        RAG Pipeline                              │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────┐    ┌───────────────┐    ┌────────────────────┐    │
│  │ Document │───►│ Text Chunking │───►│ Embedding Creation │    │
│  │  Upload  │    │ (LangChain)   │    │ (OpenAI)           │    │
│  └──────────┘    └───────────────┘    └────────────────────┘    │
│                                                 │                │
│                                                 ▼                │
│                                        ┌───────────────┐         │
│                                        │ Vector Store  │         │
│                                        │ (pgvector)    │         │
│                                        └───────────────┘         │
│                                                 │                │
│  ┌──────────┐    ┌───────────────┐              │                │
│  │  Query   │───►│ Hybrid Search │◄─────────────┘                │
│  │ (RFQ)    │    │ Vector + FTS  │                               │
│  └──────────┘    └───────────────┘                               │
│                          │                                       │
│                          ▼                                       │
│                  ┌───────────────┐    ┌─────────────────┐        │
│                  │   Context     │───►│ LLM Generation  │        │
│                  │   Assembly    │    │ (Multi-Model)   │        │
│                  └───────────────┘    └─────────────────┘        │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

**Key Components:**
- **Text Chunking**: LangChain's `RecursiveCharacterTextSplitter` with 1500 token chunks and 200 token overlap
- **Embeddings**: OpenAI's `text-embedding-3-small` (1536 dimensions)
- **Hybrid Search**: Combines vector similarity (cosine) with PostgreSQL full-text search
- **Context Sources**: Current project documents + "Closed-Won" historical projects

### 2. Multi-Agent AI Pipeline

The system uses LangChain/LangGraph for orchestrated workflow processing:

```
┌─────────────────────────────────────────────────────────────────┐
│                    AI Agent Pipeline                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌────────────┐    ┌────────────┐    ┌────────────┐            │
│  │  INTAKE    │───►│  ANALYSIS  │───►│  DECISION  │            │
│  │   Agent    │    │   Agent    │    │   Agent    │            │
│  └────────────┘    └────────────┘    └────────────┘            │
│        │                                    │                   │
│        │                    ┌───────────────┴───────────────┐   │
│        │                    │                               │   │
│        │                    ▼                               ▼   │
│        │           ┌────────────────┐             ┌──────────┐ │
│        │           │  GENERATION   │             │  ABORT   │  │
│        │           │    Agent      │             │ (High    │  │
│        │           └────────────────┘             │  Risk)   │  │
│        │                    │                     └──────────┘  │
│        │                    ▼                                   │
│        │           ┌────────────────┐                          │
│        │           │    REVIEW     │                           │
│        │           │    Agent      │                           │
│        │           └────────────────┘                          │
│        │                    │                                   │
│        ▼                    ▼                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    State Graph                           │  │
│  │  - Conditional Routing based on risk assessment          │  │
│  │  - Automatic retries with exponential backoff            │  │
│  │  - Human-in-the-loop checkpoints                         │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Agent Responsibilities:**
- **Intake Agent**: Document parsing, metadata extraction, initial classification
- **Analysis Agent**: RFP scoring (Quality, Clarity, Doability, Risk), gap detection
- **Decision Agent**: Go/no-go recommendation, risk-based routing
- **Generation Agent**: Multi-model bid content creation
- **Review Agent**: Quality assurance, compliance checking

### 3. Role-Based Access Control (RBAC)

```
┌─────────────────────────────────────────────────────────────────┐
│                    Authorization Model                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                     User Hierarchy                       │   │
│  ├─────────────────────────────────────────────────────────┤   │
│  │                                                         │   │
│  │   system_admin ──► Full platform access                 │   │
│  │        │                                                │   │
│  │        ▼                                                │   │
│  │   company_admin ──► Company-wide management             │   │
│  │        │                                                │   │
│  │        ▼                                                │   │
│  │     manager ──► Project & team oversight                │   │
│  │        │                                                │   │
│  │        ▼                                                │   │
│  │      user ──► Standard project access                   │   │
│  │        │                                                │   │
│  │        ▼                                                │   │
│  │     viewer ──► Read-only access                         │   │
│  │                                                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                   Data Isolation                         │   │
│  ├─────────────────────────────────────────────────────────┤   │
│  │  • Company-scoped queries via companyId filter          │   │
│  │  • JWT tokens contain role and company context          │   │
│  │  • Middleware enforces access at API level              │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Database Schema

### Entity Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Database Schema                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────┐       ┌──────────────┐       ┌──────────────────────┐    │
│  │  companies   │       │    users     │       │      sessions        │    │
│  ├──────────────┤       ├──────────────┤       ├──────────────────────┤    │
│  │ id (PK)      │◄──┬───│ companyId    │       │ id (PK)              │    │
│  │ name         │   │   │ id (PK)      │◄──────│ userId (FK)          │    │
│  │ createdAt    │   │   │ email        │       │ refreshToken         │    │
│  └──────────────┘   │   │ password     │       │ expiresAt            │    │
│                     │   │ role         │       └──────────────────────┘    │
│                     │   │ branding     │                                   │
│                     │   └──────────────┘                                   │
│                     │          │                                           │
│                     │          ▼                                           │
│  ┌──────────────┐   │   ┌──────────────┐       ┌──────────────────────┐    │
│  │  projects    │───┘   │  invitations │       │     documents        │    │
│  ├──────────────┤       ├──────────────┤       ├──────────────────────┤    │
│  │ id (PK/UUID) │       │ id (PK)      │       │ id (PK)              │    │
│  │ companyId    │       │ companyId    │       │ projectId (FK)       │    │
│  │ name         │       │ email        │       │ filename             │    │
│  │ clientName   │       │ role         │       │ content              │    │
│  │ status       │       │ code         │       │ uploadedAt           │    │
│  │ isArchived   │       │ status       │       └──────────────────────┘    │
│  │ metadata     │       │ expiresAt    │                │                  │
│  └──────────────┘       └──────────────┘                ▼                  │
│         │                                       ┌──────────────────────┐    │
│         │                                       │   document_chunks    │    │
│         │                                       ├──────────────────────┤    │
│         │                                       │ id (PK)              │    │
│         │                                       │ documentId (FK)      │    │
│         │                                       │ content              │    │
│         │                                       │ embedding (vector)   │    │
│         │                                       │ chunkIndex           │    │
│         │                                       └──────────────────────┘    │
│         │                                                                   │
│         ▼                                                                   │
│  ┌──────────────┐       ┌──────────────┐       ┌──────────────────────┐    │
│  │    bids      │       │ rfp_analyses │       │ win_probability      │    │
│  ├──────────────┤       ├──────────────┤       ├──────────────────────┤    │
│  │ id (PK)      │       │ id (PK)      │       │ id (PK)              │    │
│  │ projectId    │       │ projectId    │       │ projectId (FK)       │    │
│  │ companyId    │       │ scores       │       │ probability          │    │
│  │ userId       │       │ riskLevel    │       │ confidence           │    │
│  │ content      │       │ alerts       │       │ features             │    │
│  │ version      │       │ createdAt    │       │ recommendations      │    │
│  │ isLatest     │       └──────────────┘       └──────────────────────┘    │
│  │ model        │                                                          │
│  └──────────────┘                                                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Key Tables

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `companies` | Multi-tenant company data | id, name, createdAt |
| `users` | User accounts with branding | email, password, role, branding (JSONB) |
| `projects` | Bid projects | id (UUID), name, clientName, status, metadata |
| `documents` | Uploaded RFQ documents | filename, content, mimeType |
| `document_chunks` | Chunked text with vectors | content, embedding (1536-dim vector) |
| `bids` | Generated bid responses | content (HTML), version, model, isLatest |
| `rfp_analyses` | RFP risk assessments | scores, riskLevel, recommendations |
| `win_probability_predictions` | ML predictions | probability, confidence, features |

---

## API Architecture

### RESTful Endpoints

```
/api
├── /auth
│   ├── POST /register          # New user + company registration
│   ├── POST /login             # User authentication
│   ├── POST /logout            # Session termination
│   └── POST /refresh           # Token refresh
│
├── /projects
│   ├── GET    /                # List company projects
│   ├── POST   /                # Create new project
│   ├── GET    /:id             # Get project details
│   ├── PATCH  /:id/status      # Update project status
│   ├── PATCH  /:id/archive     # Archive project
│   ├── PATCH  /:id/unarchive   # Unarchive project
│   └── DELETE /:id             # Delete project (admin only)
│
├── /documents
│   ├── POST   /:projectId      # Upload document
│   ├── GET    /project/:id     # List project documents
│   └── DELETE /:id             # Delete document
│
├── /bids
│   ├── POST   /generate        # Generate new bid
│   ├── POST   /refine          # Refine existing bid
│   ├── GET    /project/:id     # Get latest bid
│   └── GET    /history/:id     # Get bid version history
│
├── /ai
│   ├── POST   /analyze         # RFP analysis
│   ├── POST   /conflicts       # Conflict detection
│   └── POST   /win-probability # Win probability prediction
│
├── /admin
│   ├── GET    /users           # List company users
│   ├── PATCH  /users/:id/role  # Update user role
│   ├── POST   /invitations     # Create invitation
│   └── DELETE /invitations/:id # Revoke invitation
│
└── /branding
    ├── GET    /                # Get user branding
    └── PUT    /                # Update branding
```

### Authentication Flow

```
┌────────┐                    ┌────────┐                    ┌────────┐
│ Client │                    │ Server │                    │   DB   │
└───┬────┘                    └───┬────┘                    └───┬────┘
    │                             │                             │
    │  POST /auth/login           │                             │
    │  {email, password}          │                             │
    ├────────────────────────────►│                             │
    │                             │  Verify credentials         │
    │                             ├────────────────────────────►│
    │                             │◄────────────────────────────┤
    │                             │                             │
    │                             │  Generate JWT tokens        │
    │                             │  - Access (15min)           │
    │                             │  - Refresh (7 days)         │
    │  {accessToken, refreshToken}│                             │
    │◄────────────────────────────┤                             │
    │                             │                             │
    │  GET /api/projects          │                             │
    │  Authorization: Bearer xxx  │                             │
    ├────────────────────────────►│                             │
    │                             │  Validate JWT               │
    │                             │  Extract user context       │
    │                             │  Apply company filter       │
    │                             ├────────────────────────────►│
    │  {projects}                 │◄────────────────────────────┤
    │◄────────────────────────────┤                             │
    │                             │                             │
```

---

## Feature Modules

### 1. RFP Analysis Engine

Analyzes uploaded RFQ documents and provides multi-dimensional scoring:

**Scoring Dimensions:**
- **Quality Score** (0-100): Document completeness and professionalism
- **Clarity Score** (0-100): Requirements specificity and unambiguity
- **Doability Score** (0-100): Technical and resource feasibility
- **Vendor Risk Score** (0-100): Client reliability and payment history

**Risk Levels:**
- `LOW`: Total score > 70, proceed with confidence
- `MEDIUM`: Total score 50-70, proceed with caution
- `HIGH`: Total score < 50, consider declining
- `CRITICAL`: Major red flags detected, recommend decline

### 2. Win Probability ML System

Predicts bid success probability using 8 key features:

| Feature | Weight | Description |
|---------|--------|-------------|
| Project Type Match | 15% | Historical success by project category |
| Client Relationship | 20% | Previous work with client |
| Competitive Position | 15% | Market position and reputation |
| Pricing Strategy | 15% | Competitive pricing analysis |
| Timeline Feasibility | 10% | Realistic schedule assessment |
| Resource Availability | 10% | Team capacity evaluation |
| Technical Capability | 10% | Relevant expertise match |
| Geographic Proximity | 5% | Location advantage |

### 3. Conflict Detection

Identifies contradictions in bid documents:

**Detection Methods:**
- **Semantic Conflicts**: Uses embeddings to find contradictory statements
- **Numeric Conflicts**: Regex-based detection of conflicting numbers
- **Date Conflicts**: Timeline inconsistency detection

**Severity Levels:**
- `HIGH`: Direct contradictions requiring immediate resolution
- `MEDIUM`: Potential inconsistencies to review
- `LOW`: Minor discrepancies for awareness

---

## Security Architecture

### Defense in Depth

```
┌─────────────────────────────────────────────────────────────────┐
│                     Security Layers                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Layer 1: Network Security                                      │
│  ├── HTTPS/TLS encryption                                       │
│  ├── CORS policy (allowed origins only)                         │
│  └── Rate limiting (100 req/15min per IP)                       │
│                                                                 │
│  Layer 2: Application Security                                  │
│  ├── Helmet.js security headers                                 │
│  ├── Input validation (Zod schemas)                             │
│  ├── SQL injection prevention (Drizzle ORM)                     │
│  └── XSS prevention (sanitize-html)                             │
│                                                                 │
│  Layer 3: Authentication                                        │
│  ├── JWT access tokens (15min expiry)                           │
│  ├── Refresh token rotation                                     │
│  ├── bcrypt password hashing (12 rounds)                        │
│  └── Session invalidation on logout                             │
│                                                                 │
│  Layer 4: Authorization                                         │
│  ├── Role-based access control (RBAC)                           │
│  ├── Company-scoped data isolation                              │
│  ├── Resource-level permissions                                 │
│  └── Middleware enforcement                                     │
│                                                                 │
│  Layer 5: Data Security                                         │
│  ├── Encrypted database connections                             │
│  ├── Secrets management (environment variables)                 │
│  └── Audit logging                                              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Deployment Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Production Environment                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                     Replit Platform                      │   │
│  ├─────────────────────────────────────────────────────────┤   │
│  │                                                         │   │
│  │   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐  │   │
│  │   │   Vite      │   │  Express    │   │   Neon      │  │   │
│  │   │  (Static)   │   │   (API)     │   │ PostgreSQL  │  │   │
│  │   │  Port 5000  │   │  Port 5000  │   │  (Cloud)    │  │   │
│  │   └─────────────┘   └─────────────┘   └─────────────┘  │   │
│  │         │                 │                 │          │   │
│  │         └────────┬────────┘                 │          │   │
│  │                  │                          │          │   │
│  │                  ▼                          │          │   │
│  │         ┌─────────────────┐                 │          │   │
│  │         │   Unified App   │◄────────────────┘          │   │
│  │         │   (SSR + API)   │                            │   │
│  │         └─────────────────┘                            │   │
│  │                  │                                     │   │
│  │                  ▼                                     │   │
│  │         ┌─────────────────┐                            │   │
│  │         │  Replit CDN     │                            │   │
│  │         │  (Edge Cache)   │                            │   │
│  │         └─────────────────┘                            │   │
│  │                                                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  External Services:                                             │
│  ├── OpenAI API (ai.openai.com)                                │
│  ├── Anthropic API (api.anthropic.com)                         │
│  ├── Google Gemini (generativelanguage.googleapis.com)         │
│  ├── WhatsApp Business API (graph.facebook.com)                │
│  └── Neon PostgreSQL (*.neon.tech)                             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Design System

### Brand Colors

| Name | Hex | Usage |
|------|-----|-------|
| Charcoal | `#2C3E50` | Primary text, headers |
| Deep Teal | `#1A5F5E` | Primary accent, buttons |
| Antique Gold | `#C9A962` | Secondary accent, highlights |
| Light Background | `#F8F9FA` | Page backgrounds |
| Card Background | `#FFFFFF` | Card surfaces |

### Typography

| Role | Font | Weight | Usage |
|------|------|--------|-------|
| Display | Syne | Bold | Hero headings, titles |
| Heading | Inter | Semibold | Section headers |
| Body | Inter | Regular | Paragraphs, content |
| Accent | Fraunces | Variable | Quotes, callouts |

---

## Performance Considerations

### Optimization Strategies

1. **Database**
   - Vector index on embeddings (IVFFlat with 100 lists)
   - GIN index on full-text search columns
   - Connection pooling via Neon serverless driver

2. **API**
   - Response compression (gzip)
   - Query result caching (TanStack Query)
   - Pagination for list endpoints

3. **Frontend**
   - Code splitting by route
   - Lazy loading of heavy components
   - Image optimization

4. **AI Operations**
   - Parallel multi-model generation
   - Streaming responses for long operations
   - Caching of embeddings

---

## Future Architecture Considerations

1. **Horizontal Scaling**
   - Redis for distributed caching
   - Message queue for async operations
   - Read replicas for analytics

2. **Enhanced AI**
   - Fine-tuned models for construction domain
   - Automated learning from bid outcomes
   - Real-time collaboration features

3. **Integrations**
   - CRM system connections
   - Document management systems
   - E-signature providers

---

*Document Version: 1.0*
*Last Updated: December 2024*
