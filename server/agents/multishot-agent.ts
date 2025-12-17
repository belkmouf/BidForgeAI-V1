import { BaseAgent, AgentInput, AgentOutput, AgentContext } from './base-agent';
import type { MultishotFeedbackData } from './master-orchestrator';

export interface MultishotAgentInput extends AgentInput {
  refinementFeedback?: MultishotFeedbackData;
}

export abstract class MultishotAgent extends BaseAgent {
  protected currentIteration: number = 0;
  
  getRefinementPrompt(feedback: MultishotFeedbackData): string {
    const improvements = feedback.improvements?.length 
      ? feedback.improvements.map((imp, i) => `${i + 1}. ${imp}`).join('\n')
      : 'None specified';
      
    const criticalIssues = feedback.criticalIssues?.length
      ? `\nCRITICAL ISSUES TO ADDRESS:\n${feedback.criticalIssues.map((issue, i) => `* ${issue}`).join('\n')}`
      : '';

    return `
REFINEMENT REQUIRED (Iteration ${feedback.iteration}/${feedback.maxIterations})
Previous Score: ${feedback.previousScore || 'N/A'}/100

Orchestrator Feedback:
${feedback.feedback}

Required Improvements:
${improvements}
${criticalIssues}

Please refine your output addressing ALL the issues above. Focus on quality and completeness.
`;
  }

  async execute(
    input: AgentInput,
    context: AgentContext
  ): Promise<AgentOutput> {
    const inputData = input.data as Record<string, unknown>;
    const refinementFeedback = inputData?.refinementFeedback as MultishotFeedbackData | undefined;
    this.currentIteration = refinementFeedback?.iteration || 1;
    
    if (refinementFeedback) {
      this.log(`Executing refinement iteration ${this.currentIteration}`);
      const enhancedInput: AgentInput = {
        ...input,
        data: {
          ...inputData,
          refinementContext: this.getRefinementPrompt(refinementFeedback),
        },
      };
      return super.execute(enhancedInput, context);
    }
    
    return super.execute(input, context);
  }

  protected enhancePromptWithRefinement(basePrompt: string, inputData: unknown): string {
    const data = inputData as { refinementContext?: string };
    if (data?.refinementContext) {
      return `${basePrompt}\n\n${data.refinementContext}`;
    }
    return basePrompt;
  }
}
