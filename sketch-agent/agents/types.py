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


class SketchDimension(BaseModel):
    """Extracted dimension from construction drawing."""
    type: str = Field(..., description="Type: length, width, height, radius, etc.")
    value: float = Field(..., description="Numeric value")
    unit: str = Field(..., description="Unit: m, mm, ft, in, etc.")
    location: Optional[str] = Field(None, description="Where this dimension appears")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Extraction confidence 0-1")


class SketchMaterial(BaseModel):
    """Material specification extracted from drawing."""
    name: str = Field(..., description="Material name (e.g., 'Concrete', 'Steel')")
    grade: Optional[str] = Field(None, description="Material grade (e.g., 'C30', 'Grade 60')")
    specification: Optional[str] = Field(None, description="Full specification")
    quantity: Optional[float] = Field(None, description="Quantity if specified")
    unit: Optional[str] = Field(None, description="Unit for quantity")
    standard: Optional[str] = Field(None, description="Standard (e.g., 'ASTM A615')")
    confidence: float = Field(..., ge=0.0, le=1.0)


class SketchComponent(BaseModel):
    """Building component identified in drawing."""
    type: str = Field(..., description="Component type (e.g., 'column', 'beam', 'wall')")
    size: Optional[str] = Field(None, description="Size specification")
    count: Optional[int] = Field(None, description="Number of instances")
    location: Optional[str] = Field(None, description="Location description")
    confidence: float = Field(..., ge=0.0, le=1.0)


class SketchAnalysisResult(BaseModel):
    """Complete analysis result for a construction drawing."""
    sketch_id: str
    document_type: str = Field(
        ...,
        description="Type: architectural, structural, MEP, civil, landscape, site_plan"
    )
    project_phase: str = Field(
        ...,
        description="Phase: schematic, design_development, construction_documents, shop_drawings"
    )
    dimensions: list[SketchDimension] = Field(default_factory=list)
    materials: list[SketchMaterial] = Field(default_factory=list)
    specifications: list[str] = Field(default_factory=list, description="Text specifications")
    components: list[SketchComponent] = Field(default_factory=list)
    quantities: dict[str, Any] = Field(
        default_factory=dict,
        description="Quantity takeoff: {'concrete_volume': 150, 'rebar_weight': 5000}"
    )
    standards: list[str] = Field(
        default_factory=list,
        description="Building codes/standards: ['UAE Fire Code', 'Dubai Building Code']"
    )
    regional_codes: list[str] = Field(
        default_factory=list,
        description="GCC-specific codes: ['Dubai Municipality', 'Saudi Building Code']"
    )
    annotations: list[str] = Field(
        default_factory=list,
        description="Text annotations found on drawing"
    )
    revisions: list[dict] = Field(
        default_factory=list,
        description="Revision history if visible"
    )
    confidence_score: float = Field(..., ge=0.0, le=1.0, description="Overall confidence")
    processing_time: float = Field(..., description="Processing time in seconds")
    notes: str = Field(default="", description="Additional notes about the analysis")
    warnings: list[str] = Field(
        default_factory=list,
        description="Warnings about ambiguities or quality issues"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "sketch_id": "sketch_123",
                "document_type": "structural",
                "project_phase": "construction_documents",
                "dimensions": [
                    {
                        "type": "length",
                        "value": 12.5,
                        "unit": "m",
                        "location": "Main span",
                        "confidence": 0.95
                    }
                ],
                "materials": [
                    {
                        "name": "Concrete",
                        "grade": "C40",
                        "standard": "BS EN 206",
                        "confidence": 0.9
                    }
                ],
                "confidence_score": 0.88,
                "processing_time": 3.2
            }
        }
