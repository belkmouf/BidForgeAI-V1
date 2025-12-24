# Sketch Agent - Standalone Design Document

## Overview

The Sketch Agent is a modular, AI-powered construction drawing analyzer that extracts structured technical data from images of architectural, structural, MEP, and civil drawings. It's designed for GCC (Gulf Cooperation Council) construction markets and supports multiple vision LLM providers.

**Purpose:** Enable accurate bid preparation and cost estimation by automatically extracting dimensions, materials, specifications, and compliance requirements from construction drawings.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      Host Application                            │
│                  (Node.js, Python, or CLI)                       │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Integration Layer                            │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────────┐   │
│  │ Node.js Client│  │ Python CLI    │  │ Direct Import     │   │
│  │ (subprocess)  │  │ (standalone)  │  │ (Python module)   │   │
│  └───────────────┘  └───────────────┘  └───────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Sketch Agent Core                           │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    SketchAgent                             │  │
│  │  • analyze_sketch(image, metadata, context)               │  │
│  │  • System prompt management                                │  │
│  │  • JSON response parsing                                   │  │
│  └───────────────────────────────────────────────────────────┘  │
│                               │                                  │
│                               ▼                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │              Vision Model Factory                          │  │
│  │  ┌─────────┐ ┌──────────┐ ┌────────┐ ┌─────────┐ ┌──────┐ │  │
│  │  │ OpenAI  │ │Anthropic │ │ Gemini │ │DeepSeek │ │ Qwen │ │  │
│  │  │ GPT-4o  │ │ Claude   │ │  2.0   │ │  Chat   │ │  VL  │ │  │
│  │  └─────────┘ └──────────┘ └────────┘ └─────────┘ └──────┘ │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Structured Output                             │
│              SketchAnalysisResult (Pydantic)                     │
└─────────────────────────────────────────────────────────────────┘
```

---

## Directory Structure

```
sketch-agent/
├── agents/
│   ├── __init__.py
│   ├── sketch_agent_v2.py      # Main agent class
│   ├── types.py                # Pydantic models for input/output
│   └── vision_providers.py     # Multi-provider vision implementations
├── prompts/
│   └── sketch_analysis_system.md  # System prompt for analysis
├── main_standalone.py          # CLI entry point
├── requirements.txt            # Python dependencies
└── README.md                   # Usage documentation
```

---

## Core Components

### 1. SketchAgent (`agents/sketch_agent_v2.py`)

The main orchestrator that:
- Initializes the appropriate vision model provider
- Loads and manages the system prompt
- Executes image analysis
- Parses and validates JSON responses

```python
from sketch_agent.agents.sketch_agent_v2 import SketchAgent
from sketch_agent.agents.types import SketchMetadata

# Initialize with default provider (OpenAI)
agent = SketchAgent()

# Or specify provider
agent = SketchAgent(provider="anthropic", model_name="claude-3-5-sonnet-20241022")

# Analyze an image
result = await agent.analyze_sketch(
    image=pil_image,
    metadata=SketchMetadata(
        sketch_id="drawing-001",
        filename="floor_plan.png",
        file_size=1024000,
        dimensions=(2000, 1500)
    ),
    context="G+5 residential building in Dubai Marina"
)
```

### 2. Vision Providers (`agents/vision_providers.py`)

Factory pattern supporting 5 vision LLM providers:

| Provider | Models | API Key Env Variable |
|----------|--------|---------------------|
| OpenAI | gpt-4o, gpt-4o-mini | `OPENAI_API_KEY` |
| Anthropic | claude-3-5-sonnet, claude-3-opus | `ANTHROPIC_API_KEY` |
| Google Gemini | gemini-2.0-flash-exp, gemini-1.5-pro | `GOOGLE_GENERATIVE_AI_API_KEY` |
| DeepSeek | deepseek-chat | `DEEPSEEK_API_KEY` |
| Qwen | qwen-vl-max | `DASHSCOPE_API_KEY` |

```python
from sketch_agent.agents.vision_providers import VisionModelFactory

# Create any supported provider
model = VisionModelFactory.create("openai")
model = VisionModelFactory.create("anthropic", model="claude-3-opus-20240229")
model = VisionModelFactory.create("gemini")
```

### 3. Type Definitions (`agents/types.py`)

Pydantic models ensuring type safety and validation:

- `SketchMetadata` - Input metadata about the image
- `SketchAnalysisResult` - Complete output with all extracted data
- `ContextLayer` - Document type, purpose, capacity inference
- `TechnicalData` - Dimensions, materials, components
- `ProjectMetadata` - Title block information

### 4. System Prompt (`prompts/sketch_analysis_system.md`)

Comprehensive prompt optimized for:
- GCC construction standards (UAE, Saudi, Qatar, Oman)
- Multiple document types (Architectural, Structural, MEP, Civil)
- Detailed extraction of dimensions, materials, specifications
- Arabic language support
- Confidence scoring

---

## Data Models

### Input: SketchMetadata

```python
class SketchMetadata(BaseModel):
    sketch_id: str           # Unique identifier
    filename: str            # Original filename
    file_size: int           # File size in bytes
    dimensions: tuple[int, int]  # (width, height) in pixels
    uploaded_at: Optional[datetime] = None
```

### Output: SketchAnalysisResult

```python
class SketchAnalysisResult(BaseModel):
    sketch_id: str
    
    # Nested structure
    context_layer: ContextLayer        # What the drawing shows
    project_metadata: ProjectMetadata  # Title block info
    technical_data: TechnicalData      # Dimensions, materials, components
    
    # Flat fields
    specifications: list[str]     # Text specifications
    standards: list[str]          # Referenced standards (BS, ASTM, etc.)
    regional_codes: list[str]     # GCC building codes
    annotations: list[str]        # All text annotations
    views_included: list[str]     # Views shown
    revisions: list[RevisionInfo]
    confidence_score: float       # 0.0 to 1.0
    processing_time: float        # Seconds
    notes: str
    warnings: list[str]
```

---

## Integration Methods

### Method 1: Python Direct Import (Recommended)

```python
import asyncio
from PIL import Image
from sketch_agent.agents.sketch_agent_v2 import SketchAgent
from sketch_agent.agents.types import SketchMetadata

async def analyze_drawing(image_path: str, context: str = None):
    image = Image.open(image_path)
    metadata = SketchMetadata(
        sketch_id="unique-id",
        filename=image_path,
        file_size=os.path.getsize(image_path),
        dimensions=image.size
    )
    
    agent = SketchAgent()
    result = await agent.analyze_sketch(image, metadata, context)
    return result.model_dump()

# Run
result = asyncio.run(analyze_drawing("drawing.png", "Warehouse in Abu Dhabi"))
```

### Method 2: CLI / Subprocess

```bash
# Command line
python main_standalone.py <image_path> [context]

# Examples
python main_standalone.py uploads/floor_plan.png
python main_standalone.py uploads/floor_plan.png "G+3 residential Dubai"
```

**Output format:**
```json
{
  "success": true,
  "result": {
    "sketch_id": "floor_plan",
    "context_layer": {...},
    "technical_data": {...},
    ...
  }
}
```

### Method 3: Node.js Integration

```typescript
import { spawn } from 'child_process';

async function analyzeSketch(imagePath: string, context?: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const args = ['sketch-agent/main_standalone.py', imagePath];
    if (context) args.push(context);
    
    const python = spawn('python3', args);
    let stdout = '';
    
    python.stdout.on('data', (data) => { stdout += data.toString(); });
    python.on('close', (code) => {
      if (code === 0) resolve(JSON.parse(stdout));
      else reject(new Error(`Exit code ${code}`));
    });
  });
}
```

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `VISION_PROVIDER` | No | Default: `openai`. Options: `openai`, `anthropic`, `gemini`, `deepseek`, `qwen` |
| `VISION_MODEL` | No | Override default model for provider |
| `OPENAI_API_KEY` | If using OpenAI | OpenAI API key |
| `ANTHROPIC_API_KEY` | If using Anthropic | Anthropic API key |
| `GOOGLE_GENERATIVE_AI_API_KEY` | If using Gemini | Google AI API key |
| `DEEPSEEK_API_KEY` | If using DeepSeek | DeepSeek API key |
| `DASHSCOPE_API_KEY` | If using Qwen | Alibaba DashScope API key |

---

## Dependencies

```txt
# requirements.txt
pillow>=10.0.0          # Image processing
pydantic>=2.0.0         # Data validation
openai>=1.0.0           # OpenAI & compatible APIs
anthropic>=0.25.0       # Anthropic Claude
google-generativeai>=0.5.0  # Google Gemini
python-dotenv>=1.0.0    # Environment management
```

---

## Usage Examples

### Basic Analysis

```python
result = await agent.analyze_sketch(image, metadata)

# Access extracted data
print(f"Document type: {result.context_layer.document_type}")
print(f"Dimensions extracted: {len(result.technical_data.dimensions)}")

for dim in result.technical_data.dimensions:
    print(f"  {dim.label}: {dim.value} {dim.unit} (confidence: {dim.confidence})")
```

### With Project Context

```python
# Providing context improves extraction accuracy
result = await agent.analyze_sketch(
    image, 
    metadata,
    context="20-storey commercial tower in DIFC, Dubai. Steel structure with curtain wall facade."
)
```

### Batch Processing

```python
async def process_batch(image_paths: list[str]):
    agent = SketchAgent()
    results = []
    
    for path in image_paths:
        image = Image.open(path)
        metadata = SketchMetadata(...)
        result = await agent.analyze_sketch(image, metadata)
        results.append(result)
    
    return results
```

---

## Error Handling

```python
try:
    result = await agent.analyze_sketch(image, metadata, context)
except ValueError as e:
    # Configuration or validation error
    print(f"Validation error: {e}")
except Exception as e:
    # Vision model or network error
    print(f"Analysis failed: {e}")
```

**Common errors:**
- `OPENAI_API_KEY not found` - Set the appropriate API key
- `Invalid JSON response` - Vision model returned malformed output
- `Image not found` - Invalid file path
- `Failed to spawn Python` - Python not installed or path issue

---

## Extension Points

### Adding a New Vision Provider

```python
# 1. Create new provider class
class NewProviderVisionModel:
    def __init__(self, api_key=None, model="default-model"):
        self.api_key = api_key or os.getenv("NEW_PROVIDER_API_KEY")
        # Initialize client
    
    async def analyze_image(self, image, prompt, max_tokens=4000, temperature=0.1):
        # Implement analysis
        return response_text

# 2. Register in factory
VisionModelFactory.PROVIDERS["newprovider"] = NewProviderVisionModel
```

### Customizing the System Prompt

Edit `prompts/sketch_analysis_system.md` to:
- Add new document types
- Include additional regional codes
- Modify output schema
- Add domain-specific extraction rules

---

## Performance Considerations

| Metric | Typical Value |
|--------|---------------|
| Analysis time | 5-30 seconds per image |
| Token usage | 2,000-8,000 tokens per analysis |
| Max image size | Determined by provider limits |
| Recommended resolution | 1500-3000px on longest side |

**Optimization tips:**
- Resize large images before analysis
- Use `gpt-4o-mini` for faster, cheaper processing
- Batch similar drawings for consistent context
- Cache results for repeated analyses

---

## Security Notes

- API keys should be stored in environment variables, never in code
- Input images should be validated before processing
- Consider rate limiting for batch processing
- Sanitize output before storing in databases

---

## Testing

```python
# Health check
from sketch_agent.agents.vision_providers import VisionModelFactory

try:
    model = VisionModelFactory.create("openai")
    print("OpenAI provider available")
except ValueError as e:
    print(f"OpenAI not configured: {e}")
```

---

## Standalone Deployment Checklist

1. Copy `sketch-agent/` directory to your project
2. Install dependencies: `pip install -r requirements.txt`
3. Set required environment variables
4. Test with sample image:
   ```bash
   python main_standalone.py test_image.png "Test context"
   ```
5. Integrate via your preferred method (Python import, CLI, or subprocess)

---

## License

MIT License - Free to use in commercial and open-source projects.

---

## Support

For issues or feature requests, please refer to the main BidForge AI repository or contact the development team.
