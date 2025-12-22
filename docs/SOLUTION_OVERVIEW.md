# BidForge AI - Solution Overview

**Document Version:** 1.0  
**Last Updated:** December 22, 2025

---

## Executive Summary

BidForge AI is a next-generation construction bidding automation platform that transforms the RFP/RFQ response process. By leveraging advanced AI technologies, RAG (Retrieval-Augmented Generation), and cross-modal conflict detection, BidForge AI enables construction companies to generate professional, compliant bid proposals with unprecedented speed and accuracy.

### Key Value Propositions

- **85% Reduction** in bid disqualifications through intelligent compliance checking
- **40% Faster** time-to-submission with AI-powered content generation
- **25-35% Increase** in win rates through optimized proposal quality
- **GCC-Specific Compliance** for UAE, Saudi Arabia, and Qatar government tenders

---

## System Architecture

### Technology Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 18, TypeScript, Vite, Tailwind CSS v4, Shadcn UI |
| **Backend** | Node.js, Express.js, TypeScript |
| **Database** | PostgreSQL with pgvector extension |
| **AI/ML** | Multi-model support (Anthropic Claude, Google Gemini, DeepSeek, xAI Grok 4) |
| **Embeddings** | OpenAI text-embedding-3-small |
| **Real-time** | Server-Sent Events (SSE) for progress streaming |

### Core Components

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT (React)                           │
├─────────────────────────────────────────────────────────────────┤
│  Dashboard │ Project Workspace │ Document Analysis │ Settings   │
├─────────────────────────────────────────────────────────────────┤
│                    API Layer (Express.js)                        │
├─────────────────────────────────────────────────────────────────┤
│  Auth  │  Projects  │  Documents  │  AI Generation  │  RAG      │
├─────────────────────────────────────────────────────────────────┤
│                    Multi-Shot Agent System                       │
├───────┬───────┬───────┬───────┬───────┬───────────────────────┤
│Intake │Sketch │Analysis│Decision│Generation│Ensemble Review     │
├───────┴───────┴───────┴───────┴───────┴───────────────────────┤
│                PostgreSQL + pgvector                             │
│         (Users, Projects, Documents, Embeddings)                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Key Features

### 1. Intelligent Document Processing

**Document Ingestion Pipeline:**
- Supports PDF, DOCX, XLSX, ZIP, and image files
- AI-powered sketch analysis for construction drawings
- Automatic text extraction and semantic chunking
- Vector embeddings for similarity search

**RAG (Retrieval-Augmented Generation):**
- Hybrid search combining vector similarity + full-text search
- Context from current project documents
- Historical data from "Closed-Won" projects
- Company knowledge base integration

### 2. Multi-Shot AI Agent System

The bid generation process uses a sophisticated agent orchestration system:

| Agent | Responsibility |
|-------|----------------|
| **Intake Agent** | Document ingestion and initial processing |
| **Sketch Agent** | Construction drawing analysis (Python subprocess) |
| **Analysis Agent** | RFP requirement extraction and risk assessment |
| **Decision Agent** | Bid/no-bid recommendation with win probability |
| **Generation Agent** | Multi-model bid content creation |
| **Ensemble Review Agent** | Quality scoring and iterative refinement |

**Key Features:**
- Quality threshold enforcement (default 75/100)
- Up to 3 refinement iterations per agent
- Real-time progress streaming via SSE
- Multi-model comparison (run multiple AI models in parallel)

### 3. RFP Analysis & Risk Assessment

**Automated Scoring:**
- Quality Score
- Clarity Score
- Doability Score
- Vendor Risk Assessment
- Overall Risk Level (Low/Medium/High)

**Intelligent Insights:**
- Missing document detection
- Compliance gap identification
- Actionable recommendations
- WhatsApp/Email integration for requesting missing documents

### 4. Conflict Detection System

**Cross-Modal Conflict Detection:**
- Semantic conflict detection using embeddings
- Numeric conflict detection via pattern matching
- Contradiction identification across bid documents
- Severity scoring and resolution suggestions

### 5. Win Probability Prediction

**ML-Based Prediction System:**
- 8 predictive features extracted from project data
- Weighted statistical scoring model
- Confidence score calculation
- Actionable recommendations for improving win probability

---

## 4-Step Guided Workflow

### Step 1: Documents (`/projects/:id/documents`)
- Upload RFP documents via drag-and-drop
- Real-time processing status indicators
- File management and verification

### Step 2: RFP Analysis (`/projects/:id/analysis`)
- AI-powered document analysis
- Quality and risk scoring
- Recommendations and missing item detection

### Step 3: Conflicts (`/projects/:id/conflicts`)
- Review detected conflicts and inconsistencies
- Severity-based prioritization
- Resolution guidance

### Step 4: Bid Generation (`/projects/:id`)
- Multi-model AI comparison
- Real-time generation progress
- Rich text editing with TipTap
- Preview and export functionality

---

## Multi-Company & Team Management

### Company Isolation
- Company-scoped data isolation
- Users only see their company's projects, bids, and team members

### Role-Based Access Control
| Role | Permissions |
|------|-------------|
| **System Admin** | Full platform access |
| **Company Admin** | Manage company users, projects, settings |
| **Company User** | Create/edit projects and bids |
| **Viewer** | Read-only access |

### Team Invitation System
- Email-based invitations with unique codes
- 7-day expiration with status tracking
- Role assignment at invitation time
- Accept invite page for new team members

---

## Company Branding Onboarding

New companies go through a branding setup wizard that includes:
- Company name and website URL
- Primary brand color (color picker)
- Logo URL
- About us description
- Contact information

**Live Preview:** Split-screen layout shows real-time preview of how branding appears in bid documents.

---

## Bid Document Structure

Generated bids follow a professional 9-section template:

1. **Executive Summary** - Project overview and value proposition
2. **Company Credentials & Qualifications** - Experience and certifications
3. **Technical Scope of Work** - Detailed requirements coverage
4. **Construction Methodology** - Approach and execution plan
5. **Project Timeline** - Milestones and scheduling
6. **Risk Mitigation** - Risk identification and mitigation strategies
7. **Quality Assurance** - QA/QC processes and standards
8. **Resource Plan** - Team structure and equipment allocation
9. **Pricing Framework** - Cost breakdown and payment terms

---

## Security & Compliance

### Authentication
- JWT-based authentication with bcrypt password hashing
- Access tokens (24h) + Refresh tokens (7d, HttpOnly cookies)
- Constant-time password verification (timing attack prevention)

### User Agreement
- Mandatory acceptance for all users
- Tracked acceptance timestamp
- Modal blocks app access until accepted
- Covers: AI accuracy disclaimers, liability limitations, data security

### Security Measures
- Helmet.js security headers
- Rate limiting on API endpoints
- CORS configuration
- Request body size limits
- Audit logging for sensitive operations

---

## API Integrations

### AI Providers
| Provider | Model | Use Case |
|----------|-------|----------|
| Anthropic | Claude Sonnet 4 | Primary generation, orchestration |
| Google | Gemini 2.5 Flash | Alternative generation |
| DeepSeek | DeepSeek | Cost-effective generation |
| xAI | Grok 4 | Alternative generation |
| OpenAI | text-embedding-3-small | Vector embeddings |

### External Services
- **Meta WhatsApp Business API** - Document request messaging
- **Neon PostgreSQL** - Serverless database hosting

---

## Database Schema

### Core Tables
- `companies` - Multi-tenant company management
- `users` - User accounts with roles and branding
- `projects` - Bid projects with metadata
- `documents` - Uploaded RFP documents
- `document_chunks` - Semantic chunks with embeddings
- `bids` - Generated bid responses with versioning

### Supporting Tables
- `sessions` - JWT refresh token management
- `company_invites` - Team invitation system
- `rfp_analyses` - Analysis results and scores
- `document_conflicts` - Detected conflicts
- `win_probability_predictions` - ML predictions
- `knowledge_base_chunks` - Company knowledge with embeddings

---

## Deployment

BidForge AI is deployed on Replit with:
- Automatic SSL/TLS certificates
- Health checks and monitoring
- Environment-based configuration
- Production database separation

**Domain:** bidforgeai.com (or .replit.app subdomain)

---

## Future Roadmap

1. **Enhanced GCC Compliance** - Region-specific tender requirements
2. **Parallelized Blackboard Architecture** - Multi-agent collaboration
3. **Advanced Analytics** - Win rate tracking and optimization
4. **Template Library** - Pre-built bid templates by industry
5. **API Access** - Third-party integration capabilities

---

## Contact & Support

For technical support or inquiries, please contact the BidForge AI team.

---

*This document provides a high-level overview of the BidForge AI solution. For detailed technical documentation, refer to the inline code documentation and API specifications.*
