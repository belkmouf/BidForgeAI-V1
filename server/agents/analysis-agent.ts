import { BaseAgent, AgentInput, AgentOutput, AgentContext } from './base-agent';
import { AnalysisResultType, DocumentInfoType } from './state';
import { ChatOpenAI } from '@langchain/openai';
import { ChatAnthropic } from '@langchain/anthropic';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { z } from 'zod';

const AnalysisResponseSchema = z.object({
  qualityScore: z.number(),
  clarityScore: z.number(),
  doabilityScore: z.number(),
  vendorRiskScore: z.number(),
  overallRiskLevel: z.enum(['Low', 'Medium', 'High', 'Critical']),
  keyFindings: z.array(z.string()),
  redFlags: z.array(z.string()),
  opportunities: z.array(z.string()),
  recommendations: z.array(z.object({
    action: z.string(),
    priority: z.enum(['high', 'medium', 'low']),
    timeEstimate: z.string().optional(),
  })),
});

export class AnalysisAgent extends BaseAgent {
  name = 'analysis';
  description = 'Analyzes RFQ documents to assess quality, risk, and feasibility';

  private getModel(modelName: string = 'openai') {
    switch (modelName) {
      case 'anthropic':
        return new ChatAnthropic({
          model: 'claude-sonnet-4-20250514',
          temperature: 0.1,
        });
      case 'gemini':
        return new ChatGoogleGenerativeAI({
          model: 'gemini-2.5-flash-preview-04-17',
          temperature: 0.1,
        });
      default:
        return new ChatOpenAI({
          model: 'gpt-4o',
          temperature: 0.1,
        });
    }
  }

  async execute(input: AgentInput, context: AgentContext): Promise<AgentOutput> {
    return this.wrapExecution(async () => {
      const state = input.data as { documents?: DocumentInfoType[] };
      const docs = state.documents || [];

      if (docs.length === 0) {
        return {
          success: false,
          error: 'No documents available for analysis',
        };
      }

      this.log(`Analyzing ${docs.length} documents`);

      const documentContent = docs
        .filter(d => d.content)
        .map(d => `--- Document: ${d.name} ---\n${d.content}`)
        .join('\n\n');

      if (!documentContent) {
        return {
          success: false,
          error: 'No document content available for analysis',
        };
      }

      const model = this.getModel('openai');

      const systemPrompt = `You are an expert construction bid analyst. Analyze the provided RFQ (Request for Quotation) documents and provide a comprehensive assessment.

Your analysis should evaluate:
1. Quality Score (0-100): How well-organized and professional is the RFQ?
2. Clarity Score (0-100): How clear are the requirements and expectations?
3. Doability Score (0-100): How feasible is it to complete this project successfully?
4. Vendor Risk Score (0-100): What is the risk level of working with this client? (higher = more risky)

Also identify:
- Key findings about the project
- Red flags that could indicate problems
- Opportunities for competitive advantage
- Specific recommendations with priority levels

Respond in JSON format matching the required schema.`;

      const userPrompt = `Analyze these RFQ documents:\n\n${documentContent.slice(0, 50000)}`;

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
          throw new Error('No valid JSON found in response');
        }

        const parsed = JSON.parse(jsonMatch[0]);
        const analysis = AnalysisResponseSchema.parse(parsed);

        this.log(`Analysis complete. Risk level: ${analysis.overallRiskLevel}, Doability: ${analysis.doabilityScore}`);

        return {
          success: true,
          data: {
            analysis,
            logs: [`Analysis completed with ${analysis.overallRiskLevel} risk level`],
          },
        };
      } catch (error) {
        this.error('Failed to analyze documents', error);
        
        const fallbackAnalysis: AnalysisResultType = {
          qualityScore: 50,
          clarityScore: 50,
          doabilityScore: 50,
          vendorRiskScore: 50,
          overallRiskLevel: 'Medium',
          keyFindings: ['Analysis could not be completed automatically'],
          redFlags: [],
          opportunities: [],
          recommendations: [
            {
              action: 'Review documents manually',
              priority: 'high',
              timeEstimate: '1-2 hours',
            },
          ],
        };

        return {
          success: true,
          data: {
            analysis: fallbackAnalysis,
            logs: ['Fallback analysis used due to AI processing error'],
          },
        };
      }
    }, 'document analysis');
  }
}

export const analysisAgent = new AnalysisAgent();
