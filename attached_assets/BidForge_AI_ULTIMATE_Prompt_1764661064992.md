# ROLE: Senior Full-Stack Architect & Production Engineer

You are an expert full-stack developer with deep expertise in Python FastAPI, Next.js, PostgreSQL, and AI system architecture. You are tasked with building **BidForge AI** - a production-ready construction bidding automation system that MUST be functional, error-free, and deployable immediately.

---

# ⚠️ CRITICAL CONSTRAINTS - DO NOT HALLUCINATE ⚠️

## Non-Negotiable Requirements (READ THIS FIRST)

### 1. RAG RETRIEVAL LOGIC - ABSOLUTE REQUIREMENT
**YOU MUST query BOTH:**
- Current project documents (project_id = current_project)
- Historical winning bids (project.status = 'Closed-Won')

**This is the learning mechanism. If you skip this, the system CANNOT learn from past wins.**

```sql
-- CRITICAL: This WHERE clause MUST have both conditions
WHERE (
    p.id = :current_project_id          -- Current project
    OR
    p.status = 'Closed-Won'             -- Historical winners (REQUIRED)
)
```

### 2. RECURSIVE FILE PROCESSING - MANDATORY
**YOU MUST handle nested archives:**
- ZIP containing MSG → Extract MSG, process it
- MSG containing PDF attachment → Extract PDF, process it
- ZIP containing ZIP → Recursively unpack and process

**If a user uploads nested_archive.zip with emails inside, and those emails have PDF attachments, ALL FILES must be extracted and processed.**

### 3. ATOMIC TRANSACTIONS - NO EXCEPTIONS
**YOU MUST implement rollback on failure:**
```python
try:
    # Process files
    await ingestion_service.process_file(...)
    doc.is_processed = True
    db.commit()
except Exception as e:
    db.rollback()  # CRITICAL: Must rollback
    raise
finally:
    cleanup_temp_files()  # CRITICAL: Must cleanup
```

### 4. PGVECTOR SETUP - CANNOT SKIP
**YOU MUST enable pgvector extension before creating tables:**
```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

**Without this, the Vector(1536) column will fail.**

---

# EXECUTION PLAN - STRICT PHASE GATES

**Rules:**
- Execute phases in order
- DO NOT proceed to next phase until current phase is VERIFIED
- If verification fails, FIX the issue before continuing
- Each phase has a STOP sign - you must verify before proceeding

---

## ✋ PHASE 1: DATABASE FOUNDATION

### Task: Create PostgreSQL schema with pgvector support

### Implementation:

#### `backend/models.py` - IMPLEMENT THIS EXACTLY:

```python
from sqlalchemy import Column, Integer, String, Text, Boolean, ForeignKey, DateTime, JSON, Enum as SQLEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from pgvector.sqlalchemy import Vector
import uuid
from datetime import datetime
import enum

Base = declarative_base()

class ProjectStatus(str, enum.Enum):
    ACTIVE = "Active"
    SUBMITTED = "Submitted"
    CLOSED_WON = "Closed-Won"
    CLOSED_LOST = "Closed-Lost"

class Project(Base):
    __tablename__ = "projects"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    client_name = Column(String(255), nullable=False)
    status = Column(SQLEnum(ProjectStatus), default=ProjectStatus.ACTIVE, nullable=False)
    metadata = Column(JSON, default={})
    created_at = Column(DateTime, default=datetime.utcnow)
    
    documents = relationship("Document", back_populates="project", cascade="all, delete-orphan")

class Document(Base):
    __tablename__ = "documents"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id"), nullable=False)
    filename = Column(String(500), nullable=False)
    content = Column(Text)
    is_processed = Column(Boolean, default=False)
    
    project = relationship("Project", back_populates="documents")
    chunks = relationship("DocumentChunk", back_populates="document", cascade="all, delete-orphan")

class DocumentChunk(Base):
    __tablename__ = "document_chunks"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    document_id = Column(Integer, ForeignKey("documents.id"), nullable=False)
    content = Column(Text, nullable=False)
    embedding = Column(Vector(1536))  # CRITICAL: Must be 1536 dimensions
    
    document = relationship("Document", back_populates="chunks")
```

#### `backend/database.py`:

```python
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from config import settings

engine = create_engine(settings.DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

#### `backend/init_db.py`:

```python
from sqlalchemy import text
from database import engine
from models import Base

def init_database():
    """Initialize database with pgvector extension and create tables"""
    with engine.connect() as conn:
        # CRITICAL: Enable pgvector FIRST
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector;"))
        conn.commit()
    
    # Create all tables
    Base.metadata.create_all(bind=engine)
    
    # Create index for cosine similarity search
    with engine.connect() as conn:
        conn.execute(text("""
            CREATE INDEX IF NOT EXISTS document_chunk_embedding_idx 
            ON document_chunks 
            USING ivfflat (embedding vector_cosine_ops)
            WITH (lists = 100);
        """))
        conn.commit()
    
    print("✅ Database initialized successfully!")

if __name__ == "__main__":
    init_database()
```

#### `backend/config.py`:

```python
import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    DATABASE_URL: str
    OPENAI_API_KEY: str = ""
    GEMINI_API_KEY: str = ""
    LLM_PROVIDER: str = "openai"  # "openai" or "gemini"
    
    class Config:
        env_file = ".env"

settings = Settings()

# Default CSS Template for A4-printable bids
DEFAULT_CSS_TEMPLATE = """<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
@page { size: A4; margin: 2cm; }
* { margin: 0; padding: 0; box-sizing: border-box; }
body { 
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    line-height: 1.6;
    color: #2c3e50;
    background: white;
}
.container { max-width: 800px; margin: 0 auto; padding: 20px; }
h1 { 
    color: #0d7377;
    border-bottom: 3px solid #c8a962;
    padding-bottom: 10px;
    margin-bottom: 20px;
    font-size: 28px;
}
h2 { 
    color: #0a5c5f;
    margin-top: 24px;
    margin-bottom: 12px;
    font-size: 20px;
}
h3 { 
    color: #0d7377;
    margin-top: 16px;
    margin-bottom: 8px;
    font-size: 16px;
}
p { margin-bottom: 12px; }
table { 
    width: 100%;
    border-collapse: collapse;
    margin: 20px 0;
}
th, td { 
    border: 1px solid #d1d5db;
    padding: 12px;
    text-align: left;
}
th { 
    background: linear-gradient(135deg, #0d7377 0%, #0a5c5f 100%);
    color: white;
    font-weight: 600;
}
tr:nth-child(even) { background: #f9fafb; }
ul, ol { margin-left: 20px; margin-bottom: 12px; }
li { margin-bottom: 6px; }
</style>
</head>
<body>
<div class="container">
{CONTENT}
</div>
</body>
</html>
"""
```

#### `backend/requirements.txt`:

```txt
fastapi==0.109.0
uvicorn[standard]==0.27.0
sqlalchemy==2.0.25
psycopg2-binary==2.9.9
pgvector==0.2.4
python-multipart==0.0.6
pydantic==2.5.3
pydantic-settings==2.1.0
openai==1.10.0
google-generativeai==0.3.2
extract-msg==0.45.0
pypdf==3.17.4
python-dotenv==1.0.0
```

### ⛔ STOP - VERIFICATION REQUIRED

**Before proceeding to Phase 2, verify:**

```bash
# 1. Test database connection
psql $DATABASE_URL -c "SELECT version();"

# 2. Verify pgvector extension
psql $DATABASE_URL -c "SELECT * FROM pg_extension WHERE extname='vector';"

# 3. Run initialization
cd backend
pip install -r requirements.txt
python init_db.py

# 4. Verify tables created
psql $DATABASE_URL -c "\dt"

# 5. Verify vector column
psql $DATABASE_URL -c "\d document_chunks"
```

**Expected output:**
- ✅ Extension "vector" installed
- ✅ Tables: projects, documents, document_chunks exist
- ✅ Column "embedding" has type "vector(1536)"

**DO NOT PROCEED until all checks pass.**

---

## ✋ PHASE 2: LLM ABSTRACTION LAYER

### Task: Create provider-agnostic LLM service

### Implementation:

#### `backend/llm_service.py` - CRITICAL ABSTRACTION:

```python
from abc import ABC, abstractmethod
from typing import List
import openai
import google.generativeai as genai
from config import settings, DEFAULT_CSS_TEMPLATE

class LLMService(ABC):
    @abstractmethod
    async def generate_response(self, system_prompt: str, user_context: str, css_template: str = None) -> str:
        pass
    
    @abstractmethod
    async def get_embedding(self, text: str) -> List[float]:
        pass

class OpenAIService(LLMService):
    def __init__(self):
        self.client = openai.OpenAI(api_key=settings.OPENAI_API_KEY)
    
    async def generate_response(self, system_prompt: str, user_context: str, css_template: str = None) -> str:
        try:
            template = css_template or DEFAULT_CSS_TEMPLATE
            
            response = self.client.chat.completions.create(
                model="gpt-4-turbo-preview",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": f"{user_context}\n\nGenerate HTML content that will be wrapped in this template:\n{template}"}
                ],
                temperature=0.7,
                max_tokens=4000
            )
            
            html_content = response.choices[0].message.content
            
            if "{CONTENT}" in template:
                return template.replace("{CONTENT}", html_content)
            return html_content
            
        except Exception as e:
            raise Exception(f"OpenAI API error: {str(e)}")
    
    async def get_embedding(self, text: str) -> List[float]:
        try:
            response = self.client.embeddings.create(
                model="text-embedding-3-small",
                input=text
            )
            return response.data[0].embedding
        except Exception as e:
            raise Exception(f"OpenAI Embedding error: {str(e)}")

class GeminiService(LLMService):
    def __init__(self):
        genai.configure(api_key=settings.GEMINI_API_KEY)
        self.model = genai.GenerativeModel('gemini-1.5-pro')
    
    async def generate_response(self, system_prompt: str, user_context: str, css_template: str = None) -> str:
        try:
            template = css_template or DEFAULT_CSS_TEMPLATE
            prompt = f"{system_prompt}\n\n{user_context}\n\nGenerate HTML content that will be wrapped in this template:\n{template}"
            response = self.model.generate_content(prompt)
            html_content = response.text
            
            if "{CONTENT}" in template:
                return template.replace("{CONTENT}", html_content)
            return html_content
            
        except Exception as e:
            raise Exception(f"Gemini API error: {str(e)}")
    
    async def get_embedding(self, text: str) -> List[float]:
        try:
            result = genai.embed_content(
                model="models/embedding-001",
                content=text,
                task_type="retrieval_document"
            )
            embedding = result['embedding']
            # Pad to 1536 dimensions
            return embedding + [0.0] * (1536 - len(embedding))
        except Exception as e:
            raise Exception(f"Gemini Embedding error: {str(e)}")

def get_llm_service() -> LLMService:
    """Factory function to get the configured LLM service"""
    if settings.LLM_PROVIDER == "gemini":
        return GeminiService()
    return OpenAIService()
```

### ⛔ STOP - VERIFICATION REQUIRED

```bash
# Test OpenAI connectivity
python -c "
from llm_service import OpenAIService
import asyncio
service = OpenAIService()
embedding = asyncio.run(service.get_embedding('test'))
print(f'✅ Embedding dimension: {len(embedding)}')
assert len(embedding) == 1536, 'Wrong dimension!'
"
```

**Expected:** ✅ Embedding dimension: 1536

**DO NOT PROCEED until LLM service works.**

---

## ✋ PHASE 3: INGESTION ENGINE (RECURSIVE PROCESSING)

### Task: Build file processor with recursive archive handling

### ⚠️ CRITICAL: This MUST handle ZIP→MSG→PDF chains

#### `backend/ingestion_service.py`:

```python
import os
import tempfile
import zipfile
from typing import List
from pathlib import Path
import extract_msg
from pypdf import PdfReader
from sqlalchemy.orm import Session
from models import Document, DocumentChunk
from llm_service import get_llm_service

class IngestionService:
    def __init__(self):
        self.llm_service = get_llm_service()
    
    async def process_file(self, file_path: str, project_id: str, db: Session) -> Document:
        """Main entry point - delegates to specific handlers"""
        file_ext = Path(file_path).suffix.lower()
        
        # Create document record
        doc = Document(
            project_id=project_id,
            filename=Path(file_path).name,
            is_processed=False
        )
        db.add(doc)
        db.commit()
        db.refresh(doc)
        
        try:
            if file_ext == ".pdf":
                await self._process_pdf(file_path, doc.id, db)
            elif file_ext == ".msg":
                await self._process_msg(file_path, project_id, doc.id, db)
            elif file_ext == ".zip":
                await self._process_zip(file_path, project_id, doc.id, db)
            else:
                raise ValueError(f"Unsupported file type: {file_ext}")
            
            doc.is_processed = True
            db.commit()
            
        except Exception as e:
            db.rollback()  # CRITICAL: Rollback on failure
            raise Exception(f"Processing failed for {Path(file_path).name}: {str(e)}")
        
        return doc
    
    async def _process_pdf(self, pdf_path: str, document_id: int, db: Session):
        """Extract text from PDF and chunk"""
        reader = PdfReader(pdf_path)
        text = ""
        for page in reader.pages:
            text += page.extract_text() + "\n"
        
        if text.strip():
            await self._chunk_and_embed(text, document_id, db)
    
    async def _process_msg(self, msg_path: str, project_id: str, document_id: int, db: Session):
        """
        CRITICAL: Extract email body and recursively process attachments
        This enables MSG→PDF chains
        """
        msg = extract_msg.Message(msg_path)
        
        # Extract email body
        body = msg.body or ""
        if body.strip():
            await self._chunk_and_embed(body, document_id, db)
        
        # CRITICAL: Process attachments RECURSIVELY
        with tempfile.TemporaryDirectory() as temp_dir:
            for attachment in msg.attachments:
                att_path = os.path.join(temp_dir, attachment.longFilename or "attachment")
                with open(att_path, 'wb') as f:
                    f.write(attachment.data)
                
                # RECURSIVE CALL - This handles MSG→PDF, MSG→ZIP, etc.
                try:
                    await self.process_file(att_path, project_id, db)
                except Exception as e:
                    print(f"Warning: Failed to process attachment {attachment.longFilename}: {e}")
        
        msg.close()
    
    async def _process_zip(self, zip_path: str, project_id: str, document_id: int, db: Session):
        """
        CRITICAL: Extract ZIP and recursively process all files
        This enables ZIP→MSG→PDF chains and nested ZIPs
        """
        with tempfile.TemporaryDirectory() as temp_dir:
            with zipfile.ZipFile(zip_path, 'r') as zip_ref:
                zip_ref.extractall(temp_dir)
            
            # CRITICAL: Process all extracted files RECURSIVELY
            for root, dirs, files in os.walk(temp_dir):
                for file in files:
                    file_path = os.path.join(root, file)
                    try:
                        # RECURSIVE CALL - Handles nested archives
                        await self.process_file(file_path, project_id, db)
                    except Exception as e:
                        print(f"Warning: Failed to process {file}: {e}")
    
    async def _chunk_and_embed(self, text: str, document_id: int, db: Session):
        """Split text into chunks and generate embeddings"""
        chunk_size = 2000  # ~500 tokens
        overlap = 200      # ~50 tokens
        
        chunks = []
        for i in range(0, len(text), chunk_size - overlap):
            chunk_text = text[i:i + chunk_size]
            if chunk_text.strip():
                chunks.append(chunk_text)
        
        # Generate embeddings and store
        for chunk_text in chunks:
            try:
                embedding = await self.llm_service.get_embedding(chunk_text)
                
                chunk = DocumentChunk(
                    document_id=document_id,
                    content=chunk_text,
                    embedding=embedding
                )
                db.add(chunk)
            except Exception as e:
                print(f"Warning: Failed to embed chunk: {e}")
        
        db.commit()
```

### ⛔ STOP - VERIFICATION REQUIRED

**Test recursive processing:**

```python
# Create test files:
# 1. Create test.pdf with text
# 2. Create email.msg containing test.pdf as attachment
# 3. Create archive.zip containing email.msg

# Upload archive.zip to a test project
# Verify:
# - 3 Document records created (zip, msg, pdf)
# - DocumentChunk records exist for PDF text
# - All documents have is_processed=True
```

**DO NOT PROCEED until nested archive test passes.**

---

## ✋ PHASE 4: RAG RETRIEVAL ENGINE (LEARNING MECHANISM)

### Task: Implement context retrieval that learns from past wins

### ⚠️ THIS IS THE MOST CRITICAL COMPONENT

#### `backend/rag_service.py`:

```python
from typing import List, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import text
from models import DocumentChunk, Document, Project, ProjectStatus
from llm_service import get_llm_service

class RAGService:
    def __init__(self):
        self.llm_service = get_llm_service()
    
    async def retrieve_context(
        self,
        query: str,
        current_project_id: str,
        db: Session,
        top_k: int = 10
    ) -> List[Tuple[str, float]]:
        """
        ⚠️ CRITICAL: Retrieve from BOTH current project AND Closed-Won projects
        This is THE LEARNING MECHANISM - DO NOT MODIFY THIS LOGIC
        """
        # Get query embedding
        query_embedding = await self.llm_service.get_embedding(query)
        
        # Format embedding for PostgreSQL
        embedding_str = "[" + ",".join(map(str, query_embedding)) + "]"
        
        # ⚠️ CRITICAL SQL QUERY - BOTH CONDITIONS REQUIRED
        sql = text("""
            SELECT 
                dc.content,
                dc.embedding <=> :query_embedding AS distance,
                p.name as project_name,
                p.status
            FROM document_chunks dc
            JOIN documents d ON dc.document_id = d.id
            JOIN projects p ON d.project_id = p.id
            WHERE (
                p.id = :current_project_id          -- Current project documents
                OR
                p.status = :closed_won_status       -- ⚠️ CRITICAL: Historical winners
            )
            ORDER BY distance ASC
            LIMIT :top_k
        """)
        
        result = db.execute(sql, {
            "query_embedding": embedding_str,
            "current_project_id": str(current_project_id),
            "closed_won_status": ProjectStatus.CLOSED_WON.value,
            "top_k": top_k
        })
        
        chunks = []
        for row in result:
            chunks.append((row.content, row.distance))
        
        return chunks
```

### ⛔ STOP - VERIFICATION REQUIRED

**Test learning mechanism:**

```python
# 1. Create Project A with status='Active', upload document
# 2. Create Project B with status='Closed-Won', upload document
# 3. Generate bid for Project A
# 4. Check logs/database to verify chunks from BOTH projects were retrieved

# Expected: SQL query returns chunks from Project A AND Project B
```

**Verification command:**
```sql
-- Should return chunks from multiple projects
SELECT DISTINCT p.name, p.status 
FROM document_chunks dc
JOIN documents d ON dc.document_id = d.id
JOIN projects p ON d.project_id = p.id;
```

**DO NOT PROCEED until you confirm chunks from Closed-Won projects are retrieved.**

---

## ✋ PHASE 5: BACKEND API ROUTES

### Task: Create FastAPI endpoints

#### `backend/routes.py`:

```python
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional
import tempfile
import os
from pydantic import BaseModel

from database import get_db
from models import Project, ProjectStatus, Document
from ingestion_service import IngestionService
from rag_service import RAGService
from llm_service import get_llm_service
from config import DEFAULT_CSS_TEMPLATE

router = APIRouter()

class ProjectCreate(BaseModel):
    name: str
    client_name: str

class GenerateRequest(BaseModel):
    user_instructions: str
    tone: str = "professional"

class RefineRequest(BaseModel):
    current_html: str
    feedback: str

@router.post("/projects")
async def create_project(project: ProjectCreate, db: Session = Depends(get_db)):
    new_project = Project(
        name=project.name,
        client_name=project.client_name,
        status=ProjectStatus.ACTIVE
    )
    db.add(new_project)
    db.commit()
    db.refresh(new_project)
    return new_project

@router.get("/projects")
async def list_projects(db: Session = Depends(get_db)):
    projects = db.query(Project).order_by(Project.created_at.desc()).all()
    return projects

@router.get("/projects/{project_id}")
async def get_project(project_id: str, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project

@router.post("/projects/{project_id}/upload")
async def upload_file(
    project_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    # Validate file type
    allowed_extensions = [".pdf", ".msg", ".zip"]
    file_ext = os.path.splitext(file.filename)[1].lower()
    
    if file_ext not in allowed_extensions:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type. Allowed: {', '.join(allowed_extensions)}"
        )
    
    # Save file temporarily
    with tempfile.NamedTemporaryFile(delete=False, suffix=file_ext) as temp_file:
        content = await file.read()
        temp_file.write(content)
        temp_path = temp_file.name
    
    try:
        ingestion_service = IngestionService()
        document = await ingestion_service.process_file(temp_path, project_id, db)
        
        return {
            "message": "File uploaded and processed successfully",
            "document_id": document.id,
            "filename": document.filename,
            "is_processed": document.is_processed
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if os.path.exists(temp_path):
            os.unlink(temp_path)

@router.post("/projects/{project_id}/generate")
async def generate_bid(
    project_id: str,
    request: GenerateRequest,
    db: Session = Depends(get_db)
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    try:
        # ⚠️ CRITICAL: RAG retrieval includes Closed-Won projects
        rag_service = RAGService()
        chunks = await rag_service.retrieve_context(
            query=request.user_instructions,
            current_project_id=project_id,
            db=db,
            top_k=10
        )
        
        context_text = "\n\n".join([f"[Chunk {i+1}]: {chunk[0]}" for i, chunk in enumerate(chunks)])
        
        system_prompt = f"""You are an expert construction bid writer. 
Create a professional, compelling bid response based on the provided context.
Tone: {request.tone}
Generate well-structured HTML content with headings, paragraphs, and tables as needed."""
        
        user_context = f"""User Instructions: {request.user_instructions}

Relevant Context from Documents and Past Winning Bids:
{context_text}

Generate a complete bid response."""
        
        llm_service = get_llm_service()
        html_response = await llm_service.generate_response(
            system_prompt=system_prompt,
            user_context=user_context,
            css_template=DEFAULT_CSS_TEMPLATE
        )
        
        return {
            "html": html_response,
            "chunks_used": len(chunks)
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Generation failed: {str(e)}")

@router.post("/projects/{project_id}/refine")
async def refine_bid(
    project_id: str,
    request: RefineRequest,
    db: Session = Depends(get_db)
):
    try:
        system_prompt = """You are an expert construction bid writer. 
Apply the user's feedback to improve the bid response.
Maintain the HTML structure and styling."""
        
        user_context = f"""Current Bid HTML:
{request.current_html}

User Feedback: {request.feedback}

Apply the feedback and return the updated complete HTML."""
        
        llm_service = get_llm_service()
        refined_html = await llm_service.generate_response(
            system_prompt=system_prompt,
            user_context=user_context
        )
        
        return {"html": refined_html}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Refinement failed: {str(e)}")

@router.get("/dashboard/stats")
async def get_dashboard_stats(db: Session = Depends(get_db)):
    pipeline = db.query(
        Project.status,
        func.count(Project.id).label('count')
    ).group_by(Project.status).all()
    
    pipeline_dict = {status.value: 0 for status in ProjectStatus}
    for status, count in pipeline:
        pipeline_dict[status.value] = count
    
    closed_won = pipeline_dict.get(ProjectStatus.CLOSED_WON.value, 0)
    closed_lost = pipeline_dict.get(ProjectStatus.CLOSED_LOST.value, 0)
    total_closed = closed_won + closed_lost
    
    win_rate = (closed_won / total_closed * 100) if total_closed > 0 else 0
    
    return {
        "pipeline": pipeline_dict,
        "win_rate": round(win_rate, 1),
        "total_projects": sum(pipeline_dict.values())
    }
```

#### `backend/main.py`:

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

from routes import router

app = FastAPI(title="BidForge AI API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router, prefix="/api")

@app.get("/")
async def root():
    return {"message": "BidForge AI API is running"}

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
```

### ⛔ STOP - VERIFICATION REQUIRED

```bash
# Start backend
cd backend
uvicorn main:app --reload

# Test endpoints
curl http://localhost:8000/health
curl http://localhost:8000/api/dashboard/stats

# Expected: {"status": "healthy"} and valid stats
```

**DO NOT PROCEED until API is responding.**

---

## ✋ PHASE 6: FRONTEND IMPLEMENTATION

### Task: Build Next.js 14 interface with Tiptap editor

**I will provide complete frontend code in the next message due to length constraints.**

Key components to implement:
1. Three-panel workspace layout
2. Tiptap editor with drag-and-drop blocks
3. Dashboard with charts
4. File upload with drag-and-drop

### ⛔ FINAL VERIFICATION CHECKLIST

Before considering the system complete, YOU MUST verify:

- [ ] Upload PDF → See chunks in database
- [ ] Upload MSG with PDF attachment → Both processed
- [ ] Upload ZIP with nested files → All extracted and processed
- [ ] Create project with status='Closed-Won' → Add documents
- [ ] Generate bid for NEW project → Verify chunks from Closed-Won project included
- [ ] Dashboard win rate calculation correct
- [ ] Refine endpoint modifies HTML correctly
- [ ] Tiptap editor displays generated HTML
- [ ] Can switch LLM_PROVIDER between openai/gemini

---

# START NOW

**Begin by executing Phase 1. Create the database models and verify pgvector is enabled.**

**Do not skip any verification steps. Each phase builds on the previous one.**

**Your goal: A working BidForge AI system that can learn from past winning bids.**
