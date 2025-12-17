# BidForge AI - Construction Bidding Automation System

## Overview

BidForge AI is a construction bidding automation system designed to streamline the proposal generation process for construction companies. It ingests RFQ documents, leverages Retrieval-Augmented Generation (RAG) with vector search from current and historical "Closed-Won" projects, and generates professional HTML bid responses using AI. The system supports iterative bid refinement via an AI-powered chat interface. It is a full-stack web application with a React frontend, an Express/Node.js backend, and uses PostgreSQL with pgvector for semantic search. The project aims to automate and enhance the efficiency and quality of construction bidding, offering significant market potential for companies seeking a competitive edge.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions

The frontend uses React 18 with TypeScript and Vite, featuring a single-page application architecture with Wouter for routing and TanStack Query for server state. The UI is built with Shadcn UI (New York style), Radix UI primitives, and Tailwind CSS v4, incorporating a custom design system inspired by "Somerstone" with a specific color palette (Charcoal, Deep Teal, Antique Gold) and font hierarchy (Syne, Inter, Fraunces). It includes GSAP for animations. Key features include a dashboard with Recharts, a project workspace with drag-and-drop file upload, resizable panels, and an AI generation panel with multi-model selection and chat-based refinement. A Tiptap editor is used for rich text bid document editing.

**4-Step Guided Workflow:**
The project workspace implements a sequential 4-step workflow with visual stepper navigation:
1. **Documents** (`/projects/:id/documents`): Upload and verify RFP documents with drag-and-drop, processing status, and file management
2. **RFP Analysis** (`/projects/:id/analysis`): AI-powered document analysis with quality scores, risk assessment, and recommendations
3. **Conflicts** (`/projects/:id/conflicts`): Review detected conflicts and inconsistencies in the RFP documents
4. **Bid Generation** (`/projects/:id`): Generate and refine bid proposals with multi-model AI comparison

Key workflow features:
- `ProjectWorkflowLayout` component provides consistent stepper UI and navigation
- `useProjectProgress` hook tracks completion status across steps
- Step gating prevents skipping ahead without completing prerequisites
- Back/Next navigation with conditional disabling based on completion status

### Technical Implementations

The backend is Express.js with TypeScript, using Drizzle ORM for type-safe database interactions with Neon serverless PostgreSQL. It features a RESTful API, Multer for file uploads, and Zod for schema validation. AI integration supports multiple providers (OpenAI, Anthropic, Google Gemini, DeepSeek) with a unified interface for bid generation and refinement, including multi-model parallel comparison. The RAG implementation uses OpenAI's text-embedding-3-small model with pgvector for hybrid search (vector similarity + full-text search) and LangChain's `RecursiveCharacterTextSplitter` for semantic chunking, incorporating context from current and historical projects.

### Feature Specifications

**Core Features:**
- **RFP Analysis & Risk Assessment:** AI-powered analysis of RFQ documents providing scores for Quality, Clarity, Doability, and Vendor Risk, along with an overall risk level, missing document detection, and actionable recommendations. Includes a feature to request missing documents via WhatsApp or Email.
- **Multi-Shot AI Agent System:** Iterative refinement architecture orchestrated by Anthropic Claude Sonnet 3.5:
  - **MasterOrchestrator** (`server/agents/master-orchestrator.ts`): Central coordinator using Anthropic Claude to evaluate agent outputs against quality thresholds (default 75/100) and decide if refinement is needed.
  - **MultishotAgent** (`server/agents/multishot-agent.ts`): Extended base agent supporting iterative refinement with feedback loops.
  - **SketchAgent** (`server/agents/sketch-agent.ts`): Analyzes construction drawings via Python subprocess integration.
  - Workflow agents: Intake → Sketch (conditional) → Analysis → Decision → Generation → Review
  - Each agent can iterate up to 3 times (configurable) until output meets acceptance threshold.
  - Real-time progress streaming via Server-Sent Events (SSE) at `/api/agent-progress/progress/:projectId`.
  - Frontend `AgentProgressPanel` component displays multi-shot conversation progress with evaluation scores and refinement feedback.
- **Conflict Detection:** AI-powered semantic conflict detection using OpenAI embeddings and numeric conflict detection via regex, identifying contradictions in bid documents with severity scoring.
- **Win Probability ML System:** Extracts 8 predictive features from project data (e.g., Project Type, Client Relationship, Competitiveness) to calculate bid win probability using a weighted statistical scoring model, providing confidence scores and actionable recommendations.

**Authentication & Authorization:**
- JWT-based authentication with bcrypt hashing, access and refresh tokens.
- Role-Based Access Control (RBAC) with four roles (Admin, Manager, User, Viewer) and granular permissions managed via `users`, `sessions`, `roles`, and `user_roles` tables.
- Security features include Helmet.js, rate limiting, CORS, and request body size limits.

**Multi-Company Admin:**
- Registration creates a new company with the user as admin automatically.
- Company admins can invite new team members via email with role assignment.
- Invitation system with unique invite codes, 7-day expiration, and status tracking (pending/accepted/revoked).
- Admin UI "My Team" tab for managing company users: view members, change roles, deactivate/reactivate accounts.
- Pending invitations panel with copy-to-clipboard invite links and revoke functionality.
- Accept Invite page (`/invite/:code`) for invited users to create accounts within existing companies.
- Company-scoped data isolation: users only see their company's data (projects, bids, team members).

**Company Branding Onboarding:**
- New users are directed to a branding setup wizard (`/setup/branding`) before accessing the dashboard.
- Split-screen layout: form on the left, live preview on the right showing how branding will appear in bid documents.
- Branding profile includes: company name, website URL, primary brand color (color picker), logo URL, and about us description.
- Onboarding status tracked in users table (`onboardingStatus`: pending/complete) with branding data stored as JSONB.
- Route guards enforce onboarding completion for new registrations while existing users continue with normal access.
- Auth responses include onboardingStatus for client-side route protection.

**Data Storage:**
- PostgreSQL schema includes `Projects`, `Documents`, and `Document Chunks` tables with UUIDs, foreign keys, and vector embeddings.
- `Bids` table stores generated bid responses with relationships to projects, companies, and users, featuring automatic version numbering with `isLatest` flag.
- Additional tables for `rfp_analyses`, `analysis_alerts`, `vendor_database`, `document_conflicts`, `conflict_detection_runs`, `win_probability_predictions`, `bid_outcomes`, and `project_features` support specific functionalities.
- Transactional bid creation ensures atomic version increment and prevents conflicts in multi-model comparison.

### System Design Choices

The system is built for scalability and extensibility, with clear separation of concerns between frontend and backend. The use of Drizzle ORM and a schema-first approach ensures type safety and robust database management. The AI integration strategy supports multiple LLM providers, allowing flexibility and comparison. Hybrid search combining vector and full-text search optimizes RAG performance. The agent-based architecture with LangGraph enables complex workflow automation and iterative processing.

## External Dependencies

**AI Services:**
- OpenAI API (GPT-4o, text-embedding-3-small)
- Anthropic API (Claude Sonnet 4.5)
- Google Gemini API (Gemini 2.5 Flash)
- DeepSeek API

**Database:**
- Neon serverless PostgreSQL (compatible with pgvector extension)

**Integrations:**
- Meta WhatsApp Business API (for sending messages)

**Development Tools:**
- Vite (frontend build)
- ESBuild (backend bundling)
- Multer (file uploads)