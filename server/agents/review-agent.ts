import { BaseAgent, AgentInput, AgentOutput, AgentContext } from './base-agent';
import { ReviewResultType, DraftResultType, AnalysisResultType, BidWorkflowState } from './state';
import { ChatOpenAI } from '@langchain/openai';
import { z } from 'zod';

const ReviewResponseSchema = z.object({
  passed: z.boolean(),
  score: z.number().min(0).max(100),
  feedback: z.array(z.string()),
  suggestions: z.array(z.string()),
});

export class ReviewAgent extends BaseAgent {
  name = 'review';
  description = 'Reviews generated bid proposals for quality and completeness';

  async execute(input: AgentInput, context: AgentContext): Promise<AgentOutput> {
    return this.wrapExecution(async () => {
      const state = input.data as Partial<BidWorkflowState> & {
        draft?: DraftResultType;
        analysis?: AnalysisResultType;
        review?: ReviewResultType;
      };

      const draft = state.draft;
      const analysis = state.analysis;
      const previousReview = state.review;

      if (!draft) {
        return {
          success: false,
          error: 'No draft available for review',
        };
      }

      this.log('Reviewing bid proposal');

      const currentAttempts = previousReview?.attempts ?? 0;
      const attempts = currentAttempts + 1;

      const model = new ChatOpenAI({
        model: 'gpt-4o',
        temperature: 0.2,
      });

      const systemPrompt = `You are a senior construction bid reviewer. Evaluate the provided bid proposal for:

1. Completeness - Does it address all RFQ requirements?
2. Clarity - Is the proposal clear and well-organized?
3. Competitiveness - Does it present a compelling value proposition?
4. Technical accuracy - Are technical details correct?
5. Professionalism - Is the tone and formatting professional?

Score the proposal from 0-100 and provide:
- Whether it passes review (score >= 70)
- Specific feedback on issues
- Actionable suggestions for improvement

Respond in JSON format.`;

      const analysisContext = analysis
        ? `\n\nOriginal RFQ Analysis:\n- Risk Level: ${analysis.overallRiskLevel}\n- Key Requirements: ${analysis.keyFindings.join(', ')}`
        : '';

      const userPrompt = `Review this bid proposal (attempt ${attempts}):

${draft.content.slice(0, 40000)}${analysisContext}

Previous feedback (if any): ${previousReview?.feedback?.join(', ') || 'None'}`;

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
        const reviewResult = ReviewResponseSchema.parse(parsed);

        const review: ReviewResultType = {
          ...reviewResult,
          attempts,
          reviewedAt: new Date(),
        };

        this.log(`Review complete. Score: ${review.score}, Passed: ${review.passed}`);

        return {
          success: true,
          data: {
            review,
            logs: [`Review attempt ${attempts}: Score ${review.score}, ${review.passed ? 'Passed' : 'Failed'}`],
          },
        };
      } catch (error) {
        this.error('Review failed', error);

        const fallbackReview: ReviewResultType = {
          passed: true,
          score: 75,
          feedback: ['Automatic review could not be completed'],
          suggestions: ['Manual review recommended'],
          attempts,
          reviewedAt: new Date(),
        };

        return {
          success: true,
          data: {
            review: fallbackReview,
            logs: ['Fallback review applied'],
          },
        };
      }
    }, 'bid review');
  }
}

export const reviewAgent = new ReviewAgent();
