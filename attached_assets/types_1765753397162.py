"""
BidForge AI - Type Definitions and Pydantic Models
Shared types across all agents
"""

from typing import Dict, Any, List, Optional, TypedDict
from pydantic import BaseModel, Field, field_validator
from datetime import datetime
from enum import Enum


class DocumentType(str, Enum):
    """Construction document types."""
    ARCHITECTURAL = "architectural"
    STRUCTURAL = "structural"
    MEP = "MEP"
    ELECTRICAL = "electrical"
    MECHANICAL = "mechanical"
    PLUMBING = "plumbing"
    CIVIL = "civil"
    LANDSCAPE = "landscape"
    UNKNOWN = "unknown"


class ProjectPhase(str, Enum):
    """Project development phases."""
    CONCEPT = "concept"
    SCHEMATIC = "schematic"
    DESIGN_DEVELOPMENT = "design_development"
    CONSTRUCTION_DOCUMENTS = "construction_documents"
    TENDER = "tender"
    CONSTRUCTION = "construction"
    UNKNOWN = "unknown"


class SketchMetadata(BaseModel):
    """Metadata for uploaded sketch."""
    sketch_id: str
    filename: str
    upload_timestamp: datetime = Field(default_factory=datetime.now)
    file_size: int  # bytes
    format: str  # PNG, JPG, PDF
    dimensions: tuple[int, int]  # (width, height)
    rfp_id: Optional[str] = None
    project_id: Optional[str] = None
    user_id: Optional[str] = None


class DimensionData(BaseModel):
    """Extracted dimension information."""
    type: str  # wall_length, room_area, ceiling_height, etc.
    value: float
    unit: str  # m, mm, sqm, cum, etc.
    location: Optional[str] = None
    reference: Optional[str] = None  # Grid reference, room number, etc.
    confidence: float = Field(ge=0, le=100, default=80.0)


class MaterialData(BaseModel):
    """Extracted material specification."""
    name: str
    category: Optional[str] = None  # concrete, steel, finishes, etc.
    grade: Optional[str] = None
    specification: Optional[str] = None
    quantity: Optional[float] = None
    unit: Optional[str] = None
    supplier: Optional[str] = None
    standard: Optional[str] = None  # ASTM, BS, DIN, etc.
    confidence: float = Field(ge=0, le=100, default=80.0)


class ComponentData(BaseModel):
    """Extracted component information."""
    type: str  # column, beam, slab, door, window, etc.
    name: Optional[str] = None
    size: Optional[str] = None  # dimensions
    count: Optional[int] = None
    location: Optional[str] = None
    specification: Optional[str] = None
    material: Optional[str] = None
    confidence: float = Field(ge=0, le=100, default=80.0)


class SketchAnalysisOutput(BaseModel):
    """Standardized output from sketch analysis."""
    sketch_id: str
    document_type: DocumentType
    project_phase: ProjectPhase
    
    # Core extracted data
    dimensions: List[DimensionData] = Field(default_factory=list)
    materials: List[MaterialData] = Field(default_factory=list)
    specifications: List[str] = Field(default_factory=list)
    components: List[ComponentData] = Field(default_factory=list)
    quantities: Dict[str, Any] = Field(default_factory=dict)
    
    # Compliance & Standards
    standards: List[str] = Field(default_factory=list)
    regional_codes: List[str] = Field(default_factory=list)
    
    # Annotations and notes
    annotations: List[str] = Field(default_factory=list)
    revisions: List[Dict[str, str]] = Field(default_factory=list)
    
    # Analysis metadata
    confidence_score: float = Field(ge=0, le=100)
    processing_time: float  # seconds
    notes: str = ""
    warnings: List[str] = Field(default_factory=list)
    
    # For RAG integration
    embeddings_ready: bool = False
    vector_ids: List[str] = Field(default_factory=list)
    
    # Timestamps
    analyzed_at: datetime = Field(default_factory=datetime.now)
    
    @field_validator('confidence_score')
    @classmethod
    def validate_confidence(cls, v: float) -> float:
        """Ensure confidence is between 0 and 100."""
        return max(0.0, min(100.0, v))


class AgentState(TypedDict):
    """State shared across LangGraph agents."""
    # Messages for agent communication
    messages: List[Any]
    
    # Sketch data
    sketch_metadata: List[SketchMetadata]
    analysis_results: List[SketchAnalysisOutput]
    
    # Extracted and aggregated data
    extracted_data: Dict[str, Any]
    
    # Vector embeddings
    embeddings: List[str]  # Text ready for embedding
    vector_ids: List[str]  # IDs from vector store
    
    # Workflow control
    next_agent: str
    decision: Optional[str]
    
    # RFP context
    rfp_id: Optional[str]
    rfp_text: Optional[str]
    project_context: Optional[str]
    
    # Results
    final_response: Optional[str]
    
    # Error handling
    error: Optional[str]
    retry_count: int


class JobStatus(str, Enum):
    """Processing job statuses."""
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class ProcessingJob(BaseModel):
    """Background job tracking."""
    job_id: str
    status: JobStatus
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    completed_at: Optional[datetime] = None
    
    # Job details
    job_type: str  # sketch_analysis, rfp_generation, etc.
    input_data: Dict[str, Any]
    result: Optional[Dict[str, Any]] = None
    error_message: Optional[str] = None
    
    # Progress tracking
    progress_percent: int = Field(ge=0, le=100, default=0)
    current_step: Optional[str] = None
    total_steps: Optional[int] = None
    
    # Resource tracking
    processing_time: Optional[float] = None  # seconds
    cost: Optional[float] = None  # USD


class APIResponse(BaseModel):
    """Standard API response format."""
    success: bool
    message: str
    data: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.now)


class SketchUploadRequest(BaseModel):
    """Request model for sketch upload."""
    context: Optional[str] = None
    rfp_id: Optional[str] = None
    project_id: Optional[str] = None
    async_processing: bool = True


class SketchUploadResponse(BaseModel):
    """Response model for sketch upload."""
    success: bool
    job_id: str
    message: str
    sketches_count: int
    status_url: str
    estimated_time: Optional[int] = None  # seconds


class AnalysisRequest(BaseModel):
    """Request for synchronous analysis."""
    context: Optional[str] = None
    detail_level: str = "high"  # low, medium, high


class RAGDocument(BaseModel):
    """Document format for RAG system."""
    id: str
    content: str
    metadata: Dict[str, Any]
    embedding: Optional[List[float]] = None
    
    # Source tracking
    source_type: str  # sketch, rfp, company_data, etc.
    source_id: str
    created_at: datetime = Field(default_factory=datetime.now)


class VectorSearchQuery(BaseModel):
    """Query for vector similarity search."""
    query_text: str
    limit: int = Field(ge=1, le=100, default=5)
    filter_metadata: Optional[Dict[str, Any]] = None
    min_similarity: float = Field(ge=0, le=1, default=0.7)
    source_types: Optional[List[str]] = None


class VectorSearchResult(BaseModel):
    """Result from vector search."""
    documents: List[RAGDocument]
    similarities: List[float]
    total_found: int
    query_time: float  # seconds
