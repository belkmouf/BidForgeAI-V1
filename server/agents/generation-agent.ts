import type { CompiledContext } from './context-builder';
import { BaseAgent, AgentInput, AgentOutput, AgentContext } from './base-agent';
import { DraftResultType, DocumentInfoType, AnalysisResultType } from './state';
import { ChatOpenAI } from '@langchain/openai';
import { ChatAnthropic } from '@langchain/anthropic';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';

export class GenerationAgent extends BaseAgent {
  name = 'generation';
  description = 'Generates professional bid proposals based on analyzed RFQ documents';

  private getModel(modelName: string = 'openai') {
    switch (modelName) {
      case 'anthropic':
        return new ChatAnthropic({
          model: 'claude-sonnet-4-20250514',
          temperature: 0.7,
        });
      case 'gemini':
        return new ChatGoogleGenerativeAI({
          model: 'gemini-2.5-flash-preview-04-17',
          temperature: 0.7,
        });
      default:
        return new ChatOpenAI({
          model: 'gpt-4o',
          temperature: 0.7,
        });
    }
  }

  protected async executeWithCompiledContext(
    compiledContext: CompiledContext,
    input: AgentInput,
    context: AgentContext
  ): Promise<AgentOutput> {
    return this.wrapExecution(async () => {
      const state = input.data as {
        documents?: DocumentInfoType[];
        analysis?: AnalysisResultType;
        review?: { feedback?: string[]; attempts?: number };
      };

      const docs = state.documents || [];
      const analysis = state.analysis;

      if (docs.length === 0) {
        return {
          success: false,
          error: 'No documents available for bid generation',
        };
      }

      this.log('Generating bid proposal using compiled context');

      // Store analysis as artifact if available
      let analysisArtifact: string | undefined;
      if (analysis) {
        analysisArtifact = await this.storeIntermediateArtifact(
          context.projectId,
          analysis,
          'analysis_result'
        );
      }

      // Update working context
      await this.updateWorkingContext(context.projectId, {
        generationStage: 'started',
        documentCount: docs.length,
        hasAnalysis: !!analysis,
        analysisArtifact,
        reviewAttempts: state.review?.attempts || 0,
      });

      const model = this.getModel('openai');

      let analysisContext = '';
      if (analysis) {
        analysisContext = `
Analysis Summary:
- Quality Score: ${analysis.qualityScore}/100
- Clarity Score: ${analysis.clarityScore}/100
- Doability Score: ${analysis.doabilityScore}/100
- Risk Level: ${analysis.overallRiskLevel}

Key Findings:
${analysis.keyFindings.map(f => `- ${f}`).join('\n')}

Opportunities:
${analysis.opportunities.map(o => `- ${o}`).join('\n')}
`;
      }

      const previousFeedback = state.review?.feedback?.length
        ? `\n\nPrevious Review Feedback (attempt ${state.review.attempts}):\n${state.review.feedback.map(f => `- ${f}`).join('\n')}`
        : '';

      // Build document content from docs array
      const documentContent = docs
        .map((doc, idx) => `Document ${idx + 1} (${doc.name}):\n${doc.content || ''}`)
        .join('\n\n');

      const systemPrompt = `You are a HIGHLY TECHNICAL expert construction bid writer with deep expertise in construction methodology, materials, and project scheduling. Generate a professional, technically comprehensive bid proposal.

CRITICAL TECHNICAL REQUIREMENTS:

1. DIMENSIONS & MEASUREMENTS (MANDATORY):
   - Extract and include ALL dimensions from the RFQ documents
   - Specify areas (sq ft/sq m), volumes (cu yd/cu m), lengths, heights
   - Include structural dimensions, clearances, setbacks
   - Reference drawing numbers and specification sections

2. MATERIALS & SPECIFICATIONS (MANDATORY):
   - Specify exact material grades (e.g., "Concrete: 4000 PSI per ACI 318")
   - Include ASTM, ACI, AISC, or other applicable standards
   - List reinforcement specifications (rebar sizes, grades)
   - Specify finishes, coatings, and treatments with product standards

3. CONSTRUCTION METHODOLOGY:
   - Detail construction sequencing and phases
   - Specify equipment requirements (cranes, excavators, etc.)
   - Include temporary works requirements
   - Describe quality control procedures and testing protocols

4. TIMELINE GENERATION (CRITICAL):
   - Create realistic phase-by-phase timeline based on scope
   - Aggregate durations: excavation (X weeks), foundation (Y weeks), structure (Z weeks), etc.
   - Consider weather contingencies and curing times
   - Include milestone dates and critical path items
   - Base timeline estimates on industry standards:
     * Excavation: 1-2 weeks per 1000 cu yd
     * Concrete foundation: 2-4 weeks depending on complexity
     * Structural steel: 1-2 weeks per floor
     * MEP rough-in: 3-6 weeks depending on scope
     * Finishes: 4-8 weeks depending on specifications
   - Total project timeline should be sum of all phases with appropriate overlap

5. RESOURCE REQUIREMENTS:
   - Labor categories and estimated hours
   - Subcontractor scope breakdown
   - Equipment mobilization schedule

Your proposal MUST include these sections with SPECIFIC technical details:
- Executive Summary (with project scope dimensions)
- Technical Scope of Work (ALL dimensions, materials with standards)
- Construction Methodology (sequencing, equipment, methods)
- Project Timeline (phase breakdown with durations, total aggregated timeline)
- Quality Assurance Plan (testing protocols, inspection points)
- Resource Plan (labor, equipment, subcontractors)
- Pricing Framework (unit rates where applicable)

DO NOT use placeholder text like "[TBD]", "[INSERT HERE]", or generic statements.
ALL technical details must be SPECIFIC and derived from the RFQ documents.

Generate only the HTML content for the bid proposal body, not a full HTML document.`;

      const userPrompt = `Generate a bid proposal for this RFQ:

${analysisContext}

RFQ Documents:
${documentContent.slice(0, 40000)}${previousFeedback}`;

      try {
        const response = await model.invoke([
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ]);

        const content = typeof response.content === 'string'
          ? response.content
          : JSON.stringify(response.content);

        const draft: DraftResultType = {
          content,
          format: 'html',
          generatedAt: new Date(),
          modelUsed: 'gpt-4o',
        };

        this.log('Bid proposal generated successfully');

        return {
          success: true,
          data: {
            draft,
            logs: ['Bid proposal generated successfully'],
          },
        };
      } catch (error) {
        this.error('Failed to generate bid proposal', error);
        return {
          success: false,
          error: `Failed to generate bid proposal: ${(error as Error).message}`,
        };
      }
    }, 'bid generation');
  }
}

export const generationAgent = new GenerationAgent();
