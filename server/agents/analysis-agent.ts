import { BaseAgent, AgentInput, AgentOutput, AgentContext } from './base-agent';
import { AnalysisResultType, DocumentInfoType } from './state';
import type { CompiledContext } from './context-builder';
import { ChatOpenAI } from '@langchain/openai';
import { ChatAnthropic } from '@langchain/anthropic';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { z } from 'zod';

const AnalysisResponseSchema = z.object({
  qualityScore: z.number().default(50),
  clarityScore: z.number().default(50),
  doabilityScore: z.number().default(50),
  vendorRiskScore: z.number().default(50),
  overallRiskLevel: z.enum(['Low', 'Medium', 'High', 'Critical']).default('Medium'),
  keyFindings: z.array(z.string()).default([]),
  redFlags: z.array(z.string()).default([]),
  opportunities: z.array(z.string()).default([]),
  recommendations: z.array(z.object({
    action: z.string().default('Review this item'),
    priority: z.enum(['high', 'medium', 'low']).default('medium'),
    timeEstimate: z.string().optional(),
  })).default([]),
});

export class AnalysisAgent extends BaseAgent {
  name = 'analysis';
  description = 'Analyzes RFQ documents to assess quality, risk, and feasibility';
  
  constructor() {
    super();
  }

  private getModel(modelName: string = 'deepseek') {
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
      case 'grok':
        if (!process.env.XAI_API_KEY) {
          throw new Error('XAI_API_KEY environment variable is required for Grok');
        }
        return new ChatOpenAI({
          model: 'grok-4-fast',
          temperature: 0.1,
          baseURL: 'https://api.x.ai/v1',
          apiKey: process.env.XAI_API_KEY,
        });
      case 'deepseek':
        if (!process.env.DEEPSEEK_API_KEY) {
          throw new Error('DEEPSEEK_API_KEY environment variable is required for DeepSeek');
        }
        return new ChatOpenAI({
          model: 'deepseek-chat',
          temperature: 0.1,
          baseURL: 'https://api.deepseek.com',
          apiKey: process.env.DEEPSEEK_API_KEY,
        });
      default:
        return new ChatOpenAI({
          model: 'gpt-4o',
          temperature: 0.1,
        });
    }
  }

  protected async executeWithCompiledContext(
    compiledContext: CompiledContext,
    input: AgentInput,
    context: AgentContext
  ): Promise<AgentOutput> {
    return this.wrapExecution(async () => {
      const state = input.data as { documents?: DocumentInfoType[] };
      const docs = state.documents || [];

      if (docs.length === 0) {
        return {
          success: false,
          error: 'No documents available for analysis',
        };
      }

      this.log(`Analyzing ${docs.length} documents using compiled context`);

      // Store document content as artifacts if large
      const documentArtifacts: string[] = [];
      for (const doc of docs) {
        if (doc.content && doc.content.length > 2000) {
          const artifactId = await this.storeIntermediateArtifact(
            context.projectId,
            { name: doc.name, content: doc.content },
            'document_content'
          );
          documentArtifacts.push(artifactId);
        }
      }

      // Update working context with document processing info
      await this.updateWorkingContext(context.projectId, {
        documentCount: docs.length,
        documentArtifacts,
        processingStage: 'analysis_started',
      });

      // Get smaller document summaries instead of full content
      const documentSummaries = docs
        .filter(d => d.content)
        .map(d => {
          const content = d.content!;
          const summary = content.length > 1000 
            ? `${content.substring(0, 1000)}... [Document continues - ${content.length} total chars]`
            : content;
          return `--- Document: ${d.name} (${d.type}) ---\n${summary}`;
        })
        .join('\n\n');

      if (!documentSummaries) {
        return {
          success: false,
          error: 'No document content available for analysis',
        };
      }

      // Get model from state or default to 'deepseek'
      const selectedModel = (input.data as { model?: string }).model || 'deepseek';
      const model = this.getModel(selectedModel);

      // Use static system prompt from context builder (optimizes KV caching)
      const systemPrompt = compiledContext.staticSystemPrompt;
      
      // Enhance user prompt with document summaries
      const enhancedUserPrompt = compiledContext.dynamicUserPrompt.replace(
        '{{artifactReferences}}',
        documentSummaries.substring(0, 30000) // Limit to prevent token overflow
      );

      try {
        const response = await model.invoke([
          { role: 'system', content: systemPrompt },
          { role: 'user', content: enhancedUserPrompt },
        ]);

        const content = typeof response.content === 'string' 
          ? response.content 
          : JSON.stringify(response.content);

        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          throw new Error('No valid JSON found in response');
        }

        const parsed = JSON.parse(jsonMatch[0]);
        
        // Normalize recommendations to ensure action field exists
        if (parsed.recommendations && Array.isArray(parsed.recommendations)) {
          parsed.recommendations = parsed.recommendations.map((rec: Record<string, unknown>) => {
            // Normalize priority to lowercase
            let priority = String(rec.priority || 'medium').toLowerCase();
            if (!['high', 'medium', 'low'].includes(priority)) {
              priority = 'medium';
            }
            return {
              action: rec.action || rec.recommendation || rec.description || 'Review this item',
              priority,
              timeEstimate: rec.timeEstimate || rec.time_estimate,
            };
          });
        }
        
        // Normalize overallRiskLevel casing
        if (parsed.overallRiskLevel && typeof parsed.overallRiskLevel === 'string') {
          const level = parsed.overallRiskLevel.toLowerCase();
          if (level === 'low') parsed.overallRiskLevel = 'Low';
          else if (level === 'medium') parsed.overallRiskLevel = 'Medium';
          else if (level === 'high') parsed.overallRiskLevel = 'High';
          else if (level === 'critical') parsed.overallRiskLevel = 'Critical';
        }
        
        const analysis = AnalysisResponseSchema.parse(parsed);

        this.log(`Analysis complete. Risk level: ${analysis.overallRiskLevel}, Doability: ${analysis.doabilityScore}`);

        // Update working context with analysis results
        await this.updateWorkingContext(context.projectId, {
          analysisComplete: true,
          riskLevel: analysis.overallRiskLevel,
          doabilityScore: analysis.doabilityScore,
          processingStage: 'analysis_completed',
        });

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

        // Update working context with fallback info
        await this.updateWorkingContext(context.projectId, {
          analysisFailed: true,
          fallbackUsed: true,
          processingStage: 'analysis_fallback',
        });

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
