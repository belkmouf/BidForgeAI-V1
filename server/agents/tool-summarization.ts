import { z } from 'zod';

// Base schema for all tool output summaries
export const ToolOutputSummarySchema = z.object({
  agentName: z.string(),
  toolName: z.string(),
  executedAt: z.date(),
  status: z.enum(['success', 'failed', 'cancelled']),
  summary: z.string(),
  keyData: z.record(z.unknown()),
  artifactReference: z.string().optional(),
  originalSize: z.number(),
  compressedSize: z.number(),
});

export type ToolOutputSummary = z.infer<typeof ToolOutputSummarySchema>;

// Tool output summarization interface
export interface IToolSummarizer<T = unknown> {
  summarize(toolOutput: T, metadata: { agentName: string; toolName: string }): ToolOutputSummary;
  extractKeyData(toolOutput: T): Record<string, unknown>;
  shouldOffload(toolOutput: T): boolean;
  getCompressionRatio(original: T, summary: ToolOutputSummary): number;
}

// Base tool summarizer with common functionality
export abstract class BaseToolSummarizer<T = unknown> implements IToolSummarizer<T> {
  protected maxSummaryLength = 500;
  protected offloadThreshold = 50; // lines

  abstract summarize(toolOutput: T, metadata: { agentName: string; toolName: string }): ToolOutputSummary;
  abstract extractKeyData(toolOutput: T): Record<string, unknown>;

  shouldOffload(toolOutput: T): boolean {
    const content = JSON.stringify(toolOutput);
    const lines = content.split('\n').length;
    return lines > this.offloadThreshold;
  }

  getCompressionRatio(original: T, summary: ToolOutputSummary): number {
    const originalSize = JSON.stringify(original).length;
    const summarySize = summary.compressedSize;
    return originalSize > 0 ? summarySize / originalSize : 0;
  }

  protected generateBaseSummary(
    toolOutput: T,
    metadata: { agentName: string; toolName: string },
    specificSummary: string,
    keyData: Record<string, unknown>,
    artifactRef?: string
  ): ToolOutputSummary {
    const originalContent = JSON.stringify(toolOutput);
    
    return {
      agentName: metadata.agentName,
      toolName: metadata.toolName,
      executedAt: new Date(),
      status: 'success',
      summary: specificSummary,
      keyData,
      artifactReference: artifactRef,
      originalSize: originalContent.length,
      compressedSize: specificSummary.length + JSON.stringify(keyData).length,
    };
  }

  protected truncateString(str: string, maxLength: number): string {
    if (str.length <= maxLength) return str;
    return str.substring(0, maxLength - 3) + '...';
  }
}

// Document analysis summarizer
export class DocumentAnalysisSummarizer extends BaseToolSummarizer {
  summarize(toolOutput: any, metadata: { agentName: string; toolName: string }): ToolOutputSummary {
    const analysis = toolOutput.analysis || toolOutput;
    
    if (!analysis || typeof analysis !== 'object') {
      return this.generateBaseSummary(
        toolOutput,
        metadata,
        'Invalid analysis output format',
        {},
      );
    }

    const summary = `Analyzed documents with ${analysis.overallRiskLevel || 'Unknown'} risk level. ` +
      `Quality: ${analysis.qualityScore || 0}/100, ` +
      `Doability: ${analysis.doabilityScore || 0}/100. ` +
      `Found ${analysis.keyFindings?.length || 0} key findings and ${analysis.redFlags?.length || 0} red flags.`;

    const keyData = this.extractKeyData(toolOutput);

    return this.generateBaseSummary(toolOutput, metadata, summary, keyData);
  }

  extractKeyData(toolOutput: any): Record<string, unknown> {
    const analysis = toolOutput.analysis || toolOutput;
    
    return {
      qualityScore: analysis.qualityScore,
      clarityScore: analysis.clarityScore,
      doabilityScore: analysis.doabilityScore,
      vendorRiskScore: analysis.vendorRiskScore,
      overallRiskLevel: analysis.overallRiskLevel,
      keyFindingsCount: analysis.keyFindings?.length || 0,
      redFlagsCount: analysis.redFlags?.length || 0,
      opportunitiesCount: analysis.opportunities?.length || 0,
      recommendationsCount: analysis.recommendations?.length || 0,
    };
  }
}

// Document processing summarizer
export class DocumentProcessingSummarizer extends BaseToolSummarizer {
  summarize(toolOutput: any, metadata: { agentName: string; toolName: string }): ToolOutputSummary {
    const documents = toolOutput.documents || [];
    
    if (!Array.isArray(documents)) {
      return this.generateBaseSummary(
        toolOutput,
        metadata,
        'Invalid document processing output',
        {},
      );
    }

    const totalChars = documents.reduce((sum: number, doc: any) => 
      sum + (doc.content?.length || 0), 0);
    
    const types = [...new Set(documents.map((doc: any) => doc.type || 'unknown'))];
    
    const summary = `Processed ${documents.length} documents (${totalChars} characters). ` +
      `Types: ${types.join(', ')}. Ready for analysis.`;

    const keyData = this.extractKeyData(toolOutput);

    return this.generateBaseSummary(toolOutput, metadata, summary, keyData);
  }

  extractKeyData(toolOutput: any): Record<string, unknown> {
    const documents = toolOutput.documents || [];
    
    return {
      documentCount: documents.length,
      totalCharacters: documents.reduce((sum: number, doc: any) => 
        sum + (doc.content?.length || 0), 0),
      documentTypes: [...new Set(documents.map((doc: any) => doc.type || 'unknown'))],
      processedCount: documents.filter((doc: any) => doc.processedAt).length,
      hasErrors: toolOutput.errors && toolOutput.errors.length > 0,
      errorCount: toolOutput.errors?.length || 0,
    };
  }
}

// Generic summarizer for unknown tool outputs
export class GenericToolSummarizer extends BaseToolSummarizer {
  summarize(toolOutput: any, metadata: { agentName: string; toolName: string }): ToolOutputSummary {
    const outputStr = JSON.stringify(toolOutput);
    const summary = this.truncateString(
      `${metadata.agentName} tool executed. Output: ${outputStr}`,
      this.maxSummaryLength
    );

    const keyData = this.extractKeyData(toolOutput);

    return this.generateBaseSummary(toolOutput, metadata, summary, keyData);
  }

  extractKeyData(toolOutput: any): Record<string, unknown> {
    if (typeof toolOutput === 'object' && toolOutput !== null) {
      const keyData: Record<string, unknown> = {};
      
      // Extract simple fields only
      for (const [key, value] of Object.entries(toolOutput)) {
        if (typeof value === 'string' && value.length < 100) {
          keyData[key] = value;
        } else if (typeof value === 'number' || typeof value === 'boolean') {
          keyData[key] = value;
        } else if (Array.isArray(value)) {
          keyData[`${key}_length`] = value.length;
        }
      }
      
      return keyData;
    }
    
    return { output: String(toolOutput).substring(0, 100) };
  }
}

// Summarizer factory and registry
export class ToolSummarizerFactory {
  private static summarizers = new Map<string, () => BaseToolSummarizer>([
    ['intake', () => new DocumentProcessingSummarizer()],
    ['analysis', () => new DocumentAnalysisSummarizer()],
    ['decision', () => new GenericToolSummarizer()],
    ['generation', () => new GenericToolSummarizer()],
    ['review', () => new GenericToolSummarizer()],
  ]);

  static getSummarizer(agentName: string): BaseToolSummarizer {
    const summarizerFactory = this.summarizers.get(agentName);
    if (!summarizerFactory) {
      return new GenericToolSummarizer();
    }
    return summarizerFactory();
  }

  static registerSummarizer(agentName: string, summarizerFactory: () => BaseToolSummarizer): void {
    this.summarizers.set(agentName, summarizerFactory);
  }
}