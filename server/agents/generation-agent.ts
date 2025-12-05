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

  async execute(input: AgentInput, context: AgentContext): Promise<AgentOutput> {
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

      this.log('Generating bid proposal');

      const documentContent = docs
        .filter(d => d.content)
        .map(d => `--- ${d.name} ---\n${d.content}`)
        .join('\n\n');

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

      const systemPrompt = `You are an expert construction bid writer. Generate a professional, compelling bid proposal based on the provided RFQ documents and analysis.

Your proposal should:
1. Be formatted in clean, professional HTML
2. Include all required sections (Executive Summary, Technical Approach, Team, Timeline, Pricing Framework)
3. Address the specific requirements in the RFQ
4. Highlight the bidder's competitive advantages
5. Be persuasive while remaining factual
6. Use proper construction industry terminology

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
