import { BaseAgent, AgentInput, AgentOutput, AgentContext } from './base-agent';
import type { CompiledContext } from './context-builder';
import type { SketchAnalysisOutput } from './sketch-agent';
import { ChatOpenAI } from '@langchain/openai';
import { z } from 'zod';

export interface ConflictOutput {
  hasConflicts: boolean;
  criticalConflicts: ConflictItem[];
  warnings: ConflictItem[];
  costImpact: number;
  confidenceScore: number;
  recommendation: 'PROCEED' | 'REVIEW_REQUIRED' | 'HARD_STOP';
}

export interface ConflictItem {
  id: string;
  type: 'quantity_mismatch' | 'material_discrepancy' | 'dimension_conflict' | 'specification_gap';
  severity: 'critical' | 'high' | 'medium' | 'low';
  source1: { document: string; value: string | number; location?: string };
  source2: { document: string; value: string | number; location?: string };
  description: string;
  estimatedCostImpact: number;
  resolution?: string;
}

const ConflictResponseSchema = z.object({
  conflicts: z.array(z.object({
    type: z.enum(['quantity_mismatch', 'material_discrepancy', 'dimension_conflict', 'specification_gap']),
    severity: z.enum(['critical', 'high', 'medium', 'low']),
    boqValue: z.string(),
    sketchValue: z.string(),
    description: z.string(),
    costImpactPercent: z.number(),
  })).default([]),
  overallConfidence: z.number().min(0).max(100).default(75),
  summary: z.string().default(''),
});

export class ConflictDetectionAgent extends BaseAgent {
  name = 'conflict-detection';
  description = 'Cross-modal conflict detection: compares BOQ text against Sketch Vision outputs';

  protected async executeWithCompiledContext(
    compiledContext: CompiledContext,
    input: AgentInput,
    context: AgentContext
  ): Promise<AgentOutput> {
    return this.wrapExecution(async () => {
      const inputData = input.data as {
        documents?: Array<{ id: number; name: string; content?: string }>;
        sketchAnalysis?: SketchAnalysisOutput[];
        analysis?: { keyFindings?: string[] };
      };

      const documents = inputData.documents || [];
      const sketchAnalysis = inputData.sketchAnalysis || [];

      this.log(`Analyzing conflicts between ${documents.length} documents and ${sketchAnalysis.length} sketch analyses`);

      if (documents.length === 0) {
        return {
          success: true,
          data: {
            conflictDetection: {
              hasConflicts: false,
              criticalConflicts: [],
              warnings: [],
              costImpact: 0,
              confidenceScore: 100,
              recommendation: 'PROCEED' as const,
            },
            logs: ['No documents to analyze for conflicts'],
          },
        };
      }

      const boqContent = this.extractBOQContent(documents);
      const sketchQuantities = this.extractSketchQuantities(sketchAnalysis);

      if (!boqContent && sketchAnalysis.length === 0) {
        this.log('No BOQ or sketch data available - skipping conflict detection');
        return {
          success: true,
          data: {
            conflictDetection: {
              hasConflicts: false,
              criticalConflicts: [],
              warnings: [],
              costImpact: 0,
              confidenceScore: 50,
              recommendation: 'PROCEED' as const,
            },
            logs: ['Insufficient data for cross-modal conflict detection'],
          },
        };
      }

      const conflicts = await this.detectConflictsWithAI(boqContent, sketchQuantities, documents);

      const totalCostImpact = conflicts.reduce((sum, c) => sum + c.estimatedCostImpact, 0);

      // HARD_STOP triggers on:
      // 1. Any single conflict with >20% cost impact (regardless of severity)
      // 2. Aggregate cost impact exceeds 20%
      // 3. Critical severity conflicts
      const hasHighCostConflict = conflicts.some(c => c.estimatedCostImpact > 20);
      const hasAggregateCostExceeded = totalCostImpact > 20;
      const hasCriticalSeverity = conflicts.some(c => c.severity === 'critical');

      const shouldHardStop = hasHighCostConflict || hasAggregateCostExceeded || hasCriticalSeverity;

      // Critical conflicts include any that trigger hard stop conditions
      const criticalConflicts = conflicts.filter(c => 
        c.severity === 'critical' || 
        c.estimatedCostImpact > 20
      );
      const warnings = conflicts.filter(c => !criticalConflicts.includes(c));

      let recommendation: 'PROCEED' | 'REVIEW_REQUIRED' | 'HARD_STOP' = 'PROCEED';
      if (shouldHardStop) {
        recommendation = 'HARD_STOP';
      } else if (criticalConflicts.length > 0 || warnings.length > 3) {
        recommendation = 'REVIEW_REQUIRED';
      }

      const conflictOutput: ConflictOutput = {
        hasConflicts: conflicts.length > 0,
        criticalConflicts,
        warnings,
        costImpact: totalCostImpact,
        confidenceScore: 85,
        recommendation,
      };

      this.log(`Conflict detection complete: ${criticalConflicts.length} critical, ${warnings.length} warnings`);
      this.log(`Recommendation: ${recommendation}, Cost Impact: ${totalCostImpact}%`);

      if (recommendation === 'HARD_STOP') {
        const reasons: string[] = [];
        if (hasHighCostConflict) reasons.push('single conflict >20% cost impact');
        if (hasAggregateCostExceeded) reasons.push(`aggregate cost impact ${totalCostImpact.toFixed(1)}% exceeds 20%`);
        if (hasCriticalSeverity) reasons.push('critical severity conflict detected');

        return {
          success: false,
          error: `HARD_STOP: ${reasons.join('; ')}. ${criticalConflicts.length} critical discrepancies found.`,
          data: {
            conflictDetection: conflictOutput,
            hardStop: true,
            hardStopReasons: reasons,
            logs: [
              `HARD STOP triggered: ${reasons.join('; ')}`,
              `Critical conflicts: ${criticalConflicts.map(c => c.description).join('; ')}`,
            ],
          },
        };
      }

      return {
        success: true,
        data: {
          conflictDetection: conflictOutput,
          logs: [
            `Detected ${conflicts.length} total conflicts`,
            `Critical: ${criticalConflicts.length}, Warnings: ${warnings.length}`,
            `Recommendation: ${recommendation}`,
          ],
        },
      };
    }, 'cross-modal conflict detection');
  }

  private extractBOQContent(documents: Array<{ name: string; content?: string }>): string {
    const boqDocs = documents.filter(doc => 
      doc.name.toLowerCase().includes('boq') ||
      doc.name.toLowerCase().includes('bill of quantities') ||
      doc.name.toLowerCase().includes('quantity')
    );

    if (boqDocs.length > 0) {
      return boqDocs.map(d => d.content || '').join('\n\n');
    }

    return documents.map(d => d.content || '').join('\n\n').slice(0, 50000);
  }

  private extractSketchQuantities(sketchAnalysis: SketchAnalysisOutput[]): Record<string, unknown> {
    const quantities: Record<string, unknown> = {
      dimensions: [] as Array<{ type: string; value: number; unit: string }>,
      materials: [] as Array<{ name: string; quantity: number | null; unit: string | null }>,
      components: [] as Array<{ type: string; count: number | null }>,
    };

    for (const sketch of sketchAnalysis) {
      if (sketch.dimensions) {
        (quantities.dimensions as Array<unknown>).push(...sketch.dimensions);
      }
      if (sketch.materials) {
        (quantities.materials as Array<unknown>).push(...sketch.materials);
      }
      if (sketch.components) {
        (quantities.components as Array<unknown>).push(...sketch.components);
      }
      if (sketch.quantities) {
        Object.assign(quantities, sketch.quantities);
      }
    }

    return quantities;
  }

  private async detectConflictsWithAI(
    boqContent: string,
    sketchQuantities: Record<string, unknown>,
    documents: Array<{ name: string; content?: string }>
  ): Promise<ConflictItem[]> {
    const model = new ChatOpenAI({
      model: 'gpt-4o',
      temperature: 0.1,
    });

    const systemPrompt = `You are a construction project conflict detection specialist. 
Your task is to compare Bill of Quantities (BOQ) data against drawing/sketch analysis data to find discrepancies.

Focus on:
1. Quantity mismatches (e.g., BOQ says 24 structures but drawing shows 12)
2. Material discrepancies (BOQ specifies Grade 40 concrete but drawing shows Grade 35)
3. Dimension conflicts (BOQ dimensions don't match drawing dimensions)
4. Specification gaps (items in BOQ not shown in drawings or vice versa)

For each conflict, assess:
- Severity: critical (showstopper), high (major cost impact), medium (moderate issue), low (minor)
- Estimated cost impact as percentage (0-100%)

Critical conflicts with >20% cost impact should be flagged for HARD STOP.

Respond in JSON format with the schema provided.`;

    const userPrompt = `Compare these sources for conflicts:

## BOQ/Document Content:
${boqContent.slice(0, 20000)}

## Extracted from Drawings/Sketches:
${JSON.stringify(sketchQuantities, null, 2)}

Identify all quantity mismatches, material discrepancies, and specification gaps.`;

    try {
      const response = await model.invoke([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ]);

      const content = typeof response.content === 'string'
        ? response.content
        : JSON.stringify(response.content);

      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        this.log('No valid JSON in conflict detection response');
        return [];
      }

      const parsed = ConflictResponseSchema.parse(JSON.parse(jsonMatch[0]));

      return parsed.conflicts.map((c, idx) => ({
        id: `conflict-${idx + 1}`,
        type: c.type,
        severity: c.severity,
        source1: { document: 'BOQ', value: c.boqValue },
        source2: { document: 'Drawing', value: c.sketchValue },
        description: c.description,
        estimatedCostImpact: c.costImpactPercent,
      }));
    } catch (error) {
      this.log(`AI conflict detection failed: ${error}`);
      return [];
    }
  }
}

export const conflictDetectionAgent = new ConflictDetectionAgent();
