"""Pydantic models for sketch analysis data structures."""

from pydantic import BaseModel, Field
from typing import Optional, Any
from datetime import datetime


class SketchMetadata(BaseModel):
    """Metadata about the uploaded sketch/drawing."""
    sketch_id: str
    filename: str
    file_size: int
    dimensions: tuple[int, int]
    uploaded_at: Optional[datetime] = None


class InferredCapacity(BaseModel):
    """Inferred capacity from the drawing."""
    value: Optional[int] = Field(None, description="Numeric capacity value")
    unit: Optional[str] = Field(None, description="Capacity unit")
    reasoning: Optional[str] = Field(None, description="How capacity was derived")


class ContextLayer(BaseModel):
    """Context and purpose information about the drawing."""
    document_type: Optional[str] = Field(None, description="Document type (e.g., 'Architectural Construction Drawing')")
    description: Optional[str] = Field(None, description="Detailed description of the drawing")
    inferred_capacity: Optional[InferredCapacity] = None
    compliance_note: Optional[str] = Field(None, description="Compliance requirements")
    purpose: Optional[str] = Field(None, description="Primary purpose")
    key_features: list[str] = Field(default_factory=list, description="Key features")


class Personnel(BaseModel):
    """Personnel information from title block."""
    drawn_by: Optional[str] = None
    checked_by: Optional[str] = None
    approved_by: Optional[str] = None
    client: Optional[str] = None
    consultant: Optional[str] = None
    contractor: Optional[str] = None


class ProjectMetadata(BaseModel):
    """Project metadata from title block."""
    project_title: Optional[str] = None
    project_number: Optional[str] = None
    revision: Optional[str] = None
    status: Optional[str] = None
    date: Optional[str] = None
    scale: Optional[str] = None
    personnel: Optional[Personnel] = None
    drawing_number: Optional[str] = None
    sheet_of: Optional[str] = None


class DetailedDimension(BaseModel):
    """Detailed dimension with labels and view references."""
    label: Optional[str] = Field(None, description="Descriptive label (e.g., 'Overall Footprint Length')")
    value: Optional[float] = Field(None, description="Numeric value")
    unit: Optional[str] = Field(None, description="Unit: m, mm, ft, in, etc.")
    views: list[str] = Field(default_factory=list, description="Views where dimension appears")
    derived_from: Optional[str] = Field(None, description="Derivation if calculated")
    location: Optional[str] = Field(None, description="Location in drawing")
    confidence: Optional[float] = Field(None, ge=0.0, le=1.0)


class DetailedMaterial(BaseModel):
    """Detailed material specification."""
    component: Optional[str] = Field(None, description="Component name")
    spec: Optional[str] = Field(None, description="Full specification")
    location: Optional[str] = Field(None, description="Where used")
    grade: Optional[str] = None
    standard: Optional[str] = None
    quantity: Optional[float] = None
    unit: Optional[str] = None
    finish: Optional[str] = None
    color: Optional[str] = None


class DetailedComponent(BaseModel):
    """Detailed component information."""
    type: Optional[str] = Field(None, description="Component type")
    description: Optional[str] = Field(None, description="Detailed description")
    size: Optional[str] = Field(None, description="Size specification")
    count: Optional[int] = Field(None, description="Number of instances")
    location: Optional[str] = Field(None, description="Location description")
    material: Optional[str] = Field(None, description="Material used")
    connection_type: Optional[str] = Field(None, description="Connection type")


class Quantities(BaseModel):
    """Quantity takeoff values."""
    concrete_volume_m3: Optional[float] = 0
    steel_weight_kg: Optional[float] = 0
    fabric_area_m2: Optional[float] = 0
    paint_area_m2: Optional[float] = 0
    foundation_count: Optional[int] = 0


class TechnicalData(BaseModel):
    """Technical data including dimensions, materials, and components."""
    dimensions: list[DetailedDimension] = Field(default_factory=list)
    materials: list[DetailedMaterial] = Field(default_factory=list)
    components: list[DetailedComponent] = Field(default_factory=list)
    quantities: Optional[Quantities] = None


class RevisionInfo(BaseModel):
    """Revision information."""
    revision: Optional[str] = None
    date: Optional[str] = None
    description: Optional[str] = None


class SketchAnalysisResult(BaseModel):
    """Complete analysis result for a construction drawing with new detailed schema."""
    sketch_id: Optional[str] = None
    
    # New nested structure
    context_layer: Optional[ContextLayer] = None
    project_metadata: Optional[ProjectMetadata] = None
    technical_data: Optional[TechnicalData] = None
    
    # Flat fields for compatibility
    specifications: list[str] = Field(default_factory=list, description="Text specifications")
    standards: list[str] = Field(default_factory=list)
    regional_codes: list[str] = Field(default_factory=list)
    annotations: list[str] = Field(default_factory=list)
    views_included: list[str] = Field(default_factory=list)
    revisions: list[RevisionInfo] = Field(default_factory=list)
    confidence_score: Optional[float] = Field(None, ge=0.0, le=1.0)
    processing_time: Optional[float] = None
    notes: Optional[str] = Field(None, description="Additional notes")
    warnings: list[str] = Field(default_factory=list)

    class Config:
        extra = "allow"
