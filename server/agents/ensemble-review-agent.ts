import { BaseAgent, AgentInput, AgentOutput, AgentContext } from './base-agent';
import type { CompiledContext } from './context-builder';
import { ChatOpenAI } from '@langchain/openai';
import { ChatAnthropic } from '@langchain/anthropic';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { z } from 'zod';

export interface EnsembleReviewResult {
  passed: boolean;
  overallScore: number;
  threshold: number;
  modelScores: ModelScore[];
  consensus: boolean;
  feedback: string[];
  improvements: string[];
}

export interface ModelScore {
  model: string;
  score: number;
  passed: boolean;
  feedback: string[];
  evaluationTime: number;
}

const ReviewResponseSchema = z.object({
  completeness: z.number().min(0).max(100),
  clarity: z.number().min(0).max(100),
  competitiveness: z.number().min(0).max(100),
  technicalAccuracy: z.number().min(0).max(100),
  professionalism: z.number().min(0).max(100),
  overallScore: z.number().min(0).max(100),
  feedback: z.array(z.string()).default([]),
  improvements: z.array(z.string()).default([]),
});

const PASS_THRESHOLD = 85;

export class EnsembleReviewAgent extends BaseAgent {
  name = 'ensemble-review';
  description = 'Multi-model ensemble review combining Claude Sonnet and Gemini Flash for final quality gate';

  protected async executeWithCompiledContext(
    compiledContext: CompiledContext,
    input: AgentInput,
    context: AgentContext
  ): Promise<AgentOutput> {
    return this.wrapExecution(async () => {
      const inputData = input.data as {
        draft?: { content?: string };
        documents?: Array<{ name: string; content?: string }>;
        analysis?: Record<string, unknown>;
        conflictDetection?: Record<string, unknown>;
        technicalValidation?: Record<string, unknown>;
      };

      const bidContent = inputData.draft?.content;
      if (!bidContent) {
        return {
          success: false,
          error: 'No bid content to review',
          data: { logs: ['Missing bid content for ensemble review'] },
        };
      }

      this.log('Starting ensemble review with Claude Sonnet and Gemini Flash');

      const documentContext = inputData.documents?.map(d => d.name).join(', ') || 'N/A';
      const analysisContext = inputData.analysis ? JSON.stringify(inputData.analysis).slice(0, 2000) : 'N/A';

      const [claudeResult, geminiResult] = await Promise.all([
        this.reviewWithClaude(bidContent, documentContext, analysisContext),
        this.reviewWithGemini(bidContent, documentContext, analysisContext),
      ]);

      const modelScores: ModelScore[] = [claudeResult, geminiResult];

      const validScores = modelScores.filter(m => m.score > 0);
      const overallScore = validScores.length > 0
        ? validScores.reduce((sum, m) => sum + m.score, 0) / validScores.length
        : 0;

      const consensus = Math.abs(claudeResult.score - geminiResult.score) <= 15;

      const allFeedback = [...new Set([
        ...claudeResult.feedback,
        ...geminiResult.feedback,
      ])];

      const allImprovements = [...new Set([
        ...modelScores.flatMap(m => m.feedback.filter(f => 
          f.toLowerCase().includes('improve') || 
          f.toLowerCase().includes('add') ||
          f.toLowerCase().includes('consider')
        )),
      ])];

      const passed = overallScore >= PASS_THRESHOLD;

      const result: EnsembleReviewResult = {
        passed,
        overallScore: Math.round(overallScore),
        threshold: PASS_THRESHOLD,
        modelScores,
        consensus,
        feedback: allFeedback,
        improvements: allImprovements,
      };

      this.log(`Ensemble review complete: Score ${overallScore.toFixed(1)}%, Passed: ${passed}`);
      this.log(`Consensus: ${consensus}, Claude: ${claudeResult.score}, Gemini: ${geminiResult.score}`);

      return {
        success: true,
        data: {
          ensembleReview: result,
          passed,
          score: Math.round(overallScore),
          logs: [
            `Ensemble score: ${Math.round(overallScore)}% (threshold: ${PASS_THRESHOLD}%)`,
            `Claude: ${claudeResult.score}%, Gemini: ${geminiResult.score}%`,
            `Consensus: ${consensus ? 'Yes' : 'No'}`,
            `Result: ${passed ? 'PASSED' : 'NEEDS IMPROVEMENT'}`,
          ],
        },
      };
    }, 'ensemble review');
  }

  private async reviewWithClaude(
    bidContent: string,
    documentContext: string,
    analysisContext: string
  ): Promise<ModelScore> {
    const startTime = Date.now();
    
    try {
      const model = new ChatAnthropic({
        model: 'claude-sonnet-4-20250514',
        temperature: 0.1,
      });

      const response = await model.invoke([
        { role: 'system', content: this.getReviewPrompt() },
        { role: 'user', content: this.formatReviewRequest(bidContent, documentContext, analysisContext) },
      ]);

      const content = typeof response.content === 'string'
        ? response.content
        : JSON.stringify(response.content);

      const result = this.parseReviewResponse(content);

      return {
        model: 'claude-sonnet',
        score: result.overallScore,
        passed: result.overallScore >= PASS_THRESHOLD,
        feedback: result.feedback,
        evaluationTime: Date.now() - startTime,
      };
    } catch (error) {
      this.log(`Claude review failed: ${error}`);
      return {
        model: 'claude-sonnet',
        score: 0,
        passed: false,
        feedback: ['Claude review failed - skipping'],
        evaluationTime: Date.now() - startTime,
      };
    }
  }

  private async reviewWithGemini(
    bidContent: string,
    documentContext: string,
    analysisContext: string
  ): Promise<ModelScore> {
    const startTime = Date.now();
    
    try {
      const model = new ChatGoogleGenerativeAI({
        model: 'gemini-2.5-flash-preview-05-20',
        temperature: 0.1,
        apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.AI_INTEGRATIONS_GEMINI_API_KEY,
      });

      const response = await model.invoke([
        { role: 'system', content: this.getReviewPrompt() },
        { role: 'user', content: this.formatReviewRequest(bidContent, documentContext, analysisContext) },
      ]);

      const content = typeof response.content === 'string'
        ? response.content
        : JSON.stringify(response.content);

      const result = this.parseReviewResponse(content);

      return {
        model: 'gemini-flash',
        score: result.overallScore,
        passed: result.overallScore >= PASS_THRESHOLD,
        feedback: result.feedback,
        evaluationTime: Date.now() - startTime,
      };
    } catch (error) {
      this.log(`Gemini review failed: ${error}`);
      return {
        model: 'gemini-flash',
        score: 0,
        passed: false,
        feedback: ['Gemini review failed - skipping'],
        evaluationTime: Date.now() - startTime,
      };
    }
  }

  private getReviewPrompt(): string {
    return `You are a construction bid quality reviewer. Evaluate the bid proposal against these criteria:

1. **Completeness** (25%): Does it address all RFP requirements?
2. **Clarity** (20%): Is the proposal well-organized and easy to understand?
3. **Competitiveness** (20%): Does it present a compelling value proposition?
4. **Technical Accuracy** (20%): Are technical details correct and relevant?
5. **Professionalism** (15%): Is the tone appropriate for enterprise clients?

Scoring:
- 90-100: Excellent - ready for submission
- 80-89: Good - minor improvements needed
- 70-79: Acceptable - some issues to address
- Below 70: Needs significant work

Respond with a JSON object containing:
{
  "completeness": <0-100>,
  "clarity": <0-100>,
  "competitiveness": <0-100>,
  "technicalAccuracy": <0-100>,
  "professionalism": <0-100>,
  "overallScore": <0-100>,
  "feedback": ["specific feedback items"],
  "improvements": ["actionable improvement suggestions"]
}`;
  }

  private formatReviewRequest(
    bidContent: string,
    documentContext: string,
    analysisContext: string
  ): string {
    return `Review this construction bid proposal:

## Source Documents: ${documentContext}

## Analysis Summary:
${analysisContext}

## Bid Proposal:
${bidContent.slice(0, 30000)}

Evaluate against all criteria and provide your assessment in JSON format.`;
  }

  private parseReviewResponse(content: string): z.infer<typeof ReviewResponseSchema> {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return ReviewResponseSchema.parse(JSON.parse(jsonMatch[0]));
      }
    } catch {
      this.log('Failed to parse review response, using defaults');
    }

    return {
      completeness: 70,
      clarity: 70,
      competitiveness: 70,
      technicalAccuracy: 70,
      professionalism: 70,
      overallScore: 70,
      feedback: ['Unable to parse detailed feedback'],
      improvements: [],
    };
  }
}

export const ensembleReviewAgent = new EnsembleReviewAgent();
