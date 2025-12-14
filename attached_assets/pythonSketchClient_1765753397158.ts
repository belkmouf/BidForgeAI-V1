/**
 * Python Sketch Client
 * 
 * Calls Python sketch agent as subprocess from Node.js.
 * Uses child_process to spawn Python and communicate via JSON.
 */

import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

export interface SketchDimension {
  type: string;
  value: number;
  unit: string;
  location?: string;
  confidence: number;
}

export interface SketchMaterial {
  name: string;
  grade?: string;
  specification?: string;
  quantity?: number;
  unit?: string;
  standard?: string;
  confidence: number;
}

export interface SketchComponent {
  type: string;
  size?: string;
  count?: number;
  location?: string;
  confidence: number;
}

export interface SketchAnalysisResult {
  success: boolean;
  result?: {
    sketch_id: string;
    document_type: string;
    project_phase: string;
    dimensions: SketchDimension[];
    materials: SketchMaterial[];
    specifications: string[];
    components: SketchComponent[];
    quantities: Record<string, any>;
    standards: string[];
    regional_codes: string[];
    annotations: string[];
    revisions: any[];
    confidence_score: number;
    processing_time: number;
    notes: string;
    warnings: string[];
  };
  error?: string;
  error_type?: string;
}

export class PythonSketchClient {
  private pythonPath: string;
  private scriptPath: string;
  private sketchAgentDir: string;

  constructor() {
    // Python executable (Replit provides python3)
    this.pythonPath = process.env.PYTHON_PATH || 'python3';
    
    // Path to sketch agent directory
    this.sketchAgentDir = path.join(process.cwd(), 'sketch-agent');
    
    // Path to our Python wrapper script
    this.scriptPath = path.join(this.sketchAgentDir, 'main_standalone.py');
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
        resolve({
          success: false,
          error: `Image not found: ${imagePath}`,
          error_type: 'FileNotFoundError'
        });
        return;
      }

      // Verify Python script exists
      if (!fs.existsSync(this.scriptPath)) {
        resolve({
          success: false,
          error: `Python script not found: ${this.scriptPath}`,
          error_type: 'FileNotFoundError'
        });
        return;
      }

      // Build arguments
      const args = [this.scriptPath, imagePath];
      if (context) args.push(context);

      console.log(`Spawning Python: ${this.pythonPath} ${args.join(' ')}`);

      // Spawn Python process
      const python = spawn(this.pythonPath, args, {
        env: {
          ...process.env,
          PYTHONPATH: this.sketchAgentDir,
          PYTHONUNBUFFERED: '1' // Disable output buffering
        },
        cwd: this.sketchAgentDir
      });

      let stdout = '';
      let stderr = '';

      python.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      python.stderr.on('data', (data) => {
        stderr += data.toString();
        console.error('Python stderr:', data.toString());
      });

      python.on('close', (code) => {
        if (code !== 0) {
          console.error(`Python process exited with code ${code}`);
          console.error('stderr:', stderr);
          resolve({
            success: false,
            error: `Python process exited with code ${code}: ${stderr}`,
            error_type: 'ProcessError'
          });
          return;
        }

        try {
          // Parse JSON output
          const result: SketchAnalysisResult = JSON.parse(stdout);
          resolve(result);
        } catch (error: any) {
          console.error('Failed to parse Python output:', stdout);
          resolve({
            success: false,
            error: `Invalid JSON from Python: ${error.message}`,
            error_type: 'JSONParseError'
          });
        }
      });

      python.on('error', (error) => {
        console.error('Failed to start Python process:', error);
        resolve({
          success: false,
          error: `Failed to start Python process: ${error.message}`,
          error_type: 'SpawnError'
        });
      });

      // Timeout after 5 minutes
      const timeout = setTimeout(() => {
        python.kill();
        resolve({
          success: false,
          error: 'Python process timeout (5 minutes)',
          error_type: 'TimeoutError'
        });
      }, 300000);

      // Clear timeout on completion
      python.on('close', () => clearTimeout(timeout));
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
      console.log(`Analyzing sketch: ${imagePath}`);
      const result = await this.analyzeSketch(imagePath, context);
      results.push(result);
      
      if (result.success) {
        console.log(`✅ Analyzed ${imagePath} (confidence: ${result.result?.confidence_score}%)`);
      } else {
        console.error(`❌ Failed to analyze ${imagePath}: ${result.error}`);
      }
    }

    return results;
  }

  /**
   * Check if Python environment is ready
   */
  async healthCheck(): Promise<{
    available: boolean;
    python_version?: string;
    script_exists: boolean;
    error?: string;
  }> {
    return new Promise((resolve) => {
      // Check if script exists
      const scriptExists = fs.existsSync(this.scriptPath);
      
      if (!scriptExists) {
        resolve({
          available: false,
          script_exists: false,
          error: `Python script not found at ${this.scriptPath}`
        });
        return;
      }

      // Check Python version
      const python = spawn(this.pythonPath, ['--version']);
      
      let output = '';
      
      python.stdout.on('data', (data) => {
        output += data.toString();
      });

      python.stderr.on('data', (data) => {
        output += data.toString();
      });

      python.on('close', (code) => {
        if (code === 0) {
          resolve({
            available: true,
            python_version: output.trim(),
            script_exists: true
          });
        } else {
          resolve({
            available: false,
            script_exists: true,
            error: 'Python not available'
          });
        }
      });

      python.on('error', (error) => {
        resolve({
          available: false,
          script_exists: true,
          error: error.message
        });
      });
    });
  }

  /**
   * Test Python dependencies
   */
  async testDependencies(): Promise<{
    success: boolean;
    missing?: string[];
    error?: string;
  }> {
    const requiredModules = [
      'PIL',
      'anthropic',
      'openai',
      'google.generativeai',
      'pydantic'
    ];

    const testScript = `
import sys
import json

missing = []
for module in ${JSON.stringify(requiredModules)}:
    try:
        __import__(module)
    except ImportError:
        missing.append(module)

print(json.dumps({"missing": missing}))
`;

    return new Promise((resolve) => {
      const python = spawn(this.pythonPath, ['-c', testScript]);

      let output = '';

      python.stdout.on('data', (data) => {
        output += data.toString();
      });

      python.on('close', (code) => {
        if (code === 0) {
          try {
            const result = JSON.parse(output);
            resolve({
              success: result.missing.length === 0,
              missing: result.missing
            });
          } catch (error: any) {
            resolve({
              success: false,
              error: 'Failed to parse dependency check output'
            });
          }
        } else {
          resolve({
            success: false,
            error: 'Dependency check failed'
          });
        }
      });

      python.on('error', (error) => {
        resolve({
          success: false,
          error: error.message
        });
      });
    });
  }
}

// Export singleton instance
export const pythonSketchClient = new PythonSketchClient();
