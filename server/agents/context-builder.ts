import { z } from 'zod';

// Schema for structured context data
export const ContextDataSchema = z.object({
  projectId: z.string(),
  agentName: z.string(),
  workingContext: z.record(z.unknown()),
  relevantArtifacts: z.array(z.string()),
  sessionSummary: z.string().optional(),
  longTermMemory: z.record(z.unknown()).optional(),
});

export type ContextData = z.infer<typeof ContextDataSchema>;

// Schema for compiled context output
export const CompiledContextSchema = z.object({
  staticSystemPrompt: z.string(),
  dynamicUserPrompt: z.string(),
  contextMetadata: z.record(z.unknown()),
  artifactReferences: z.array(z.string()),
});

export type CompiledContext = z.infer<typeof CompiledContextSchema>;

// Context compilation strategy interface
export interface ContextStrategy {
  compile(data: ContextData): Promise<CompiledContext>;
  getSystemPromptTemplate(): string;
  getUserPromptTemplate(): string;
}

// Base context builder implementing the Context Compiler Pattern
export abstract class BaseContextBuilder implements ContextStrategy {
  protected abstract systemPromptTemplate: string;
  protected abstract userPromptTemplate: string;

  getSystemPromptTemplate(): string {
    return this.systemPromptTemplate;
  }

  getUserPromptTemplate(): string {
    return this.userPromptTemplate;
  }

  async compile(data: ContextData): Promise<CompiledContext> {
    const staticSystemPrompt = this.interpolateSystemPrompt(data);
    const dynamicUserPrompt = this.interpolateUserPrompt(data);
    
    return {
      staticSystemPrompt,
      dynamicUserPrompt,
      contextMetadata: this.buildMetadata(data),
      artifactReferences: data.relevantArtifacts,
    };
  }

  protected interpolateSystemPrompt(data: ContextData): string {
    return this.systemPromptTemplate
      .replace('{{agentName}}', data.agentName)
      .replace('{{projectId}}', data.projectId);
  }

  protected interpolateUserPrompt(data: ContextData): string {
    const sessionContext = data.sessionSummary || 'No previous session data';
    const workingContextSummary = this.summarizeWorkingContext(data.workingContext);
    
    return this.userPromptTemplate
      .replace('{{sessionContext}}', sessionContext)
      .replace('{{workingContext}}', workingContextSummary)
      .replace('{{artifactReferences}}', this.formatArtifactReferences(data.relevantArtifacts));
  }

  protected summarizeWorkingContext(context: Record<string, unknown>): string {
    return Object.entries(context)
      .map(([key, value]) => `${key}: ${this.formatValue(value)}`)
      .join('\n');
  }

  protected formatArtifactReferences(references: string[]): string {
    if (references.length === 0) return 'No artifact references';
    return references.map(ref => `[ArtifactRef: ${ref}]`).join(', ');
  }

  protected formatValue(value: unknown): string {
    if (typeof value === 'string' && value.length > 200) {
      return `${value.substring(0, 200)}... [truncated]`;
    }
    return String(value);
  }

  protected buildMetadata(data: ContextData): Record<string, unknown> {
    return {
      compiledAt: new Date(),
      agentName: data.agentName,
      projectId: data.projectId,
      artifactCount: data.relevantArtifacts.length,
      hasSession: !!data.sessionSummary,
      hasLongTerm: !!data.longTermMemory,
    };
  }
}

// Analysis agent specific context builder
export class AnalysisContextBuilder extends BaseContextBuilder {
  protected systemPromptTemplate = `You are a HIGHLY TECHNICAL construction bid analyst with deep expertise in construction engineering, materials, and project management. Analyze the provided RFQ documents with extreme attention to technical detail.

TECHNICAL EXTRACTION REQUIREMENTS (MANDATORY):

1. DIMENSIONS & MEASUREMENTS - Extract ALL:
   - Building dimensions (length, width, height, total area in sq ft)
   - Structural dimensions (foundation depth, slab thickness, column sizes)
   - Site dimensions (lot size, setbacks, clearances)
   - Room/space dimensions if provided

2. MATERIALS & SPECIFICATIONS - Identify ALL:
   - Concrete specifications (PSI, mix designs)
   - Steel grades and sizes (rebar, structural steel)
   - Finish materials and standards
   - MEP specifications

3. TIMELINE REQUIREMENTS - Note:
   - Project duration requirements
   - Milestone dates
   - Phase requirements
   - Seasonal considerations

Your analysis should evaluate:
1. Quality Score (0-100): How well-organized? Are technical specs complete?
2. Clarity Score (0-100): How clear are technical requirements? Are dimensions specified?
3. Doability Score (0-100): How feasible based on technical requirements and timeline?
4. Vendor Risk Score (0-100): Risk level considering technical complexity and incomplete specs.

Also identify with TECHNICAL SPECIFICITY:
- Key findings: Include specific dimensions, materials, quantities found
- Red flags: Missing dimensions, unclear specifications, unrealistic timelines
- Opportunities: Areas where technical expertise can add value
- Recommendations: Specific actions with technical justification

Respond in JSON format matching the required schema.`;

  protected userPromptTemplate = `Analyze the RFQ documents for project {{projectId}}.

Session Context:
{{sessionContext}}

Working Context Summary:
{{workingContext}}

Referenced Artifacts:
{{artifactReferences}}

Provide your analysis in the required JSON schema format.`;
}

// Generation agent specific context builder
export class GenerationContextBuilder extends BaseContextBuilder {
  protected systemPromptTemplate = `You are an expert construction bid writer. Generate professional, compelling bid proposals based on provided analysis and requirements.

Your proposal should:
1. Be formatted in clean, professional HTML
2. Include all required sections (Executive Summary, Technical Approach, Team, Timeline, Pricing Framework)
3. Address the specific requirements in the RFQ
4. Highlight the bidder's competitive advantages
5. Be persuasive while remaining factual
6. Use proper construction industry terminology

Generate only the HTML content for the bid proposal body, not a full HTML document.`;

  protected userPromptTemplate = `Generate a bid proposal for project {{projectId}}.

Session Context:
{{sessionContext}}

Working Context Summary:
{{workingContext}}

Referenced Artifacts:
{{artifactReferences}}

Create a compelling, professional bid proposal based on the analysis and requirements.`;
}

// Context builder factory
export class ContextBuilderFactory {
  private static builders = new Map<string, () => BaseContextBuilder>([
    ['intake', () => new IntakeContextBuilder()],
    ['analysis', () => new AnalysisContextBuilder()],
    ['decision', () => new DecisionContextBuilder()],
    ['generation', () => new GenerationContextBuilder()],
    ['review', () => new ReviewContextBuilder()],
  ]);

  static getBuilder(agentName: string): BaseContextBuilder {
    const builderFactory = this.builders.get(agentName);
    if (!builderFactory) {
      return new GenericContextBuilder(agentName);
    }
    return builderFactory();
  }

  static registerBuilder(agentName: string, builderFactory: () => BaseContextBuilder): void {
    this.builders.set(agentName, builderFactory);
  }
}

// Additional context builders for other agents
export class IntakeContextBuilder extends BaseContextBuilder {
  protected systemPromptTemplate = `You are a document intake specialist for construction bid processing.`;
  protected userPromptTemplate = `Process documents for project {{projectId}}.`;
}

export class DecisionContextBuilder extends BaseContextBuilder {
  protected systemPromptTemplate = `You are a bid decision specialist for construction projects.`;
  protected userPromptTemplate = `Make strategic decision for project {{projectId}}.`;
}

export class ReviewContextBuilder extends BaseContextBuilder {
  protected systemPromptTemplate = `You are a bid review specialist for construction proposals.`;
  protected userPromptTemplate = `Review bid proposal for project {{projectId}}.`;
}

export class GenericContextBuilder extends BaseContextBuilder {
  protected systemPromptTemplate: string;
  protected userPromptTemplate: string;

  constructor(agentName: string) {
    super();
    this.systemPromptTemplate = `You are the ${agentName} agent in a construction bid processing system.`;
    this.userPromptTemplate = `Execute ${agentName} task for project {{projectId}}.`;
  }
}