# 📦 SINGLE REPL - Upload Checklist

## 🎯 What You're Doing

Adding Python sketch agent **INTO your existing BidForge AI Repl**.

**ONE Repl. Everything together.**

---

## 📁 Files to Upload to Your EXISTING Repl

### Step 1: Create `sketch-agent/` Folder

Create this folder structure in your existing Repl:

```
sketch-agent/
├── agents/
├── services/
├── utils/
├── prompts/
├── main_standalone.py
└── requirements.txt
```

### Step 2: Upload Python Files

**Put these files in `sketch-agent/` folder:**

```
✅ agents/ folder (5 files):
   __init__.py
   types.py
   sketch_agent_v2.py
   vision_providers.py
   smart_orchestrator.py

✅ services/ folder (3 files):
   __init__.py
   vector_store.py
   job_queue.py

✅ utils/ folder (3 files):
   __init__.py
   image_processing.py
   logger.py

✅ prompts/ folder (1 file):
   sketch_analysis_system.md

✅ Root of sketch-agent/ (2 files):
   main_standalone.py ⭐ NEW - I created this
   requirements.txt (copy from requirements_v2.txt)
```

**Total: 15 Python files**

### Step 3: Upload TypeScript Files

**Put these in your `src/` folder:**

```
✅ src/services/pythonSketchClient.ts ⭐ NEW - I created this
✅ src/routes/rfp.routes.ts (UPDATE your existing file)
```

**Total: 2 TypeScript files**

---

## 🛠️ Installation Commands

### In Replit Shell:

```bash
# 1. Install Python dependencies
cd sketch-agent
pip install -r requirements.txt --break-system-packages
cd ..

# 2. Make Python script executable
chmod +x sketch-agent/main_standalone.py

# 3. Create uploads folder
mkdir -p uploads/temp

# 4. Test Python works
python3 --version

# 5. Test Python script
cd sketch-agent
python3 main_standalone.py --help
cd ..
```

---

## ⚙️ Configuration

### Add to Replit Secrets:

```
VISION_PROVIDER=gemini
GOOGLE_API_KEY=your-google-api-key-here
```

### Update `.replit` file:

Add this to ensure Python is available:

```toml
[languages]
python3 = "latest"
nodejs = "18"
```

---

## 🧪 Quick Test

### Test 1: Python Health Check

```bash
cd sketch-agent
python3 -c "from agents.sketch_agent_v2 import SketchAgent; print('✅ Agent loaded')"
cd ..
```

### Test 2: Analyze Test Image

```bash
cd sketch-agent
python3 main_standalone.py /path/to/test-image.png "Test context"
cd ..
```

Should output JSON.

### Test 3: From Node.js

```typescript
import { pythonSketchClient } from './services/pythonSketchClient';

const result = await pythonSketchClient.analyzeSketch(
  '/path/to/image.png',
  'G+3 building'
);

console.log(result);
```

---

## 📂 Final Structure

```
your-bidforge-repl/
├── src/
│   ├── services/
│   │   ├── ... (existing)
│   │   └── pythonSketchClient.ts ⭐ NEW
│   └── routes/
│       ├── ... (existing)
│       └── rfp.routes.ts ⭐ UPDATED
│
├── sketch-agent/ ⭐ NEW FOLDER
│   ├── agents/
│   │   ├── __init__.py
│   │   ├── types.py
│   │   ├── sketch_agent_v2.py
│   │   ├── vision_providers.py
│   │   └── smart_orchestrator.py
│   ├── services/
│   │   ├── __init__.py
│   │   ├── vector_store.py
│   │   └── job_queue.py
│   ├── utils/
│   │   ├── __init__.py
│   │   ├── image_processing.py
│   │   └── logger.py
│   ├── prompts/
│   │   └── sketch_analysis_system.md
│   ├── main_standalone.py
│   └── requirements.txt
│
├── uploads/
│   └── temp/
│
├── package.json
└── .env
```

---

## ✅ Quick Checklist

### Python Setup:
- [ ] Create `sketch-agent/` folder
- [ ] Upload 15 Python files
- [ ] Copy requirements_v2.txt → sketch-agent/requirements.txt
- [ ] Upload main_standalone.py
- [ ] Run `pip install -r requirements.txt --break-system-packages`
- [ ] Test: `python3 sketch-agent/main_standalone.py --help`

### TypeScript Integration:
- [ ] Upload `src/services/pythonSketchClient.ts`
- [ ] Update `src/routes/rfp.routes.ts`
- [ ] Import and use pythonSketchClient in routes

### Configuration:
- [ ] Add VISION_PROVIDER to secrets
- [ ] Add GOOGLE_API_KEY (or other provider key)
- [ ] Update .replit file
- [ ] Create uploads/temp folder

### Testing:
- [ ] Test Python health check
- [ ] Test with sample image
- [ ] Upload RFP with sketch via API
- [ ] Verify sketch analysis runs

---

## 🎯 File Locations

Get files from:
```
/mnt/user-data/outputs/bidforge-sketch-agent/
```

**Python files:**
- All files from `agents/`, `services/`, `utils/`, `prompts/`
- `sketch-agent/main_standalone.py` ⭐
- `requirements_v2.txt` → rename to `requirements.txt`

**TypeScript files:**
- `src-single-repl/services/pythonSketchClient.ts` ⭐
- Use the rfp.routes.ts example from SINGLE_REPL_INTEGRATION.md

---

## 💡 How It Works

```
User uploads RFP with sketch
    ↓
Node.js receives upload (Express/TypeScript)
    ↓
Detects sketch in files
    ↓
pythonSketchClient.analyzeSketch(path)
    ↓
Spawns Python subprocess
    ↓
python3 main_standalone.py image.png
    ↓
Returns JSON with analysis
    ↓
Node.js receives result
    ↓
Saves to database & continues workflow
```

---

## 🚨 Common Issues

### "Python not found"
```bash
# Check Python is available
which python3
python3 --version
```

### "Module not found"
```bash
# Reinstall dependencies
cd sketch-agent
pip install -r requirements.txt --break-system-packages
```

### "Permission denied"
```bash
# Make script executable
chmod +x sketch-agent/main_standalone.py
```

### "Import errors"
```bash
# Make sure all __init__.py files exist
ls sketch-agent/agents/__init__.py
ls sketch-agent/services/__init__.py
ls sketch-agent/utils/__init__.py
```

---

## 🎉 You're Done!

**Total files to upload: 17**
- 15 Python files
- 2 TypeScript files

**Total time: ~30 minutes**

**Result:** One Repl with Python sketch agent integrated! 🚀

---

## 📚 Read Full Guide

For complete details, see:
`SINGLE_REPL_INTEGRATION.md`
