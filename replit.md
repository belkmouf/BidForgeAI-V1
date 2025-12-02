# BidForge AI - Construction Bidding Automation System

## Overview

BidForge AI is a construction bidding automation system that streamlines the proposal generation process for construction companies. The application ingests RFQ documents (PDFs, emails, ZIP files), uses Retrieval-Augmented Generation (RAG) with vector search to find relevant context from current and historical "Closed-Won" projects, and generates professional HTML bid responses using AI. Users can iteratively refine bids through an AI-powered chat interface.

The system is designed as a full-stack web application with a React frontend and Express/Node.js backend, leveraging PostgreSQL with pgvector for semantic search capabilities.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework & Build System**
- React 18 with TypeScript using Vite as the build tool
- Wouter for lightweight client-side routing
- TanStack Query (React Query) for server state management and API data fetching
- Single-page application (SPA) architecture with client-side routing

**UI Component System**
- Shadcn UI component library (New York style variant) with Radix UI primitives
- Tailwind CSS v4 for styling with custom design tokens
- Lucide React for iconography
- Custom fonts: Inter, Space Grotesk, and JetBrains Mono

**Rich Text Editing**
- Tiptap editor for WYSIWYG bid document editing
- Support for tables, headings, lists, and rich formatting
- Extensions for placeholder text and table functionality

**Key Frontend Features**
- Dashboard with project pipeline visualization using Recharts
- Project workspace with drag-and-drop file upload
- Resizable panel layout for split-screen editing
- AI generation panel with model selection (OpenAI, Anthropic, Gemini)
- Iterative refinement through chat interface

### Backend Architecture

**Server Framework**
- Express.js with TypeScript running on Node.js
- HTTP server with middleware for JSON parsing and URL encoding
- Custom request logging with timestamp formatting
- Development mode with Vite middleware for HMR
- Production mode serving static built assets

**API Design**
- RESTful API endpoints under `/api` prefix
- Multipart form data handling with Multer for file uploads (50MB limit)
- Zod schema validation for request payloads
- Error handling with structured JSON responses

**Database Layer**
- Drizzle ORM for type-safe database queries
- Neon serverless PostgreSQL with WebSocket support
- Schema-first design with TypeScript type generation
- Migration management via Drizzle Kit

**AI Integration Strategy**
- Multiple AI provider support: OpenAI (GPT-4o), Anthropic (Claude Sonnet 4.5), Google Gemini (2.5 Flash)
- Separate service modules for each AI provider
- Unified interface for bid generation and refinement
- User-selectable model at runtime

**RAG Implementation**
- Vector embeddings using OpenAI's text-embedding-3-small model (1536 dimensions)
- pgvector extension for similarity search
- Document chunking strategy for efficient retrieval
- Context aggregation from current project documents and historical winning bids

### Data Storage Solutions

**Database Schema**

1. **Projects Table**
   - UUID primary key with auto-generation
   - Status tracking: Active, Submitted, Closed-Won, Closed-Lost
   - JSONB metadata field for flexible attributes
   - Client name and project name fields

2. **Documents Table**
   - Auto-incrementing integer ID
   - Foreign key reference to projects with cascade delete
   - Text content storage and processing status flag
   - Upload timestamp tracking

3. **Document Chunks Table**
   - Auto-incrementing integer ID
   - Foreign key reference to documents with cascade delete
   - Text content with vector embeddings (1536 dimensions)
   - Chunk index for ordering

**Storage Layer Abstraction**
- Interface-based design (`IStorage`) for testability
- `DatabaseStorage` implementation using Drizzle ORM
- Methods for CRUD operations on projects, documents, and chunks
- Similarity search using cosine distance with pgvector
- Dashboard statistics aggregation (pipeline counts, win rate)

### Authentication and Authorization

Currently, the application does not implement authentication or authorization mechanisms. This is an area for future enhancement.

### External Dependencies

**AI Services**
- OpenAI API for GPT-4o completions and text embeddings
- Anthropic API for Claude Sonnet 4.5 completions
- Google Gemini API for Gemini 2.5 Flash completions
- All three providers configurable via environment variables with custom base URLs

**Database**
- Neon serverless PostgreSQL (or compatible PostgreSQL service)
- Requires pgvector extension for vector similarity search
- Connection via `DATABASE_URL` environment variable

**Development Tools**
- Replit-specific plugins for Vite (cartographer, dev banner, runtime error modal, meta images)
- ESBuild for server-side bundling with selective dependency bundling

**File Processing**
- Multer for multipart form uploads
- In-memory storage strategy for uploaded files
- Support for PDF, MSG, and ZIP file formats (processing implementation pending)

**Build & Deployment**
- Separate build processes for client (Vite) and server (ESBuild)
- Production deployment serves static assets from Express
- Client built to `dist/public`, server built to `dist/index.cjs`
- Environment-based configuration (NODE_ENV, REPL_ID)