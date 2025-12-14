# 🎯 Single Repl Integration - Python Sketch Agent in Your Node.js App

## Overview

Add the Python sketch agent **directly into your existing BidForge AI Repl**.

```
Your Existing BidForge AI Repl (Node.js)
├── Frontend (React)
├── Backend (Express/TypeScript)
├── sketch-agent/ (NEW - Python code)
└── Python runtime (calls Python from Node.js)
```

**No second Repl needed!**

---

## 📦 What to Upload to Your EXISTING Repl

### Step 1: Create Python Folder Structure

In your existing Repl, create this folder:

```
sketch-agent/
├── agents/
│   ├── __init__.py
│   ├── types.py
│   ├── sketch_agent_v2.py
│   ├── vision_providers.py
│   └── smart_orchestrator.py
├── services/
│   ├── __init__.py
│   ├── vector_store.py
│   └── job_queue.py
├── utils/
│   ├── __init__.py
│   ├── image_processing.py
│   └── logger.py
├── prompts/
│   └── sketch_analysis_system.md
├── main_standalone.py
└── requirements.txt
```

### Step 2: Upload These Files

**Upload ALL Python files to `sketch-agent/` folder:**

```
✅ sketch-agent/agents/ (5 files):
   __init__.py
   types.py
   sketch_agent_v2.py
   vision_providers.py
   smart_orchestrator.py

✅ sketch-agent/services/ (3 files):
   __init__.py
   vector_store.py
   job_queue.py

✅ sketch-agent/utils/ (3 files):
   __init__.py
   image_processing.py
   logger.py

✅ sketch-agent/prompts/ (1 file):
   sketch_analysis_system.md

✅ sketch-agent/ root (2 files):
   requirements.txt (from requirements_v2.txt)
   main_standalone.py (NEW - I'll create this)
```

**Upload TypeScript integration files:**

```
✅ src/services/pythonSketchClient.ts (NEW - I'll create this)
✅ src/routes/rfp.routes.ts (UPDATE existing or create new)
```

---

## 📝 New Files You Need

### File 1: `sketch-agent/main_standalone.py`

This is a wrapper to call sketch agent from Node.js:

```python
#!/usr/bin/env python3
"""
Standalone wrapper for sketch agent.
Called from Node.js via child_process.
"""

import sys
import json
import asyncio
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent))

from agents.sketch_agent_v2 import SketchAgent
from agents.types import SketchMetadata
from PIL import Image


async def analyze_sketch_cli(image_path: str, context: str = None):
    """Analyze sketch from CLI."""
    try:
        # Initialize agent
        agent = SketchAgent()
        
        # Load image
        image = Image.open(image_path)
        
        # Create metadata
        metadata = SketchMetadata(
            sketch_id=Path(image_path).stem,
            filename=Path(image_path).name,
            file_size=Path(image_path).stat().st_size,
            dimensions=image.size,
            uploaded_at=None
        )
        
        # Analyze
        result = await agent.analyze_sketch(image, metadata, context)
        
        # Return JSON
        output = {
            "success": True,
            "result": result.model_dump()
        }
        
        print(json.dumps(output))
        return 0
        
    except Exception as e:
        error_output = {
            "success": False,
            "error": str(e)
        }
        print(json.dumps(error_output))
        return 1


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"success": False, "error": "Usage: python main_standalone.py <image_path> [context]"}))
        sys.exit(1)
    
    image_path = sys.argv[1]
    context = sys.argv[2] if len(sys.argv) > 2 else None
    
    exit_code = asyncio.run(analyze_sketch_cli(image_path, context))
    sys.exit(exit_code)
```

### File 2: `src/services/pythonSketchClient.ts`

Node.js service to call Python:

```typescript
import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

export interface SketchAnalysisResult {
  success: boolean;
  result?: {
    sketch_id: string;
    document_type: string;
    dimensions: any[];
    materials: any[];
    specifications: string[];
    components: any[];
    confidence_score: number;
    processing_time: number;
    [key: string]: any;
  };
  error?: string;
}

export class PythonSketchClient {
  private pythonPath: string;
  private scriptPath: string;

  constructor() {
    // Path to Python executable (Replit provides python3)
    this.pythonPath = 'python3';
    
    // Path to our Python script
    this.scriptPath = path.join(process.cwd(), 'sketch-agent', 'main_standalone.py');
  }

  /**
   * Analyze a sketch image using Python agent
   */
  async analyzeSketch(
    imagePath: string,
    context?: string
  ): Promise<SketchAnalysisResult> {
    return new Promise((resolve, reject) => {
      // Verify image exists
      if (!fs.existsSync(imagePath)) {
        reject(new Error(`Image not found: ${imagePath}`));
        return;
      }

      // Build arguments
      const args = [this.scriptPath, imagePath];
      if (context) args.push(context);

      // Spawn Python process
      const python = spawn(this.pythonPath, args, {
        env: {
          ...process.env,
          PYTHONPATH: path.join(process.cwd(), 'sketch-agent')
        }
      });

      let stdout = '';
      let stderr = '';

      python.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      python.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      python.on('close', (code) => {
        if (code !== 0) {
          console.error('Python stderr:', stderr);
          reject(new Error(`Python process exited with code ${code}: ${stderr}`));
          return;
        }

        try {
          const result = JSON.parse(stdout);
          resolve(result);
        } catch (error) {
          console.error('Failed to parse Python output:', stdout);
          reject(new Error(`Invalid JSON from Python: ${error}`));
        }
      });

      python.on('error', (error) => {
        reject(new Error(`Failed to start Python process: ${error.message}`));
      });

      // Timeout after 5 minutes
      setTimeout(() => {
        python.kill();
        reject(new Error('Python process timeout'));
      }, 300000);
    });
  }

  /**
   * Analyze multiple sketches
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
      } catch (error: any) {
        results.push({
          success: false,
          error: error.message
        });
      }
    }

    return results;
  }

  /**
   * Check if Python environment is ready
   */
  async healthCheck(): Promise<boolean> {
    return new Promise((resolve) => {
      const python = spawn(this.pythonPath, ['--version']);
      
      python.on('close', (code) => {
        resolve(code === 0);
      });

      python.on('error', () => {
        resolve(false);
      });
    });
  }
}

// Export singleton
export const pythonSketchClient = new PythonSketchClient();
```

### File 3: `src/routes/rfp.routes.ts`

Updated route with Python integration:

```typescript
import { Router, Request, Response } from 'express';
import multer from 'multer';
import * as path from 'path';
import * as fs from 'fs';
import { pythonSketchClient } from '../services/pythonSketchClient';

const router = Router();

// Configure multer to save files temporarily
const upload = multer({
  dest: 'uploads/temp',
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
    files: 10
  }
});

/**
 * Classify files into sketches vs documents
 */
function classifyFiles(files: Express.Multer.File[]) {
  const sketchExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.pdf'];
  
  const sketches: Express.Multer.File[] = [];
  const documents: Express.Multer.File[] = [];
  
  files.forEach(file => {
    const ext = path.extname(file.originalname).toLowerCase();
    
    if (sketchExtensions.includes(ext)) {
      sketches.push(file);
    } else {
      documents.push(file);
    }
  });
  
  return { sketches, documents };
}

/**
 * Upload RFP with automatic sketch detection
 */
router.post(
  '/api/rfp/upload',
  upload.array('files', 10),
  async (req: Request, res: Response) => {
    try {
      const files = (req.files as Express.Multer.File[]) || [];
      const { rfp_text, context, project_id } = req.body;

      // Classify files
      const { sketches, documents } = classifyFiles(files);

      console.log(
        `RFP Upload: ${files.length} total, ` +
        `${sketches.length} sketches, ` +
        `${documents.length} documents`
      );

      // Process based on content type
      let workflow: string;
      let sketchResults: any[] = [];

      if (sketches.length > 0) {
        workflow = 'with-sketches';
        
        console.log(`Analyzing ${sketches.length} sketch(es) with Python agent...`);
        
        // Analyze sketches using Python
        try {
          const imagePaths = sketches.map(s => s.path);
          const results = await pythonSketchClient.analyzeMultiple(
            imagePaths,
            context
          );
          
          sketchResults = results
            .filter(r => r.success)
            .map(r => r.result);
          
          console.log(`✅ Analyzed ${sketchResults.length} sketches successfully`);
          
        } catch (error: any) {
          console.error('Sketch analysis error:', error);
          // Continue without sketch analysis
          workflow = 'sketch-analysis-failed';
        }
        
        // Clean up temp files
        sketches.forEach(s => {
          try {
            fs.unlinkSync(s.path);
          } catch (err) {
            console.error('Failed to delete temp file:', s.path);
          }
        });
        
      } else {
        workflow = 'text-only';
        console.log('Text-only RFP, skipping sketch analysis');
      }

      // TODO: Save to your database
      // const rfp = await db.rfp.create({...});

      res.json({
        success: true,
        rfp_id: 'generated-id', // Replace with actual DB ID
        workflow,
        has_sketches: sketches.length > 0,
        sketch_count: sketches.length,
        sketch_results: sketchResults,
        document_count: documents.length
      });

    } catch (error: any) {
      console.error('RFP upload error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

export default router;
```

---

## 🛠️ Installation Steps

### Step 1: Install Python Dependencies in Replit

Add to your `.replit` file:

```toml
[nix]
channel = "stable-23_11"

[deployment]
run = ["sh", "-c", "npm start"]

[[ports]]
localPort = 3000
externalPort = 80

[languages]
python3 = "latest"
nodejs = "18"
```

Then in Replit Shell:

```bash
# Install Python dependencies
cd sketch-agent
pip install -r requirements.txt --break-system-packages

# Go back to root
cd ..
```

### Step 2: Install Node.js Dependencies

```bash
npm install
# No additional packages needed - uses native child_process
```

### Step 3: Configure Environment

Add to your `.env` (Replit Secrets):

```bash
# Vision Provider
VISION_PROVIDER=gemini
GOOGLE_API_KEY=your-google-api-key

# Optional: Other providers
# OPENAI_API_KEY=your-key
# ANTHROPIC_API_KEY=your-key
```

### Step 4: Test Python Script

```bash
# Test Python script directly
cd sketch-agent
python3 main_standalone.py /path/to/test/image.png "Test context"

# Should output JSON
```

### Step 5: Update Your App

Add to `src/app.ts`:

```typescript
import rfpRoutes from './routes/rfp.routes';

app.use(rfpRoutes);
```

---

## 🧪 Testing

### Test 1: Health Check

```bash
# Test Python is available
python3 --version

# Test Python dependencies
cd sketch-agent
python3 -c "import PIL; print('PIL OK')"
python3 -c "from agents.sketch_agent_v2 import SketchAgent; print('Agent OK')"
```

### Test 2: Upload with Sketch

```bash
curl -X POST http://localhost:3000/api/rfp/upload \
  -F "files=@test-sketch.png" \
  -F "rfp_text=Test RFP" \
  -F "context=G+3 building"
```

Expected:
```json
{
  "success": true,
  "workflow": "with-sketches",
  "sketch_count": 1,
  "sketch_results": [...]
}
```

### Test 3: Text-Only Upload

```bash
curl -X POST http://localhost:3000/api/rfp/upload \
  -F "files=@document.docx" \
  -F "rfp_text=Service contract"
```

Expected:
```json
{
  "success": true,
  "workflow": "text-only",
  "sketch_count": 0
}
```

---

## 📂 Final Folder Structure

```
your-bidforge-repl/
├── src/
│   ├── services/
│   │   ├── ... (existing)
│   │   └── pythonSketchClient.ts ← NEW
│   ├── routes/
│   │   ├── ... (existing)
│   │   └── rfp.routes.ts ← UPDATED
│   └── app.ts ← UPDATE to add routes
│
├── sketch-agent/ ← NEW FOLDER
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
│   └── temp/ ← Temp folder for uploads
│
├── package.json
├── .replit
└── .env
```

---

## ✅ Advantages of This Approach

✅ **Single Repl** - Everything in one place
✅ **No HTTP overhead** - Direct process communication
✅ **Simpler deployment** - One Repl to manage
✅ **Keep existing code** - Minimal changes to your app
✅ **Use Python for AI** - Best tool for vision models
✅ **Use Node.js for app** - Your existing stack

---

## ⚠️ Important Notes

### Python in Replit:

Replit has Python3 available by default. The `.replit` config ensures it's set up correctly.

### File Permissions:

Make the Python script executable:
```bash
chmod +x sketch-agent/main_standalone.py
```

### Temp File Cleanup:

The code automatically deletes uploaded files after processing. Make sure `uploads/temp` folder exists:
```bash
mkdir -p uploads/temp
```

### Error Handling:

If Python process fails, the app continues without sketch analysis. Check logs for details.

---

## 🚀 Deployment Checklist

- [ ] Create `sketch-agent/` folder in your Repl
- [ ] Upload all Python files (14 files)
- [ ] Create `main_standalone.py`
- [ ] Create `requirements.txt` (copy from requirements_v2.txt)
- [ ] Install Python deps: `pip install -r requirements.txt --break-system-packages`
- [ ] Create `src/services/pythonSketchClient.ts`
- [ ] Update `src/routes/rfp.routes.ts`
- [ ] Update `.replit` config
- [ ] Add environment variables (VISION_PROVIDER, API_KEY)
- [ ] Create `uploads/temp` folder
- [ ] Test Python script directly
- [ ] Test via API upload
- [ ] Verify sketch analysis works

---

## 🎉 You're Done!

**One Repl with:**
- ✅ Your existing BidForge AI app (Node.js)
- ✅ Sketch agent (Python subprocess)
- ✅ Multi-provider vision support
- ✅ Conditional triggering (only when sketches uploaded)
- ✅ All in one place!

**Total time: ~30 minutes**

Ready to upload the files? 🚀
