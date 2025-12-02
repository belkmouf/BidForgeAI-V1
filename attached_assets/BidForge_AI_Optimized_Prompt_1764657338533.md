# BidForge AI - Construction Bidding Automation MVP

## Executive Summary
Build a production-ready construction bidding system that ingests RFQ documents (PDF, MSG, ZIP), uses RAG with pgvector to retrieve context from current and historical "Closed-Won" projects, and generates professional HTML bid responses via OpenAI or Gemini.

**Success Criteria:**
- ✅ User can upload mixed document types and see processing status
- ✅ System retrieves relevant chunks from current + past winning bids
- ✅ Generated bids are A4-printable HTML with professional styling
- ✅ User can iteratively refine bids via chat interface
- ✅ Dashboard shows win rate and project pipeline metrics

---

## Architecture Overview

```
monorepo/
├── backend/          # Python FastAPI + PostgreSQL/pgvector
└── frontend/         # Next.js 14 App Router + Tiptap
```

**Tech Stack:**
- Backend: FastAPI, SQLAlchemy, pgvector, OpenAI/Gemini
- Frontend: Next.js 14, Tailwind, Tiptap, Recharts
- Database: PostgreSQL (Neon/Supabase via DATABASE_URL)

---

## Phase 1: Core Data Layer

### 1.1 Database Schema (`backend/models.py`)

```python
# SQLAlchemy models with type hints
class ProjectStatus(str, Enum):
    ACTIVE = "Active"
    SUBMITTED = "Submitted"
    CLOSED_WON = "Closed-Won"
    CLOSED_LOST = "Closed-Lost"

class Project(Base):
    id: UUID (PK)
    name: str
    client_name: str
    status: ProjectStatus
    metadata: JSON
    created_at: datetime

class Document(Base):
    id: int (PK)
    project_id: UUID (FK → Project)
    filename: str
    content: Text
    is_processed: bool

class DocumentChunk(Base):
    id: int (PK)
    document_id: int (FK → Document)
    content: Text
    embedding: Vector(1536)  # pgvector type
```

### 1.2 Database Initialization (`backend/init_db.py`)

**Requirements:**
- Create pgvector extension: `CREATE EXTENSION IF NOT EXISTS vector;`
- Create all tables with proper indexes
- Add cosine similarity index on embeddings: `CREATE INDEX ON document_chunk USING ivfflat (embedding vector_cosine_ops);`
- Idempotent script (safe to run multiple times)

---

## Phase 2: Configuration & LLM Abstraction

### 2.1 Configuration System (`backend/config.py`)

```python
# Environment variables (priority order)
LLM_PROVIDER: str = os.getenv("LLM_PROVIDER", "openai")  # "openai" | "gemini"
OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY")
GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY")
DATABASE_URL: str = os.getenv("DATABASE_URL")

# Admin configuration (JSON file: config.json or DB table)
class AdminConfig:
    system_prompt: str  # Master AI instructions
    css_template: str   # HTML/CSS for printable output

# Fallback constant (used when admin config unavailable)
DEFAULT_CSS_TEMPLATE = """
<!DOCTYPE html>
<html>
<head><style>
@page { size: A4; margin: 2cm; }
body { font-family: 'Segoe UI', Arial; line-height: 1.6; color: #333; }
h1 { color: #d97706; border-bottom: 2px solid #d97706; }
table { width: 100%; border-collapse: collapse; margin: 1em 0; }
th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
th { background: #f3f4f6; }
</style></head>
<body>{CONTENT}</body>
</html>
"""
```

### 2.2 LLM Abstraction Layer (`backend/llm_service.py`)

```python
from abc import ABC, abstractmethod

class LLMService(ABC):
    @abstractmethod
    async def generate_response(
        self,
        system_prompt: str,
        user_context: str,
        css_template: str
    ) -> str:
        """Returns complete HTML bid response"""
        pass
    
    @abstractmethod
    async def get_embedding(self, text: str) -> list[float]:
        """Returns 1536-dim embedding vector"""
        pass

class OpenAIService(LLMService):
    # Model: gpt-4-turbo for generation
    # Embedding: text-embedding-3-small (1536 dims)
    pass
    
class GeminiService(LLMService):
    # Model: gemini-1.5-pro for generation
    # Embedding: embedding-001 (768 dims → pad to 1536)
    pass
```

**Error Handling:**
- Catch API rate limits → return 429 with retry-after
- Catch API errors → log full error, return generic message to user
- Timeout after 60s → return partial response or error

---

## Phase 3: Document Ingestion Pipeline

### 3.1 Ingestion Service (`backend/ingestion_service.py`)

**Recursive Processing Logic:**

```python
class IngestionService:
    async def process_file(self, file_path: str, project_id: UUID):
        """Entry point - delegates to specific handlers"""
        pass
        
    async def process_msg(self, msg_path: str, project_id: UUID):
        """
        1. Extract email body using extract-msg
        2. Extract all attachments to temp directory
        3. Recursively call process_file() on each attachment
        4. Clean up temp files
        """
        pass
        
    async def process_zip(self, zip_path: str, project_id: UUID):
        """
        1. Extract ZIP to temp directory
        2. Recursively call process_file() on each file
        3. Support nested ZIPs
        4. Clean up temp files
        """
        pass
        
    async def process_pdf(self, pdf_path: str, project_id: UUID):
        """
        1. Extract text using pypdf or unstructured
        2. If extraction fails, try OCR (tesseract) - optional for MVP
        3. Chunk and embed
        """
        pass
        
    async def chunk_and_embed(self, text: str, document_id: int):
        """
        1. Split into 500-token chunks with 50-token overlap
        2. Get embeddings via LLM service
        3. Store in DocumentChunk table with embeddings
        4. Set Document.is_processed = True
        """
        pass
```

**Critical Requirements:**
- Handle nested archives (ZIP containing MSG containing PDF)
- Skip unsupported file types gracefully (log warning)
- Atomic transactions (rollback on failure)
- Update Document.is_processed only after all chunks embedded

---

## Phase 4: RAG Retrieval Engine

### 4.1 RAG Query Logic (`backend/rag_service.py`)

```python
async def retrieve_context(
    query_embedding: list[float],
    current_project_id: UUID,
    top_k: int = 10
) -> list[DocumentChunk]:
    """
    CRITICAL: Retrieve from BOTH current project AND Closed-Won projects
    
    SQL Logic:
    SELECT dc.content, dc.embedding <=> query_embedding AS distance
    FROM document_chunk dc
    JOIN document d ON dc.document_id = d.id
    JOIN project p ON d.project_id = p.id
    WHERE (
        p.id = current_project_id  -- Current project chunks
        OR
        p.status = 'Closed-Won'     -- Historical winners
    )
    ORDER BY distance ASC
    LIMIT top_k
    """
    pass
```

**Why This Matters:**
This is the "learning" mechanism - including Closed-Won projects allows the system to learn from past successful bids.

---

## Phase 5: Backend API Endpoints

### 5.1 Routes (`backend/routes.py`)

```python
@router.post("/projects")
async def create_project(name: str, client_name: str) -> Project:
    """Creates new project with status=Active"""
    pass

@router.post("/projects/{project_id}/upload")
async def upload_file(project_id: UUID, file: UploadFile):
    """
    1. Validate file type (PDF, MSG, ZIP only)
    2. Save to temp location
    3. Trigger ingestion_service.process_file() asynchronously
    4. Return 202 Accepted with processing status URL
    """
    pass

@router.post("/projects/{project_id}/generate")
async def generate_bid(
    project_id: UUID,
    user_instructions: str,
    tone: str = "professional"
) -> dict:
    """
    1. Embed user_instructions
    2. Retrieve context via RAG (current + Closed-Won projects)
    3. Load admin config or use DEFAULT_CSS_TEMPLATE
    4. Call LLM service with system_prompt + context + CSS template
    5. Return {"html": "...", "used_chunks": [...]}
    """
    pass

@router.post("/projects/{project_id}/refine")
async def refine_bid(
    project_id: UUID,
    current_html: str,
    feedback: str
) -> dict:
    """
    1. Send to LLM: "Current bid: {current_html}. User feedback: {feedback}. Apply changes."
    2. Return updated HTML
    3. No RAG retrieval needed - just edit existing content
    """
    pass

@router.get("/dashboard/stats")
async def get_stats() -> dict:
    """
    Returns:
    {
        "pipeline": {"Active": 5, "Submitted": 3, "Closed-Won": 12, "Closed-Lost": 4},
        "win_rate": 0.75  # Closed-Won / (Closed-Won + Closed-Lost)
    }
    """
    pass
```

---

## Phase 6: Frontend Implementation

### 6.1 Project Workspace (`frontend/app/projects/[id]/page.tsx`)

**Three-Panel Layout:**

```tsx
<div className="grid grid-cols-12 h-screen">
  {/* LEFT: Upload Zone */}
  <div className="col-span-3 border-r">
    <DropZone 
      onUpload={(file) => uploadFile(projectId, file)}
      acceptedTypes={['.pdf', '.msg', '.zip']}
    />
    <FileList files={documents} />
  </div>
  
  {/* CENTER: Tiptap Editor */}
  <div className="col-span-6">
    <TiptapEditor
      content={bidHtml}
      editable={true}
      extensions={[
        Document,
        Paragraph,
        Heading,
        Table,
        DraggableBlocks  // Custom extension
      ]}
    />
  </div>
  
  {/* RIGHT: AI Controls */}
  <div className="col-span-3 border-l">
    <GeneratePanel
      onGenerate={(instructions) => generateBid(instructions)}
    />
    <RefineChat
      onRefine={(feedback) => refineBid(currentHtml, feedback)}
    />
  </div>
</div>
```

### 6.2 Tiptap Configuration

```tsx
// Enable block drag-and-drop
import { DragHandle } from '@tiptap-pro/extension-drag-handle'

const editor = useEditor({
  extensions: [
    StarterKit,
    Table,
    TableRow,
    TableCell,
    DragHandle  // Adds drag handles to blocks
  ]
})
```

### 6.3 Dashboard (`frontend/app/dashboard/page.tsx`)

```tsx
// Use Recharts BarChart
<BarChart data={pipelineData}>
  <Bar dataKey="count" fill="#d97706" />
</BarChart>

<Card>
  <h3>Win Rate</h3>
  <p className="text-4xl">{(winRate * 100).toFixed(1)}%</p>
</Card>
```

---

## Phase 7: Deployment Configuration

### 7.1 Environment Variables (`.env.example`)

```bash
# Required
DATABASE_URL=postgresql://user:pass@host:5432/bidforge
LLM_PROVIDER=openai  # or "gemini"

# OpenAI (required if LLM_PROVIDER=openai)
OPENAI_API_KEY=sk-...

# Gemini (required if LLM_PROVIDER=gemini)
GEMINI_API_KEY=...

# Optional
ADMIN_CONFIG_PATH=./config.json  # Path to admin config file
```

### 7.2 Docker Setup (`backend/Dockerfile`)

```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### 7.3 DEPLOYMENT.md

```markdown
# BidForge AI Deployment Guide

## Prerequisites
- PostgreSQL 15+ with pgvector extension
- Node.js 18+
- Python 3.11+

## Step 1: Database Setup

### Option A: Neon
1. Create project at neon.tech
2. Enable pgvector: `CREATE EXTENSION vector;`
3. Copy connection string to DATABASE_URL

### Option B: Supabase
1. Create project at supabase.com
2. pgvector pre-installed
3. Copy connection string

## Step 2: Initialize Database
```bash
cd backend
python init_db.py
```

## Step 3: Configure Environment
```bash
# Backend
cp .env.example .env
# Edit .env with your keys

# Frontend
cp .env.local.example .env.local
NEXT_PUBLIC_API_URL=http://localhost:8000
```

## Step 4: Install Dependencies
```bash
# Backend
pip install -r requirements.txt

# Frontend
cd frontend && npm install
```

## Step 5: Run Development
```bash
# Terminal 1: Backend
cd backend && uvicorn main:app --reload

# Terminal 2: Frontend
cd frontend && npm run dev
```

## Production Build
```bash
# Backend
docker build -t bidforge-backend .
docker run -p 8000:8000 --env-file .env bidforge-backend

# Frontend
npm run build
npm start
```

## Troubleshooting
- **pgvector not found**: Run `CREATE EXTENSION vector;` in psql
- **Embedding dimension mismatch**: Ensure all embeddings are 1536 dims
- **CORS errors**: Check NEXT_PUBLIC_API_URL matches backend host
```

---

## Dependencies

### `backend/requirements.txt`
```txt
fastapi==0.109.0
uvicorn[standard]==0.27.0
sqlalchemy==2.0.25
psycopg2-binary==2.9.9
pgvector==0.2.4
python-multipart==0.0.6
pydantic==2.5.3
openai==1.10.0
google-generativeai==0.3.2
extract-msg==0.45.0
pypdf==3.17.4
python-dotenv==1.0.0
```

### `frontend/package.json`
```json
{
  "dependencies": {
    "next": "14.1.0",
    "react": "18.2.0",
    "react-dom": "18.2.0",
    "@tiptap/react": "^2.1.16",
    "@tiptap/starter-kit": "^2.1.16",
    "@tiptap/extension-table": "^2.1.16",
    "recharts": "^2.10.3",
    "lucide-react": "^0.309.0",
    "tailwindcss": "^3.4.1"
  }
}
```

---

## Critical Success Factors

1. **RAG Retrieval MUST query Closed-Won projects** - This is non-negotiable
2. **Error handling on every external call** - LLM APIs, DB queries, file operations
3. **Async processing for file uploads** - Don't block API response
4. **Type safety** - Use Pydantic models for all API contracts
5. **CSS template fallback** - System must work without admin config

---

## Validation Checklist

Before considering the implementation complete, verify:

- [ ] Can upload PDF and see chunks in database
- [ ] Can upload MSG file with PDF attachment - both processed
- [ ] Can upload ZIP containing multiple files - all processed
- [ ] Generate endpoint returns HTML wrapped in CSS template
- [ ] Refine endpoint successfully modifies existing HTML
- [ ] Dashboard shows accurate win rate calculation
- [ ] Tiptap editor displays generated HTML correctly
- [ ] Block drag-and-drop works in Tiptap
- [ ] Switching LLM_PROVIDER=gemini works without code changes
- [ ] System handles missing API keys gracefully
- [ ] RAG retrieval includes chunks from Closed-Won projects
- [ ] File processing errors don't crash the server
- [ ] Admin config loads correctly with fallback to DEFAULT_CSS_TEMPLATE

---

## Implementation Guidelines for Coding Agents

### Approach
1. **Start with Phase 1** - Database layer is the foundation
2. **Test each phase independently** - Don't move forward with broken dependencies
3. **Use type hints everywhere** - Catches 80% of bugs before runtime
4. **Log generously** - Especially in file processing and RAG retrieval
5. **Handle errors explicitly** - No bare `except:` clauses

### Common Pitfalls to Avoid
- ❌ Forgetting to query Closed-Won projects in RAG retrieval
- ❌ Not handling nested ZIP/MSG files recursively
- ❌ Blocking API calls during file processing
- ❌ Missing pgvector extension installation
- ❌ Hardcoding OpenAI when Gemini should work too
- ❌ Not cleaning up temp files after processing
- ❌ Forgetting to set is_processed flag after chunking

### Testing Strategy
1. **Unit tests** for ingestion_service (mock file operations)
2. **Integration tests** for RAG retrieval (use test database)
3. **E2E tests** for generate/refine flows
4. **Manual testing** with real construction RFQ documents

---

## Architecture Decisions & Rationale

### Why pgvector?
- Native PostgreSQL extension - no separate vector DB
- ACID compliance for business data
- Cost-effective for MVP scale (<100k chunks)

### Why Both OpenAI and Gemini?
- Cost flexibility (Gemini cheaper for high volume)
- Redundancy if one provider has outages
- Future-proofing for multi-model strategies

### Why Tiptap Over Alternatives?
- Prosemirror-based (battle-tested)
- Block-level manipulation (drag-drop)
- Extensible for custom bid formatting

### Why Monorepo?
- Simplified deployment on Replit
- Shared TypeScript types between frontend/backend possible
- Single git history for feature development

---

## Future Enhancements (Post-MVP)

- [ ] Voice memo ingestion using Whisper API
- [ ] Multi-user collaboration with WebSocket real-time editing
- [ ] Template library for different bid types
- [ ] PDF export with header/footer customization
- [ ] Email integration (auto-ingest from Outlook/Gmail)
- [ ] Mobile app for on-site bid reviews
- [ ] Analytics dashboard (response time, win patterns)
- [ ] Fine-tuned model on company's successful bids

---

## Support & Troubleshooting

### Database Issues
```bash
# Check pgvector installation
psql $DATABASE_URL -c "SELECT * FROM pg_extension WHERE extname='vector';"

# Verify embeddings
psql $DATABASE_URL -c "SELECT COUNT(*) FROM document_chunk WHERE embedding IS NOT NULL;"
```

### LLM Issues
```python
# Test OpenAI connectivity
from openai import OpenAI
client = OpenAI()
response = client.embeddings.create(model="text-embedding-3-small", input="test")
print(f"Dimensions: {len(response.data[0].embedding)}")
```

### Frontend Issues
```bash
# Clear Next.js cache
rm -rf .next
npm run build

# Check API connectivity
curl http://localhost:8000/dashboard/stats
```

---

## License & Credits

**Built for Construction Industry Automation**

This system implements RAG-based bidding intelligence with cross-modal document processing and historical learning capabilities.

Key Technologies:
- FastAPI for high-performance async Python backend
- Next.js 14 for modern React frontend with App Router
- pgvector for efficient semantic search
- OpenAI/Gemini for state-of-the-art language understanding

---

**Document Version:** 1.0  
**Last Updated:** 2024  
**Target Audience:** AI Coding Agents, Senior Developers, DevOps Engineers
