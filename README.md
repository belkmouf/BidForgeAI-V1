# BidForge AI

**AI-Powered Construction Bidding Automation System**

BidForge AI streamlines the proposal generation process for construction companies by ingesting RFQ documents, leveraging RAG (Retrieval-Augmented Generation) with vector search from historical "Closed-Won" projects, and generating professional bid responses using multiple AI models.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)
![TypeScript](https://img.shields.io/badge/typescript-5.0+-blue)

## Features

### Core Capabilities

- **AI Bid Generation** - Generate professional bid proposals using multiple AI providers (OpenAI GPT-4o, Claude, Gemini, DeepSeek) with side-by-side model comparison
- **RAG-Powered Context** - Hybrid search combining vector similarity (70%) and full-text search (30%) to find relevant content from current and historical projects
- **Document Processing** - Upload and process PDFs, MSG files, ZIP archives with recursive extraction and semantic chunking
- **Rich Text Editor** - Tiptap-based editor for refining generated bids with real-time preview
- **AI Chat Refinement** - Iteratively improve bids through natural language conversation

### Risk & Analysis

- **RFP Analysis & Risk Assessment** - AI-powered scoring for Quality, Clarity, Doability, and Vendor Risk with actionable recommendations
- **Conflict Detection** - Semantic and numeric conflict detection to identify contradictions in bid documents
- **Win Probability Prediction** - ML-based system extracting 8 predictive features to calculate bid success likelihood

### Team Collaboration

- **Multi-Company Support** - Complete data isolation between companies with role-based access control
- **Team Management** - Invite team members, assign roles (Admin, Manager, User, Viewer), manage permissions
- **Company Branding** - Custom branding wizard for professional bid document styling
- **Public Sharing** - Generate shareable links for clients to view bid proposals without login

### Security

- JWT-based authentication with access/refresh tokens
- Role-Based Access Control (RBAC) with granular permissions
- Helmet.js, rate limiting, CORS protection
- Input sanitization to prevent prompt injection

## Tech Stack

### Frontend
- React 18 with TypeScript
- Vite for blazing-fast builds
- Tailwind CSS v4 with custom design system
- Shadcn UI + Radix UI primitives
- TanStack Query for server state
- Wouter for routing
- Tiptap rich text editor
- Recharts for analytics
- GSAP for animations

### Backend
- Express.js with TypeScript
- Drizzle ORM with type-safe queries
- PostgreSQL with pgvector extension
- Multer for file uploads
- Zod for validation
- LangChain/LangGraph for AI orchestration

### AI Providers
- OpenAI (GPT-4o, text-embedding-3-small)
- Anthropic (Claude Sonnet)
- Google Gemini (2.5 Flash)
- DeepSeek

## Getting Started

### Prerequisites

- Node.js >= 18.0.0
- PostgreSQL with pgvector extension (or Neon serverless)
- API keys for at least one AI provider

### Environment Variables

Create a `.env` file with the following:

```env
# Database
DATABASE_URL=postgresql://user:password@host:5432/database

# AI Providers (at least one required)
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_GENERATIVE_AI_API_KEY=...
DEEPSEEK_API_KEY=...

# Authentication
JWT_SECRET=your-secret-key
JWT_REFRESH_SECRET=your-refresh-secret

# Optional: WhatsApp Business API
WHATSAPP_PHONE_NUMBER_ID=...
WHATSAPP_ACCESS_TOKEN=...
```

### Installation

```bash
# Install dependencies
npm install

# Push database schema
npm run db:push

# Start development server
npm run dev
```

The app will be available at `http://localhost:5000`

## Project Structure

```
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/    # UI components
│   │   ├── pages/         # Route pages
│   │   ├── lib/           # Utilities & API client
│   │   └── hooks/         # Custom React hooks
├── server/                 # Express backend
│   ├── lib/               # Business logic
│   │   ├── templates/     # Bid document templates
│   │   ├── analysis.ts    # RFP analysis
│   │   ├── openai.ts      # OpenAI integration
│   │   ├── anthropic.ts   # Anthropic integration
│   │   ├── gemini.ts      # Google Gemini integration
│   │   └── ingestion.ts   # Document processing
│   ├── routes/            # API route handlers
│   ├── middleware/        # Auth, RBAC middleware
│   └── storage.ts         # Database operations
├── shared/                 # Shared types & schemas
│   └── schema.ts          # Drizzle schema definitions
└── uploads/               # Uploaded files
```

## API Overview

### Authentication
- `POST /api/auth/register` - Create account (creates new company)
- `POST /api/auth/login` - Sign in
- `POST /api/auth/refresh` - Refresh access token

### Projects
- `GET /api/projects` - List all projects
- `POST /api/projects` - Create new project
- `GET /api/projects/:id` - Get project details
- `PATCH /api/projects/:id/status` - Update project status

### Documents
- `POST /api/projects/:id/upload` - Upload RFQ documents
- `GET /api/projects/:id/documents` - List documents
- `DELETE /api/documents/:id` - Remove document

### Bid Generation
- `POST /api/projects/:id/generate` - Generate bid with AI
- `POST /api/projects/:id/refine` - Refine bid with feedback
- `GET /api/projects/:id/bids` - List all bid versions
- `GET /api/projects/:id/bids/latest` - Get latest bid

### Public Sharing
- `POST /api/bids/:id/share` - Generate share link
- `GET /api/public/bids/:token` - View shared bid (no auth)

### Analysis
- `POST /api/projects/:id/analyze` - Run RFP analysis
- `GET /api/conflicts/:projectId` - Get conflict detection results
- `GET /api/win-probability/:projectId` - Get win probability

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [Shadcn UI](https://ui.shadcn.com/) for the beautiful component library
- [LangChain](https://langchain.com/) for AI orchestration
- [Drizzle ORM](https://orm.drizzle.team/) for type-safe database operations
- [Neon](https://neon.tech/) for serverless PostgreSQL
