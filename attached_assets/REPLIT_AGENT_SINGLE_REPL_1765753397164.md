# 🤖 REPLIT AGENT - Single Repl Integration

## 🎯 What You'll Do

1. **Upload files** to your existing BidForge AI Repl
2. **Give Replit Agent a prompt**
3. **Let it do everything** ✨

**Total time: 10 minutes**

---

## 📦 STEP 1: Upload These Files

### Upload to Your Existing BidForge AI Repl:

```
✅ Upload ALL these files (keep folder structure):

SINGLE_REPL_INTEGRATION.md        ⭐ Main specification
SINGLE_REPL_CHECKLIST.md           ⭐ Quick reference

agents/
├── __init__.py
├── types.py
├── sketch_agent_v2.py
├── vision_providers.py
└── smart_orchestrator.py

services/
├── __init__.py
├── vector_store.py
└── job_queue.py

utils/
├── __init__.py
├── image_processing.py
└── logger.py

prompts/
└── sketch_analysis_system.md

sketch-agent/
└── main_standalone.py             ⭐ Python wrapper

src-single-repl/
└── services/
    └── pythonSketchClient.ts      ⭐ TypeScript client

requirements_v2.txt
MULTI_PROVIDER_GUIDE.md (optional)
```

**Total: ~20 files**

Just drag and drop the entire folder contents!

---

## 🗣️ STEP 2: Give Replit Agent This Prompt

Copy and paste this EXACT prompt to Replit Agent:

```
Integrate Python sketch analysis agent into this existing BidForge AI Node.js application.

I've uploaded Python sketch agent files and integration specifications. Follow SINGLE_REPL_INTEGRATION.md to integrate everything.

Tasks:
1. Create sketch-agent/ folder and move all Python files there
2. Copy requirements_v2.txt to sketch-agent/requirements.txt
3. Install Python dependencies: pip install -r sketch-agent/requirements.txt --break-system-packages
4. Copy sketch-agent/main_standalone.py (already uploaded)
5. Copy src-single-repl/services/pythonSketchClient.ts to src/services/
6. Update or create src/routes/rfp.routes.ts to:
   - Accept file uploads with multer
   - Classify files (sketches vs documents)
   - Call pythonSketchClient.analyzeSketch() for sketch files
   - Return results with workflow type (with-sketches or text-only)
7. Create uploads/temp folder for temporary file storage
8. Update .replit file to include Python support
9. Ensure all imports resolve correctly

The integration should:
- Use child_process to spawn Python as subprocess
- Call main_standalone.py with image path and context
- Parse JSON response from Python
- Only trigger sketch analysis when images are uploaded
- Support multi-provider vision (OpenAI, Anthropic, Gemini, DeepSeek, Qwen)

Environment variables needed (add to Secrets):
- VISION_PROVIDER (e.g., gemini)
- GOOGLE_API_KEY (or other provider key)

Reference the SINGLE_REPL_INTEGRATION.md file for complete specifications.

After integration:
1. Verify Python dependencies installed
2. Test Python script: python3 sketch-agent/main_standalone.py --help
3. Ensure API endpoints work
4. Confirm sketch analysis triggers only when sketches uploaded

Do NOT create a separate FastAPI service - integrate Python as subprocess within this Node.js app.
```

---

## ⚙️ STEP 3: Configure Secrets

After Replit Agent finishes, add these to Replit Secrets:

```
VISION_PROVIDER=gemini
GOOGLE_API_KEY=your-google-api-key-here
```

Or choose another provider:
```
VISION_PROVIDER=openai
OPENAI_API_KEY=your-openai-key

# OR

VISION_PROVIDER=anthropic
ANTHROPIC_API_KEY=your-anthropic-key
```

---

## 🧪 STEP 4: Test It Works

After Replit Agent completes:

```bash
# Test 1: Python health check
python3 sketch-agent/main_standalone.py --help

# Test 2: Upload with sketch
curl -X POST http://localhost:3000/api/rfp/upload \
  -F "files=@test-sketch.png" \
  -F "rfp_text=Test RFP"

# Should return:
# {
#   "workflow": "with-sketches",
#   "sketch_count": 1,
#   "sketch_results": [...]
# }

# Test 3: Upload without sketch
curl -X POST http://localhost:3000/api/rfp/upload \
  -F "files=@document.docx" \
  -F "rfp_text=Test"

# Should return:
# {
#   "workflow": "text-only",
#   "sketch_count": 0
# }
```

---

## 📁 What Replit Agent Will Create

Replit Agent will:

✅ Set up folder structure:
```
your-repl/
├── sketch-agent/
│   ├── agents/
│   ├── services/
│   ├── utils/
│   ├── prompts/
│   ├── main_standalone.py
│   └── requirements.txt
├── src/
│   ├── services/
│   │   └── pythonSketchClient.ts
│   └── routes/
│       └── rfp.routes.ts
└── uploads/
    └── temp/
```

✅ Install Python dependencies

✅ Create integration code:
- pythonSketchClient.ts (calls Python)
- rfp.routes.ts (handles uploads)

✅ Update configuration:
- .replit file
- Environment setup

✅ Test everything works

---

## 🎯 Simple Checklist

### Before Starting:
- [ ] Download files from `/mnt/user-data/outputs/bidforge-sketch-agent/`
- [ ] Have your API key ready (Google/OpenAI/Anthropic)

### Upload Phase:
- [ ] Open your existing BidForge AI Repl
- [ ] Drag and drop all files (keep folder structure)
- [ ] Upload SINGLE_REPL_INTEGRATION.md ⭐ Most important!

### Replit Agent Phase:
- [ ] Copy the prompt above
- [ ] Paste into Replit Agent
- [ ] Wait for it to complete (~5 min)
- [ ] Check for any errors

### Configuration Phase:
- [ ] Add VISION_PROVIDER to Secrets
- [ ] Add API key to Secrets

### Testing Phase:
- [ ] Test Python script directly
- [ ] Test API upload with sketch
- [ ] Test API upload without sketch
- [ ] Verify results are correct

---

## 💡 What Makes This Easy

**You do:**
- Upload files (2 min)
- Give prompt (1 min)
- Add secrets (1 min)
- Test (3 min)

**Replit Agent does:**
- Create folder structure
- Move files to correct locations
- Install Python dependencies
- Create integration code
- Update configuration
- Set up routes
- Handle all the complexity

**Total time: ~10 minutes** (vs 30+ manually)

---

## 🚨 If Something Goes Wrong

### Replit Agent confused?
- Make sure SINGLE_REPL_INTEGRATION.md is uploaded
- Reference it explicitly in prompt: "Follow SINGLE_REPL_INTEGRATION.md"

### Python not working?
```bash
# Manually install dependencies
cd sketch-agent
pip install -r requirements.txt --break-system-packages
```

### Import errors?
- Make sure all __init__.py files are in folders
- Check folder structure matches spec

### Can't find files?
- Verify files uploaded to root, not in subfolder
- Replit Agent will organize them

---

## 📚 Files Location

Get all files from:
```
/mnt/user-data/outputs/bidforge-sketch-agent/
```

**Most Important Files:**
1. `SINGLE_REPL_INTEGRATION.md` ⭐⭐⭐ - Main spec
2. `sketch-agent/main_standalone.py` - Python wrapper
3. `src-single-repl/services/pythonSketchClient.ts` - TS client
4. All Python files in `agents/`, `services/`, `utils/`

---

## 🎉 That's It!

**Three simple steps:**
1. Upload files → 2 min
2. Give Replit Agent prompt → 1 min  
3. Add secrets → 1 min

**Replit Agent handles everything else!** ✨

Total time: **~10 minutes**

Result: **Python sketch agent integrated into your single Repl!** 🚀

---

## 🔥 Pro Tips

1. **Upload everything at once** - Don't upload file by file
2. **Include the .md files** - Replit Agent reads them
3. **Keep folder structure** - Upload with folders intact
4. **Be specific in prompt** - Reference SINGLE_REPL_INTEGRATION.md
5. **Let it work** - Don't interrupt Replit Agent

Ready? **Upload and go!** 🎊
