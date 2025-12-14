/**
 * Python Sketch Client - Node.js ↔ Python Integration
 *
 * Spawns Python subprocess to analyze construction drawings/sketches.
 * Only called when images are uploaded (conditional triggering for cost savings).
 */

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
   * Analyze a single sketch/construction drawing using Python agent
   *
   * @param imagePath - Absolute path to image file
   * @param context - Optional project context (e.g., "G+5 residential Dubai Marina")
   * @returns Analysis result with dimensions, materials, specs, etc.
   */
  async analyzeSketch(
    imagePath: string,
    context?: string
  ): Promise<SketchAnalysisResult> {
    return new Promise(async (resolve, reject) => {
      // Validate image exists
      try {
        await fs.access(imagePath);
      } catch {
        reject(new Error(`Image file not found: ${imagePath}`));
        return;
      }

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

      // Timeout after 5 minutes (generous for complex drawings)
      setTimeout(() => {
        python.kill();
        reject(new Error('Python process timeout after 5 minutes'));
      }, 300000);
    });
  }

  /**
   * Analyze multiple sketches sequentially
   *
   * @param imagePaths - Array of absolute paths to image files
   * @param context - Optional project context
   * @returns Array of analysis results (one per image)
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
          error: error instanceof Error ? error.message : String(error),
          error_type: 'AnalysisError'
        });
      }
    }

    return results;
  }

  /**
   * Health check - verify Python and dependencies are available
   *
   * @returns Object with availability status and Python version
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
