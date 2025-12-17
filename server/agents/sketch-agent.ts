import { MultishotAgent, MultishotAgentInput } from './multishot-agent';
import { AgentOutput, AgentContext } from './base-agent';
import type { CompiledContext } from './context-builder';
import { PythonSketchClient, SketchAnalysisResult } from '../lib/pythonSketchClient';

export interface SketchAnalysisOutput {
  sketchId: string;
  documentType: string;
  projectPhase: string;
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
  quantities: Record<string, unknown>;
  standards: string[];
  regionalCodes: string[];
  annotations: string[];
  confidenceScore: number;
  processingTime: number;
  notes: string;
  warnings: string[];
}

export class SketchAgent extends MultishotAgent {
  name = 'sketch';
  description = 'Analyzes construction drawings and sketches to extract dimensions, materials, and specifications';
  
  private pythonClient: PythonSketchClient;

  constructor() {
    super();
    this.pythonClient = new PythonSketchClient();
  }

  protected async executeWithCompiledContext(
    compiledContext: CompiledContext,
    input: MultishotAgentInput,
    context: AgentContext
  ): Promise<AgentOutput> {
    return this.wrapExecution(async () => {
      const inputData = input.data as {
        imagePaths: string[];
        projectContext?: string;
        refinementContext?: string;
      };

      if (!inputData.imagePaths || inputData.imagePaths.length === 0) {
        return {
          success: false,
          error: 'No image paths provided for sketch analysis',
        };
      }

      this.log(`Analyzing ${inputData.imagePaths.length} sketch(es)`);

      const allResults: SketchAnalysisOutput[] = [];
      const errors: string[] = [];

      for (const imagePath of inputData.imagePaths) {
        try {
          const result = await this.pythonClient.analyzeSketch(
            imagePath,
            inputData.projectContext
          );

          if (result.success && result.result) {
            const normalizedResult: SketchAnalysisOutput = {
              sketchId: result.result.sketch_id,
              documentType: result.result.document_type,
              projectPhase: result.result.project_phase,
              dimensions: result.result.dimensions,
              materials: result.result.materials,
              specifications: result.result.specifications,
              components: result.result.components,
              quantities: result.result.quantities,
              standards: result.result.standards,
              regionalCodes: result.result.regional_codes,
              annotations: result.result.annotations,
              confidenceScore: result.result.confidence_score,
              processingTime: result.result.processing_time,
              notes: result.result.notes,
              warnings: result.result.warnings,
            };
            allResults.push(normalizedResult);
            this.log(`Analyzed sketch: ${normalizedResult.sketchId} (confidence: ${normalizedResult.confidenceScore})`);
          } else {
            errors.push(`Failed to analyze ${imagePath}: ${result.error}`);
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          errors.push(`Error analyzing ${imagePath}: ${errorMessage}`);
        }
      }

      if (allResults.length === 0) {
        return {
          success: false,
          error: `All sketch analyses failed: ${errors.join('; ')}`,
        };
      }

      const combinedAnalysis = this.combineAnalyses(allResults);

      await this.updateWorkingContext(context.projectId, {
        sketchAnalysisComplete: true,
        sketchCount: allResults.length,
        totalDimensions: combinedAnalysis.dimensions.length,
        totalMaterials: combinedAnalysis.materials.length,
        averageConfidence: combinedAnalysis.averageConfidence,
      });

      return {
        success: true,
        data: {
          analyses: allResults,
          combined: combinedAnalysis,
          errors: errors.length > 0 ? errors : undefined,
          logs: [
            `Analyzed ${allResults.length} sketch(es)`,
            `Extracted ${combinedAnalysis.dimensions.length} dimensions`,
            `Identified ${combinedAnalysis.materials.length} materials`,
            `Average confidence: ${combinedAnalysis.averageConfidence.toFixed(1)}%`,
          ],
        },
      };
    }, 'sketch analysis');
  }

  private combineAnalyses(analyses: SketchAnalysisOutput[]): {
    dimensions: SketchAnalysisOutput['dimensions'];
    materials: SketchAnalysisOutput['materials'];
    specifications: string[];
    components: SketchAnalysisOutput['components'];
    standards: string[];
    averageConfidence: number;
    warnings: string[];
  } {
    const dimensionsMap = new Map<string, SketchAnalysisOutput['dimensions'][0]>();
    const materialsMap = new Map<string, SketchAnalysisOutput['materials'][0]>();
    const specificationsSet = new Set<string>();
    const componentsMap = new Map<string, SketchAnalysisOutput['components'][0]>();
    const standardsSet = new Set<string>();
    const warningsSet = new Set<string>();
    let totalConfidence = 0;

    for (const analysis of analyses) {
      totalConfidence += analysis.confidenceScore;

      for (const dim of analysis.dimensions) {
        const key = `${dim.type}-${dim.value}-${dim.unit}`;
        const existing = dimensionsMap.get(key);
        if (!existing || dim.confidence > existing.confidence) {
          dimensionsMap.set(key, dim);
        }
      }

      for (const mat of analysis.materials) {
        const key = `${mat.name}-${mat.grade || 'none'}`;
        const existing = materialsMap.get(key);
        if (!existing || mat.confidence > existing.confidence) {
          materialsMap.set(key, mat);
        }
      }

      analysis.specifications.forEach(spec => specificationsSet.add(spec));

      for (const comp of analysis.components) {
        const key = `${comp.type}-${comp.size || 'none'}`;
        const existing = componentsMap.get(key);
        if (!existing || comp.confidence > existing.confidence) {
          componentsMap.set(key, comp);
        }
      }

      analysis.standards.forEach(std => standardsSet.add(std));
      analysis.warnings.forEach(warn => warningsSet.add(warn));
    }

    return {
      dimensions: Array.from(dimensionsMap.values()),
      materials: Array.from(materialsMap.values()),
      specifications: Array.from(specificationsSet),
      components: Array.from(componentsMap.values()),
      standards: Array.from(standardsSet),
      averageConfidence: analyses.length > 0 ? totalConfidence / analyses.length : 0,
      warnings: Array.from(warningsSet),
    };
  }
}

export const sketchAgent = new SketchAgent();
