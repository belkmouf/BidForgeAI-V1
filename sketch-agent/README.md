# BidForge AI - Sketch Agent

Python-based construction drawing analysis agent integrated with Node.js BidForge AI application.

## Features

- ✅ **5 Vision Providers**: OpenAI GPT-4o, Anthropic Claude 3.5, Google Gemini 2.0, DeepSeek, Qwen
- ✅ **GCC Building Standards**: UAE Fire Code, Dubai Building Code, Saudi SBC, Qatar QCS
- ✅ **Multi-language Support**: Arabic annotation detection and translation
- ✅ **Conditional Triggering**: Only runs when images uploaded (50-80% cost savings)
- ✅ **Structured Output**: Pydantic validation, JSON schema enforcement
- ✅ **Construction-specific**: Dimensions, materials, specifications, components, quantities

## Installation

### 1. Install Python Dependencies

```bash
cd sketch-agent
python3 -m pip install -r requirements.txt
```

### 2. Configure Environment Variables

Add to your `.env` file:

```env
# Vision Provider (choose one)
VISION_PROVIDER=gemini  # Recommended: cheapest, fast

# Use existing AI provider keys
GOOGLE_GENERATIVE_AI_API_KEY=your-key
OPENAI_API_KEY=your-key
ANTHROPIC_API_KEY=your-key
```

### 3. Test Python Agent

```bash
# Direct Python test
cd sketch-agent
python3 main_standalone.py path/to/sketch.png "G+5 residential Dubai"
```

## Architecture

```
Node.js (Express)
    ↓
    spawn child_process
    ↓
Python (SketchAgent)
    ↓
    Vision LLM (Gemini/GPT/Claude)
    ↓
    JSON Result
    ↓
Node.js (routes.ts)
```

## Usage

### Via API

Upload files (text + images) to any project:

```bash
curl -X POST http://localhost:5000/api/projects/123/upload \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "files=@sketch.png" \
  -F "files=@document.pdf" \
  -F "context=G+3 residential Dubai Marina"
```

Response with sketch analysis:

```json
{
  "success": true,
  "workflow": "with-sketches",
  "sketch_count": 1,
  "document_count": 1,
  "sketch_results": [
    {
      "document_type": "structural",
      "dimensions": [...],
      "materials": [...],
      "confidence_score": 0.89
    }
  ]
}
```

### Via TypeScript

```typescript
import { pythonSketchClient } from './server/lib/pythonSketchClient';

const result = await pythonSketchClient.analyzeSketch(
  '/path/to/sketch.png',
  'G+5 residential Dubai Marina'
);

if (result.success) {
  console.log('Dimensions:', result.result.dimensions);
  console.log('Materials:', result.result.materials);
}
```

## Providers Comparison

| Provider | Cost/Image | Speed | Quality | Best For |
|---|---|---|---|---|
| **Gemini 2.0** | $0.001 | ⚡ Fast | ⭐⭐⭐⭐ | Production (best value) |
| **DeepSeek** | $0.002 | ⚡ Fast | ⭐⭐⭐ | Chinese/Arabic content |
| **Claude 3.5** | $0.048 | 🐢 Slow | ⭐⭐⭐⭐⭐ | Highest accuracy |
| **GPT-4o** | $0.150 | ⚡ Fast | ⭐⭐⭐⭐⭐ | English content |
| **Qwen VL** | $0.002 | ⚡ Fast | ⭐⭐⭐ | Arabic/Chinese native |

## Cost Savings

### Conditional Triggering

The agent **only runs when images are uploaded**, saving 50-80% on text-only RFPs:

- ❌ **Without conditional triggering**: Vision API called on every upload (~$0.15/RFP)
- ✅ **With conditional triggering**: Vision API only for image-containing RFPs (~$0.03/RFP)

### Provider Selection

Using Gemini vs GPT-4 Vision: **93% cost reduction**

- GPT-4 Vision: $0.150 per image
- Gemini 2.0 Flash: $0.001 per image

## Troubleshooting

### Python not found

```bash
# Install Python 3.11+
# On Replit, Python should be pre-installed

# Verify
python3 --version
```

### Missing dependencies

```bash
cd sketch-agent
python3 -m pip install -r requirements.txt --upgrade
```

### API key not found

Ensure you've set `VISION_PROVIDER` and the corresponding API key:

```env
VISION_PROVIDER=gemini
GOOGLE_GENERATIVE_AI_API_KEY=your-key-here
```

### Integration test failed

```bash
# Test Python agent directly
cd sketch-agent
python3 main_standalone.py ../uploads/test.png

# Test TypeScript client
cd ..
npm run sketch:health
```

## Development

### Project Structure

```
sketch-agent/
├── agents/
│   ├── types.py              # Pydantic models
│   ├── vision_providers.py   # 5 provider implementations
│   └── sketch_agent_v2.py    # Main agent logic
├── prompts/
│   └── sketch_analysis_system.md  # Vision model prompt
├── main_standalone.py        # CLI entry point (called by Node.js)
└── requirements.txt          # Python dependencies
```

### Adding a New Provider

1. Implement provider class in `vision_providers.py`
2. Add to `VisionModelFactory.PROVIDERS` dict
3. Update `.env.example` with API key
4. Test with sample sketch

## License

MIT - Part of BidForge AI
