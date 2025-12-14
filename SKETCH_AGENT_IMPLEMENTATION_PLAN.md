# BidForge AI - Sketch Agent Integration Implementation Plan

**Goal**: Integrate Python sketch analysis agent into existing Node.js/Express BidForge AI application

**Timeline**: 3 days
**Architecture**: Single Repl (Node.js calls Python subprocess)
**Trigger**: Conditional (only when images uploaded - saves 50-80% costs)

---

## 📊 Current State Analysis

### Existing BidForge AI Architecture
- ✅ Express.js + TypeScript backend
- ✅ Multi-agent system (LangChain/LangGraph)
- ✅ PostgreSQL + pgvector
- ✅ Document processing (PDF, MSG, ZIP)
- ✅ File uploads with Multer → `uploads/` directory
- ✅ AI providers: OpenAI, Anthropic, Gemini, DeepSeek

### What We're Adding
- 🆕 Python sketch analysis agent (`sketch-agent/`)
- 🆕 Vision AI capabilities (construction drawing analysis)
- 🆕 5 vision providers (OpenAI GPT-4o, Claude 3.5, Gemini 2.0, DeepSeek, Qwen)
- 🆕 GCC building standards detection (UAE, Saudi, Dubai codes)
- 🆕 Node.js ↔ Python communication via child_process
- 🆕 Conditional triggering (only when images present)

---

## 🎯 Implementation Phases

## PHASE 1: Python Foundation (Day 1 - Morning)

### 1.1 Create Folder Structure

```bash
cd /c/Users/belka/Replit_BidForgeAI

# Create Python agent directory structure
mkdir -p sketch-agent/agents
mkdir -p sketch-agent/services
mkdir -p sketch-agent/utils
mkdir -p sketch-agent/prompts
mkdir -p sketch-agent/tests

# Create __init__.py files
touch sketch-agent/__init__.py
touch sketch-agent/agents/__init__.py
touch sketch-agent/services/__init__.py
touch sketch-agent/utils/__init__.py
```

### 1.2 Create requirements.txt

**File**: `sketch-agent/requirements.txt`

```txt
# Core
pydantic==2.5.0
pillow==10.1.0
python-dotenv==1.0.0
asyncio==3.4.3

# Vision Providers
openai==1.12.0
anthropic==0.18.1
google-generativeai==0.3.2

# Note: DeepSeek uses OpenAI SDK with base_url override
# Note: Qwen uses DashScope (OpenAI-compatible)

# Optional: Database
psycopg2-binary==2.9.9
pgvector==0.2.4

# Testing
pytest==7.4.0
pytest-asyncio==0.21.1
```

### 1.3 Install Python Dependencies

```bash
cd sketch-agent
python3 -m pip install -r requirements.txt
```

---

## PHASE 2: Pydantic Models (Day 1 - Morning)

### 2.1 Create Type Definitions

**File**: `sketch-agent/agents/types.py`

```python
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
```

---

## PHASE 3: Vision Providers (Day 1 - Afternoon)

### 3.1 Create Vision Provider Interface

**File**: `sketch-agent/agents/vision_providers.py`

```python
from typing import Protocol, Optional
from PIL import Image
import base64
import io
import os
from openai import AsyncOpenAI
from anthropic import AsyncAnthropic
from google import generativeai as genai


class VisionModelProtocol(Protocol):
    """Abstract interface for vision model providers."""

    async def analyze_image(
        self,
        image: Image.Image,
        prompt: str,
        max_tokens: int = 4000,
        temperature: float = 0.1
    ) -> str:
        """Analyze an image and return text response."""
        ...


class OpenAIVisionModel:
    """OpenAI GPT-4o Vision implementation."""

    def __init__(self, api_key: Optional[str] = None, model: str = "gpt-4o"):
        self.api_key = api_key or os.getenv("OPENAI_API_KEY")
        if not self.api_key:
            raise ValueError("OPENAI_API_KEY not found")

        self.client = AsyncOpenAI(api_key=self.api_key)
        self.model = model

    def _image_to_base64(self, image: Image.Image) -> str:
        """Convert PIL Image to base64 string."""
        buffer = io.BytesIO()
        image.save(buffer, format="PNG")
        return base64.b64encode(buffer.getvalue()).decode()

    async def analyze_image(
        self,
        image: Image.Image,
        prompt: str,
        max_tokens: int = 4000,
        temperature: float = 0.1
    ) -> str:
        base64_image = self._image_to_base64(image)

        response = await self.client.chat.completions.create(
            model=self.model,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/png;base64,{base64_image}",
                                "detail": "high"
                            }
                        }
                    ]
                }
            ],
            max_tokens=max_tokens,
            temperature=temperature
        )

        return response.choices[0].message.content or ""


class AnthropicVisionModel:
    """Anthropic Claude 3.5 Sonnet Vision implementation."""

    def __init__(self, api_key: Optional[str] = None, model: str = "claude-3-5-sonnet-20241022"):
        self.api_key = api_key or os.getenv("ANTHROPIC_API_KEY")
        if not self.api_key:
            raise ValueError("ANTHROPIC_API_KEY not found")

        self.client = AsyncAnthropic(api_key=self.api_key)
        self.model = model

    def _image_to_base64(self, image: Image.Image) -> str:
        buffer = io.BytesIO()
        image.save(buffer, format="PNG")
        return base64.b64encode(buffer.getvalue()).decode()

    async def analyze_image(
        self,
        image: Image.Image,
        prompt: str,
        max_tokens: int = 4000,
        temperature: float = 0.1
    ) -> str:
        base64_image = self._image_to_base64(image)

        response = await self.client.messages.create(
            model=self.model,
            max_tokens=max_tokens,
            temperature=temperature,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": "image/png",
                                "data": base64_image
                            }
                        },
                        {
                            "type": "text",
                            "text": prompt
                        }
                    ]
                }
            ]
        )

        content = response.content[0]
        return content.text if content.type == "text" else ""


class GeminiVisionModel:
    """Google Gemini 2.0 Flash Vision implementation."""

    def __init__(self, api_key: Optional[str] = None, model: str = "gemini-2.0-flash-exp"):
        self.api_key = api_key or os.getenv("GOOGLE_GENERATIVE_AI_API_KEY")
        if not self.api_key:
            raise ValueError("GOOGLE_GENERATIVE_AI_API_KEY not found")

        genai.configure(api_key=self.api_key)
        self.model = genai.GenerativeModel(model)

    async def analyze_image(
        self,
        image: Image.Image,
        prompt: str,
        max_tokens: int = 4000,
        temperature: float = 0.1
    ) -> str:
        generation_config = {
            "max_output_tokens": max_tokens,
            "temperature": temperature
        }

        response = await self.model.generate_content_async(
            [prompt, image],
            generation_config=generation_config
        )

        return response.text


class DeepSeekVisionModel:
    """DeepSeek Vision (OpenAI-compatible) implementation."""

    def __init__(self, api_key: Optional[str] = None, model: str = "deepseek-chat"):
        self.api_key = api_key or os.getenv("DEEPSEEK_API_KEY")
        if not self.api_key:
            raise ValueError("DEEPSEEK_API_KEY not found")

        self.client = AsyncOpenAI(
            api_key=self.api_key,
            base_url="https://api.deepseek.com"
        )
        self.model = model

    def _image_to_base64(self, image: Image.Image) -> str:
        buffer = io.BytesIO()
        image.save(buffer, format="PNG")
        return base64.b64encode(buffer.getvalue()).decode()

    async def analyze_image(
        self,
        image: Image.Image,
        prompt: str,
        max_tokens: int = 4000,
        temperature: float = 0.1
    ) -> str:
        base64_image = self._image_to_base64(image)

        response = await self.client.chat.completions.create(
            model=self.model,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/png;base64,{base64_image}"
                            }
                        }
                    ]
                }
            ],
            max_tokens=max_tokens,
            temperature=temperature
        )

        return response.choices[0].message.content or ""


class QwenVisionModel:
    """Qwen VL (DashScope API) implementation."""

    def __init__(self, api_key: Optional[str] = None, model: str = "qwen-vl-max"):
        self.api_key = api_key or os.getenv("DASHSCOPE_API_KEY")
        if not self.api_key:
            raise ValueError("DASHSCOPE_API_KEY not found")

        # Qwen uses OpenAI-compatible API via DashScope
        self.client = AsyncOpenAI(
            api_key=self.api_key,
            base_url="https://dashscope.aliyuncs.com/compatible-mode/v1"
        )
        self.model = model

    def _image_to_base64(self, image: Image.Image) -> str:
        buffer = io.BytesIO()
        image.save(buffer, format="PNG")
        return base64.b64encode(buffer.getvalue()).decode()

    async def analyze_image(
        self,
        image: Image.Image,
        prompt: str,
        max_tokens: int = 4000,
        temperature: float = 0.1
    ) -> str:
        base64_image = self._image_to_base64(image)

        response = await self.client.chat.completions.create(
            model=self.model,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/png;base64,{base64_image}"
                            }
                        }
                    ]
                }
            ],
            max_tokens=max_tokens,
            temperature=temperature
        )

        return response.choices[0].message.content or ""


class VisionModelFactory:
    """Factory for creating vision model instances."""

    PROVIDERS = {
        "openai": OpenAIVisionModel,
        "anthropic": AnthropicVisionModel,
        "gemini": GeminiVisionModel,
        "deepseek": DeepSeekVisionModel,
        "qwen": QwenVisionModel
    }

    @staticmethod
    def create(provider: str, model: Optional[str] = None) -> VisionModelProtocol:
        """Create a vision model instance.

        Args:
            provider: Provider name (openai, anthropic, gemini, deepseek, qwen)
            model: Optional model name override

        Returns:
            Vision model instance

        Raises:
            ValueError: If provider not supported
        """
        provider = provider.lower()

        if provider not in VisionModelFactory.PROVIDERS:
            raise ValueError(
                f"Unsupported provider: {provider}. "
                f"Supported: {', '.join(VisionModelFactory.PROVIDERS.keys())}"
            )

        provider_class = VisionModelFactory.PROVIDERS[provider]

        if model:
            return provider_class(model=model)
        else:
            return provider_class()
```

---

## PHASE 4: System Prompt (Day 1 - Afternoon)

### 4.1 Create Vision Analysis Prompt

**File**: `sketch-agent/prompts/sketch_analysis_system.md`

```markdown
# Construction Drawing Analysis System

You are an expert construction drawing analyzer specializing in GCC (Gulf Cooperation Council) markets, particularly UAE, Saudi Arabia, Qatar, and other Middle Eastern countries.

## Your Role

Analyze construction drawings, sketches, diagrams, and technical documents to extract:
1. **Dimensions** - All measurements with units and locations
2. **Materials** - Material specifications, grades, and standards
3. **Components** - Building elements (columns, beams, walls, etc.)
4. **Specifications** - Technical requirements and notes
5. **Standards** - Applicable building codes and regulations
6. **Quantities** - Material quantities for estimation

## GCC-Specific Considerations

### Building Codes & Standards
- **UAE Fire Code** (UAE Civil Defense requirements)
- **Dubai Building Code** (Dubai Municipality regulations)
- **Dubai Municipality Standards**
- **Saudi Building Code (SBC)** (KSA construction standards)
- **Qatar Construction Specifications (QCS)**
- **Abu Dhabi International Building Code**
- **Sharjah Building Code**

### Regional Standards
- **British Standards (BS)** - Commonly used in GCC
- **American Standards (ASTM)** - For materials
- **European Standards (EN)** - For specific products
- **Gulf Standards (GSO)** - Pan-GCC standards

### Language Support
- **Arabic annotations** - Detect, translate, and include in analysis
- **Bilingual drawings** - Handle English/Arabic mixed content
- **RTL text** - Recognize right-to-left annotations

### Unit Systems
- **Metric primary** - mm, m, m², m³ (most common in GCC)
- **Imperial secondary** - ft, in (occasionally used)
- **Convert when needed** - Provide both metric and imperial if specified

## Document Types

Classify drawings as:
- **Architectural** - Floor plans, elevations, sections, details
- **Structural** - Foundation, columns, beams, slabs, reinforcement
- **MEP** - Mechanical, Electrical, Plumbing systems
- **Civil** - Site plans, grading, drainage
- **Landscape** - Landscape design, irrigation
- **Shop Drawings** - Fabrication details

## Project Phases

Identify phase:
- **Schematic Design** - Preliminary concepts
- **Design Development** - Refined design
- **Construction Documents** - Detailed specifications
- **Shop Drawings** - Fabrication-ready details

## Extraction Requirements

### Dimensions
- Extract ALL visible dimensions
- Include units (mm, m, ft, in)
- Note location/context
- Provide confidence score (0.0-1.0)

### Materials
- Material name (e.g., "Concrete", "Steel", "Blockwork")
- Grade/strength (e.g., "C40", "Grade 60")
- Specification (e.g., "BS EN 206")
- Quantity if specified
- Standard references (ASTM, BS, EN)

### Components
- Type (column, beam, wall, slab, etc.)
- Size specifications
- Count/quantity
- Location description

### Specifications
- All text specifications visible on drawing
- Notes and callouts
- General notes section
- Special requirements

### Building Codes
- Identify mentioned codes (e.g., "As per UAE Fire Code")
- Compliance notes
- Safety requirements
- Regional regulations

## Output Format

Return ONLY valid JSON matching this exact schema:

```json
{
  "document_type": "architectural | structural | MEP | civil | landscape | shop_drawings",
  "project_phase": "schematic | design_development | construction_documents | shop_drawings",
  "dimensions": [
    {
      "type": "length | width | height | radius | diameter | thickness",
      "value": 0.0,
      "unit": "m | mm | ft | in",
      "location": "description of where this dimension is",
      "confidence": 0.95
    }
  ],
  "materials": [
    {
      "name": "Material name",
      "grade": "Grade specification",
      "specification": "Full specification string",
      "quantity": 0.0,
      "unit": "m³ | kg | ton | m² | pcs",
      "standard": "BS EN 206 | ASTM A615 | etc",
      "confidence": 0.9
    }
  ],
  "specifications": [
    "Text specification 1",
    "Text specification 2"
  ],
  "components": [
    {
      "type": "column | beam | wall | slab | foundation",
      "size": "300x300mm | 400x600mm | etc",
      "count": 1,
      "location": "Grid A-1 to A-5",
      "confidence": 0.85
    }
  ],
  "quantities": {
    "concrete_volume_m3": 150.0,
    "rebar_weight_kg": 5000.0,
    "blockwork_area_m2": 300.0
  },
  "standards": [
    "UAE Fire Code",
    "Dubai Building Code",
    "BS EN 206"
  ],
  "regional_codes": [
    "Dubai Municipality Regulations",
    "Saudi Building Code (SBC)",
    "Abu Dhabi ESTIDAMA"
  ],
  "annotations": [
    "Arabic or English text annotations found on drawing"
  ],
  "revisions": [
    {
      "revision": "A",
      "date": "2024-01-15",
      "description": "Initial issue"
    }
  ],
  "confidence_score": 0.88,
  "processing_time": 3.2,
  "notes": "Additional observations about the drawing",
  "warnings": [
    "Dimension partially obscured",
    "Material grade unclear"
  ]
}
```

## Quality Guidelines

- **Accuracy** - Only extract what you can see clearly
- **Confidence** - Lower confidence for unclear/ambiguous items
- **Completeness** - Extract ALL visible information
- **Context** - Provide location context for dimensions
- **Standards** - Reference correct GCC building codes
- **Warnings** - Flag ambiguities, quality issues, missing info

## Special Cases

### Hand-Drawn Sketches
- Lower confidence scores
- Note if sketch vs CAD drawing
- Flag unclear dimensions

### Scanned Documents
- May have lower image quality
- OCR challenges with poor scans
- Flag if text unreadable

### Multilingual Content
- Translate Arabic annotations to English
- Preserve both languages in output
- Flag if translation uncertain

### Complex Assemblies
- Break down into individual components
- Provide assembly description
- Extract all sub-components

## Remember

- Return ONLY valid JSON (no markdown, no explanations)
- Use exact schema structure
- Include confidence scores
- Flag warnings for ambiguities
- Focus on GCC construction standards
- Handle Arabic content appropriately
```

---

## PHASE 5: Core Sketch Agent (Day 1 - Evening)

### 5.1 Implement SketchAgent

**File**: `sketch-agent/agents/sketch_agent_v2.py`

```python
import json
import time
import os
from pathlib import Path
from typing import Optional
from PIL import Image

from .types import (
    SketchMetadata,
    SketchAnalysisResult
)
from .vision_providers import VisionModelFactory, VisionModelProtocol


class SketchAgent:
    """Main sketch analysis agent for construction drawings."""

    def __init__(
        self,
        provider: Optional[str] = None,
        model_name: Optional[str] = None
    ):
        """Initialize sketch agent.

        Args:
            provider: Vision provider (openai, anthropic, gemini, deepseek, qwen)
                     If None, uses VISION_PROVIDER env var
            model_name: Optional model override. If None, uses VISION_MODEL env var
        """
        # Determine provider
        self.provider = provider or os.getenv("VISION_PROVIDER", "gemini")

        # Determine model
        self.model_name = model_name or os.getenv("VISION_MODEL")

        # Create vision model
        self.vision_model = VisionModelFactory.create(
            self.provider,
            self.model_name
        )

        # Load system prompt
        self.system_prompt = self._load_system_prompt()

    def _load_system_prompt(self) -> str:
        """Load system prompt from file."""
        prompt_path = Path(__file__).parent.parent / "prompts" / "sketch_analysis_system.md"

        if not prompt_path.exists():
            raise FileNotFoundError(f"System prompt not found: {prompt_path}")

        return prompt_path.read_text(encoding="utf-8")

    async def analyze_sketch(
        self,
        image: Image.Image,
        metadata: SketchMetadata,
        context: Optional[str] = None
    ) -> SketchAnalysisResult:
        """Analyze a construction drawing/sketch.

        Args:
            image: PIL Image object
            metadata: Sketch metadata
            context: Optional context about the project (e.g., "G+3 residential Dubai")

        Returns:
            Structured analysis result

        Raises:
            ValueError: If vision model returns invalid JSON
            Exception: If analysis fails
        """
        start_time = time.time()

        # Build analysis prompt
        analysis_prompt = self._build_analysis_prompt(metadata, context)

        # Call vision model
        response = await self.vision_model.analyze_image(
            image=image,
            prompt=analysis_prompt,
            max_tokens=4000,
            temperature=0.1
        )

        # Parse JSON response
        result_dict = self._parse_json_response(response)

        # Add metadata
        result_dict["sketch_id"] = metadata.sketch_id
        result_dict["processing_time"] = time.time() - start_time

        # Validate with Pydantic
        result = SketchAnalysisResult(**result_dict)

        return result

    def _build_analysis_prompt(
        self,
        metadata: SketchMetadata,
        context: Optional[str]
    ) -> str:
        """Build complete analysis prompt."""
        prompt_parts = [self.system_prompt]

        if context:
            prompt_parts.append(f"\n## Project Context\n{context}")

        prompt_parts.append(f"\n## Drawing Metadata\n")
        prompt_parts.append(f"- Filename: {metadata.filename}")
        prompt_parts.append(f"- Image dimensions: {metadata.dimensions[0]}x{metadata.dimensions[1]} pixels")

        prompt_parts.append("\n## Task\n")
        prompt_parts.append("Analyze this construction drawing and return ONLY valid JSON following the schema.")

        return "\n".join(prompt_parts)

    def _parse_json_response(self, response: str) -> dict:
        """Parse JSON from vision model response.

        Handles markdown code blocks and malformed JSON.
        """
        # Remove markdown code blocks if present
        cleaned = response.strip()

        if cleaned.startswith("```json"):
            cleaned = cleaned.replace("```json", "", 1)
            cleaned = cleaned.rsplit("```", 1)[0]
        elif cleaned.startswith("```"):
            cleaned = cleaned.replace("```", "", 1)
            cleaned = cleaned.rsplit("```", 1)[0]

        cleaned = cleaned.strip()

        try:
            return json.loads(cleaned)
        except json.JSONDecodeError as e:
            raise ValueError(f"Invalid JSON response from vision model: {e}\n\nResponse:\n{response[:500]}")
```

---

## PHASE 6: CLI Wrapper (Day 2 - Morning)

### 6.1 Create Node.js-Compatible CLI

**File**: `sketch-agent/main_standalone.py`

```python
#!/usr/bin/env python3
"""
Standalone CLI for sketch analysis.

Usage:
    python main_standalone.py <image_path> [context]

Returns JSON to stdout:
    {"success": true, "result": {...}}
    {"success": false, "error": "..."}
"""

import sys
import json
import asyncio
import os
from pathlib import Path
from PIL import Image

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent))

from agents.sketch_agent_v2 import SketchAgent
from agents.types import SketchMetadata


async def analyze_sketch_cli(image_path: str, context: str = None):
    """Analyze sketch from command line."""
    try:
        # Validate image path
        if not os.path.exists(image_path):
            return {
                "success": False,
                "error": f"Image not found: {image_path}"
            }

        # Load image
        try:
            image = Image.open(image_path)
        except Exception as e:
            return {
                "success": False,
                "error": f"Failed to load image: {str(e)}"
            }

        # Create metadata
        file_stat = os.stat(image_path)
        metadata = SketchMetadata(
            sketch_id=Path(image_path).stem,
            filename=Path(image_path).name,
            file_size=file_stat.st_size,
            dimensions=image.size
        )

        # Initialize agent
        agent = SketchAgent()

        # Analyze
        result = await agent.analyze_sketch(image, metadata, context)

        # Return success
        return {
            "success": True,
            "result": result.model_dump()
        }

    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "error_type": type(e).__name__
        }


def main():
    """Main entry point."""
    # Parse arguments
    if len(sys.argv) < 2:
        print(json.dumps({
            "success": False,
            "error": "Usage: python main_standalone.py <image_path> [context]"
        }))
        sys.exit(1)

    image_path = sys.argv[1]
    context = sys.argv[2] if len(sys.argv) > 2 else None

    # Run analysis
    result = asyncio.run(analyze_sketch_cli(image_path, context))

    # Output JSON
    print(json.dumps(result, indent=2))

    # Exit code
    sys.exit(0 if result["success"] else 1)


if __name__ == "__main__":
    main()
```

Make it executable:
```bash
chmod +x sketch-agent/main_standalone.py
```

---

## PHASE 7: Node.js Integration (Day 2 - Afternoon)

### 7.1 Create Python Subprocess Client

**File**: `server/lib/pythonSketchClient.ts`

```typescript
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';

export interface SketchAnalysisResult {
  success: boolean;
  result?: {
    sketch_id: string;
    document_type: string;
    project_phase: string;
    dimensions: Array<{
      type: string;
      value: number;
      unit: string;
      location: string | null;
      confidence: number;
    }>;
    materials: Array<{
      name: string;
      grade: string | null;
      specification: string | null;
      quantity: number | null;
      unit: string | null;
      standard: string | null;
      confidence: number;
    }>;
    specifications: string[];
    components: Array<{
      type: string;
      size: string | null;
      count: number | null;
      location: string | null;
      confidence: number;
    }>;
    quantities: Record<string, any>;
    standards: string[];
    regional_codes: string[];
    annotations: string[];
    revisions: Array<any>;
    confidence_score: number;
    processing_time: number;
    notes: string;
    warnings: string[];
  };
  error?: string;
  error_type?: string;
}

export class PythonSketchClient {
  private pythonPath: string = 'python3';
  private scriptPath: string;

  constructor() {
    this.scriptPath = path.join(
      process.cwd(),
      'sketch-agent',
      'main_standalone.py'
    );
  }

  /**
   * Analyze a single sketch/construction drawing
   */
  async analyzeSketch(
    imagePath: string,
    context?: string
  ): Promise<SketchAnalysisResult> {
    return new Promise((resolve, reject) => {
      // Validate image exists
      fs.access(imagePath)
        .catch(() => {
          reject(new Error(`Image file not found: ${imagePath}`));
        });

      // Build arguments
      const args = [this.scriptPath, imagePath];
      if (context) {
        args.push(context);
      }

      // Spawn Python process
      const python = spawn(this.pythonPath, args, {
        env: {
          ...process.env,
          PYTHONPATH: path.join(process.cwd(), 'sketch-agent')
        },
        cwd: process.cwd()
      });

      let stdout = '';
      let stderr = '';

      python.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      python.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      python.on('error', (error) => {
        reject(new Error(`Failed to spawn Python: ${error.message}`));
      });

      python.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(
            `Python process exited with code ${code}\nStderr: ${stderr}\nStdout: ${stdout}`
          ));
          return;
        }

        try {
          const result: SketchAnalysisResult = JSON.parse(stdout);
          resolve(result);
        } catch (error) {
          reject(new Error(
            `Failed to parse JSON from Python:\n${stdout}\n\nError: ${error}`
          ));
        }
      });

      // Timeout after 5 minutes
      setTimeout(() => {
        python.kill();
        reject(new Error('Python process timeout after 5 minutes'));
      }, 300000);
    });
  }

  /**
   * Analyze multiple sketches sequentially
   */
  async analyzeMultiple(
    imagePaths: string[],
    context?: string
  ): Promise<SketchAnalysisResult[]> {
    const results: SketchAnalysisResult[] = [];

    for (const imagePath of imagePaths) {
      try {
        const result = await this.analyzeSketch(imagePath, context);
        results.push(result);
      } catch (error) {
        // Return error result for this image
        results.push({
          success: false,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    return results;
  }

  /**
   * Health check - verify Python and dependencies are available
   */
  async healthCheck(): Promise<{
    available: boolean;
    python_version?: string;
    error?: string;
  }> {
    return new Promise((resolve) => {
      const python = spawn(this.pythonPath, ['--version']);

      let version = '';

      python.stdout.on('data', (data) => {
        version += data.toString();
      });

      python.stderr.on('data', (data) => {
        version += data.toString();
      });

      python.on('close', (code) => {
        if (code === 0) {
          resolve({
            available: true,
            python_version: version.trim()
          });
        } else {
          resolve({
            available: false,
            error: 'Python not available'
          });
        }
      });

      python.on('error', (error) => {
        resolve({
          available: false,
          error: error.message
        });
      });

      setTimeout(() => {
        python.kill();
        resolve({
          available: false,
          error: 'Health check timeout'
        });
      }, 5000);
    });
  }
}

// Singleton instance
export const pythonSketchClient = new PythonSketchClient();
```

---

## PHASE 8: Update RFP Routes (Day 2 - Evening)

### 8.1 Add Sketch Detection to Upload Route

**File**: `server/routes/rfp.ts` (or wherever your upload route is)

Add this import at the top:
```typescript
import { pythonSketchClient } from '../lib/pythonSketchClient';
```

Update your upload route to include sketch detection:

```typescript
// Existing upload route - ADD sketch detection

app.post('/api/projects/:id/upload',
  requireAuth,
  upload.array('files', 10),
  async (req, res) => {
    const files = req.files as Express.Multer.File[];
    const projectId = req.params.id;

    try {
      // Classify files into text documents and images
      const imageExtensions = ['.png', '.jpg', '.jpeg', '.pdf', '.gif', '.tiff', '.bmp'];
      const docExtensions = ['.docx', '.doc', '.txt', '.md'];

      const sketches = files.filter(f =>
        imageExtensions.some(ext => f.originalname.toLowerCase().endsWith(ext))
      );

      const documents = files.filter(f =>
        docExtensions.some(ext => f.originalname.toLowerCase().endsWith(ext))
      );

      let workflow: string;
      let sketchResults: any[] = [];

      // Conditional triggering - only if sketches present
      if (sketches.length > 0) {
        workflow = 'with-sketches';

        console.log(`Processing ${sketches.length} sketches with Python agent...`);

        // Analyze sketches using Python agent
        const analysisResults = await pythonSketchClient.analyzeMultiple(
          sketches.map(s => s.path),
          req.body.context || `Project ${projectId}`
        );

        // Filter successful results
        sketchResults = analysisResults
          .filter(r => r.success)
          .map(r => r.result);

        // Log any failures
        analysisResults
          .filter(r => !r.success)
          .forEach(r => {
            console.error(`Sketch analysis failed: ${r.error}`);
          });

        // Clean up temporary sketch files
        for (const sketch of sketches) {
          try {
            await fs.unlink(sketch.path);
          } catch (err) {
            console.error(`Failed to delete temp file: ${sketch.path}`);
          }
        }
      } else {
        workflow = 'text-only';
        console.log('No sketches detected, using text-only workflow');
      }

      // Continue with existing document processing...
      // (your existing code for storing documents, etc.)

      res.json({
        success: true,
        workflow,
        has_sketches: sketches.length > 0,
        sketch_count: sketches.length,
        document_count: documents.length,
        sketch_results: sketchResults,
        message: workflow === 'with-sketches'
          ? `Processed ${sketches.length} sketches and ${documents.length} documents`
          : `Processed ${documents.length} documents`
      });

    } catch (error) {
      console.error('Upload error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed'
      });
    }
  }
);
```

---

## PHASE 9: Testing (Day 3 - Morning)

### 9.1 Test Python Agent Directly

```bash
cd sketch-agent

# Test with sample image
python3 main_standalone.py ../uploads/sample-sketch.png "G+3 residential building Dubai"
```

### 9.2 Test Node.js Integration

**File**: `server/tests/pythonSketchClient.test.ts`

```typescript
import { pythonSketchClient } from '../lib/pythonSketchClient';

describe('PythonSketchClient', () => {
  it('should pass health check', async () => {
    const health = await pythonSketchClient.healthCheck();

    expect(health.available).toBe(true);
    expect(health.python_version).toContain('Python');
  });

  it('should analyze sketch successfully', async () => {
    const testImagePath = './uploads/test-sketch.png';

    const result = await pythonSketchClient.analyzeSketch(
      testImagePath,
      'Test residential project'
    );

    expect(result.success).toBe(true);
    expect(result.result).toBeDefined();
    expect(result.result?.confidence_score).toBeGreaterThan(0);
  });

  it('should handle multiple sketches', async () => {
    const imagePaths = [
      './uploads/sketch1.png',
      './uploads/sketch2.png'
    ];

    const results = await pythonSketchClient.analyzeMultiple(imagePaths);

    expect(results).toHaveLength(2);
    expect(results.every(r => r.success)).toBe(true);
  });
});
```

---

## PHASE 10: Environment Configuration (Day 3 - Afternoon)

### 10.1 Update .env File

Add to your existing `.env`:

```env
# === Sketch Agent Configuration ===

# Vision Provider (choose one: openai, anthropic, gemini, deepseek, qwen)
VISION_PROVIDER=gemini

# Optional: Override default model
# VISION_MODEL=gemini-2.0-flash-exp

# Vision API Keys (at least ONE required)
# (Your existing keys should work, or add new ones)
GOOGLE_GENERATIVE_AI_API_KEY=your-gemini-key  # Already exists
OPENAI_API_KEY=your-openai-key                # Already exists
ANTHROPIC_API_KEY=your-anthropic-key          # Already exists
DEEPSEEK_API_KEY=your-deepseek-key            # Add if using DeepSeek
DASHSCOPE_API_KEY=your-qwen-key               # Add if using Qwen
```

### 10.2 Update package.json Scripts

Add Python setup to your `package.json`:

```json
{
  "scripts": {
    // ... existing scripts ...

    "sketch:setup": "cd sketch-agent && python3 -m pip install -r requirements.txt",
    "sketch:test": "cd sketch-agent && python3 main_standalone.py ../uploads/test-sketch.png",
    "sketch:health": "node -e \"import('./server/lib/pythonSketchClient.js').then(m => m.pythonSketchClient.healthCheck().then(console.log))\"",

    // Add to postinstall
    "postinstall": "npm run sketch:setup"
  }
}
```

---

## 📊 Success Criteria

### Functional Requirements
- ✅ Python agent analyzes construction drawings
- ✅ Supports 5 vision providers (OpenAI, Anthropic, Gemini, DeepSeek, Qwen)
- ✅ Extracts dimensions, materials, specifications, components
- ✅ Detects GCC building codes (UAE, Dubai, Saudi)
- ✅ Handles Arabic annotations
- ✅ Returns structured JSON with Pydantic validation
- ✅ Node.js calls Python via child_process
- ✅ Conditional triggering (only when images uploaded)
- ✅ Processes within 60 seconds per sketch

### Cost Optimization
- ✅ **50-80% cost savings** on text-only RFPs (Python agent not called)
- ✅ Provider selection (Gemini = 93% cheaper than GPT-4V)
- ✅ No persistent Python process (spawn on-demand)

### Integration Requirements
- ✅ Single Repl (no microservices)
- ✅ Minimal Node.js changes (one new file + route update)
- ✅ Works with existing BidForge architecture
- ✅ No breaking changes to existing features

---

## 🚀 Deployment Checklist

- [ ] Install Python dependencies (`npm run sketch:setup`)
- [ ] Set `VISION_PROVIDER` env var (recommend: `gemini`)
- [ ] Ensure at least one vision API key configured
- [ ] Test Python agent: `npm run sketch:test`
- [ ] Test Node.js integration: `npm run sketch:health`
- [ ] Upload test construction drawing via UI
- [ ] Verify sketch analysis results returned
- [ ] Verify text-only uploads skip Python agent
- [ ] Monitor costs (sketch vs non-sketch workflows)

---

## 💡 Usage Examples

### API Usage

**Upload with sketches:**
```bash
curl -X POST http://localhost:5000/api/projects/123/upload \
  -F "files=@sketch.png" \
  -F "files=@document.pdf" \
  -F "context=G+5 residential Dubai Marina"
```

**Response:**
```json
{
  "success": true,
  "workflow": "with-sketches",
  "has_sketches": true,
  "sketch_count": 1,
  "document_count": 1,
  "sketch_results": [
    {
      "sketch_id": "sketch",
      "document_type": "structural",
      "project_phase": "construction_documents",
      "dimensions": [...],
      "materials": [...],
      "confidence_score": 0.89,
      "processing_time": 3.4
    }
  ]
}
```

---

## 🎯 Next Steps (Post-Implementation)

1. **Performance Optimization**
   - Implement parallel sketch processing
   - Add caching for similar drawings
   - Compress images before analysis

2. **Enhanced Features**
   - OCR for scanned drawings
   - Automatic quantity takeoff
   - Cost estimation from sketches
   - Conflict detection (text vs sketch)

3. **UI Improvements**
   - Visual display of extracted dimensions
   - Highlight materials on drawing
   - Interactive sketch viewer

4. **Analytics**
   - Track sketch analysis accuracy
   - Monitor cost savings (sketch vs text-only)
   - Provider performance comparison

---

## 📚 Reference Documentation

- Vision API Docs:
  - OpenAI: https://platform.openai.com/docs/guides/vision
  - Anthropic: https://docs.anthropic.com/claude/docs/vision
  - Gemini: https://ai.google.dev/tutorials/python_quickstart
  - DeepSeek: https://platform.deepseek.com/docs
  - Qwen: https://help.aliyun.com/zh/dashscope/

- GCC Building Codes:
  - UAE Fire Code
  - Dubai Building Code
  - Saudi Building Code (SBC)
  - Qatar Construction Specifications

---

**This implementation plan is ready for execution by a Replit Agent or developer. Follow phases sequentially for best results.**

Good luck! 🚀
