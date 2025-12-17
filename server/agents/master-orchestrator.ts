import Anthropic from '@anthropic-ai/sdk';
import { EventEmitter } from 'events';
import { db } from '../db';
import { agentExecutions, agentStates } from '@shared/schema';
import { eq } from 'drizzle-orm';
import type { AgentOutput, AgentContext } from './base-agent';

const anthropicApiKey = process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY;
const integrationBaseUrl = process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL;

if (!anthropicApiKey) {
  throw new Error('ANTHROPIC_API_KEY or AI_INTEGRATIONS_ANTHROPIC_API_KEY is not set');
}

const anthropic = new Anthropic({
  apiKey: anthropicApiKey,
  baseURL: integrationBaseUrl || undefined,
});

export interface AgentMessage {
  role: 'orchestrator' | 'agent' | 'system';
  agentName?: string;
  content: string;
  timestamp: Date;
  iteration?: number;
  evaluation?: OrchestratorEvaluation;
}

export interface OrchestratorEvaluation {
  accepted: boolean;
  score: number;
  reasoning: string;
  improvements: string[];
  criticalIssues: string[];
}

export interface MultishotFeedbackData {
  iteration: number;
  maxIterations: number;
  feedback: string;
  improvements: string[];
  criticalIssues: string[];
  previousScore?: number;
}

export interface MultiShotState {
  projectId: string;
  userId: number;
  currentAgent: string;
  iteration: number;
  maxIterations: number;
  messages: AgentMessage[];
  agentOutputs: Record<string, AgentOutput[]>;
  evaluations: Record<string, OrchestratorEvaluation[]>;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  startedAt: Date;
  updatedAt: Date;
}

export interface ProgressEvent {
  type: 'agent_start' | 'agent_output' | 'evaluation' | 'refinement_request' | 'agent_complete' | 'workflow_complete' | 'error';
  agentName: string;
  iteration: number;
  message: string;
  data?: unknown;
  timestamp: Date;
}

export class MasterOrchestrator extends EventEmitter {
  private maxIterationsPerAgent: number = 3;
  private acceptanceThreshold: number = 75;
  
  constructor(options?: { maxIterationsPerAgent?: number; acceptanceThreshold?: number }) {
    super();
    if (options?.maxIterationsPerAgent) this.maxIterationsPerAgent = options.maxIterationsPerAgent;
    if (options?.acceptanceThreshold) this.acceptanceThreshold = options.acceptanceThreshold;
  }

  emitProgress(event: ProgressEvent & { projectId?: string }): void {
    this.emit('progress', event);
  }
  
  private emitProgressWithProject(projectId: string, event: Omit<ProgressEvent, 'timestamp'>): void {
    this.emit('progress', {
      ...event,
      projectId,
      timestamp: new Date(),
    });
  }

  async evaluateAgentOutput(
    agentName: string,
    output: AgentOutput,
    context: {
      projectId: string;
      iteration: number;
      previousOutputs?: AgentOutput[];
      previousEvaluations?: OrchestratorEvaluation[];
    }
  ): Promise<OrchestratorEvaluation> {
    const previousContext = context.previousEvaluations?.length
      ? `\nPrevious Iterations:\n${context.previousEvaluations.map((e, i) => 
          `Iteration ${i + 1}: Score ${e.score}/100 - ${e.reasoning}\nImprovements needed: ${e.improvements.join(', ')}`
        ).join('\n\n')}`
      : '';

    const systemPrompt = `You are the Master Orchestrator overseeing a construction bid generation workflow. Your role is to evaluate agent outputs and decide if they meet quality standards.

Evaluation Criteria by Agent Type:
- intake: Document extraction completeness, data accuracy, no missing critical fields
- sketch: Dimensions accuracy, materials identification, specifications extraction quality
- analysis: Risk assessment accuracy, clarity of findings, actionable recommendations
- decision: Strategic rationale, risk mitigation completeness, go/no-go justification
- generation: Bid completeness, professional tone, requirements coverage, no placeholders
- review: Thorough quality assessment, specific actionable feedback

Scoring Guidelines:
- 90-100: Excellent, production-ready output
- 75-89: Good, acceptable with minor improvements
- 60-74: Needs refinement, key issues present
- Below 60: Major issues, significant rework needed

Your evaluation threshold is ${this.acceptanceThreshold}/100. Accept outputs scoring at or above this threshold.`;

    const userPrompt = `Evaluate this ${agentName} agent output (Iteration ${context.iteration}/${this.maxIterationsPerAgent}):

Agent Output:
${JSON.stringify(output, null, 2)}
${previousContext}

Provide your evaluation in JSON format:
{
  "accepted": boolean,
  "score": number (0-100),
  "reasoning": "explanation of evaluation",
  "improvements": ["list of specific improvements if not accepted"],
  "criticalIssues": ["any critical issues that must be fixed"]
}`;

    try {
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-5',
        max_tokens: 2048,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      });

      const textBlock = response.content.find(block => block.type === 'text');
      const content = textBlock?.text || '{}';
      
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No valid JSON in orchestrator response');
      }

      const evaluation = JSON.parse(jsonMatch[0]) as OrchestratorEvaluation;
      
      return evaluation;
    } catch (error) {
      console.error('[MasterOrchestrator] Evaluation failed:', error);
      return {
        accepted: true,
        score: 70,
        reasoning: 'Evaluation failed, accepting output with default score',
        improvements: [],
        criticalIssues: [],
      };
    }
  }

  async generateRefinementFeedback(
    agentName: string,
    output: AgentOutput,
    evaluation: OrchestratorEvaluation
  ): Promise<string> {
    const systemPrompt = `You are the Master Orchestrator. Generate specific, actionable feedback for the ${agentName} agent to improve its output based on the evaluation.

Be direct and specific. Focus on the most impactful improvements.`;

    const userPrompt = `Generate refinement feedback for ${agentName} agent.

Current Output:
${JSON.stringify(output.data, null, 2)}

Evaluation:
- Score: ${evaluation.score}/100
- Reasoning: ${evaluation.reasoning}
- Needed Improvements: ${evaluation.improvements.join('; ')}
- Critical Issues: ${evaluation.criticalIssues.join('; ')}

Provide clear, specific feedback that will help the agent improve its output. Be constructive and actionable.`;

    try {
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-5',
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      });

      const textBlock = response.content.find(block => block.type === 'text');
      return textBlock?.text || 'Please review and improve the output quality.';
    } catch (error) {
      console.error('[MasterOrchestrator] Feedback generation failed:', error);
      return `Please address: ${evaluation.improvements.join('. ')}`;
    }
  }

  async orchestrateAgent<T>(
    agentName: string,
    executeAgent: (feedback?: MultishotFeedbackData) => Promise<AgentOutput>,
    context: AgentContext
  ): Promise<{ output: AgentOutput; iterations: number; messages: AgentMessage[] }> {
    const messages: AgentMessage[] = [];
    const outputs: AgentOutput[] = [];
    const evaluations: OrchestratorEvaluation[] = [];
    
    let iteration = 0;
    let currentOutput: AgentOutput | null = null;
    let accepted = false;

    while (iteration < this.maxIterationsPerAgent && !accepted) {
      iteration++;
      
      this.emitProgressWithProject(context.projectId, {
        type: 'agent_start',
        agentName,
        iteration,
        message: `Starting ${agentName} agent (iteration ${iteration}/${this.maxIterationsPerAgent})`,
      });

      messages.push({
        role: 'orchestrator',
        content: iteration === 1 
          ? `Initiating ${agentName} agent for project ${context.projectId}`
          : `Requesting refinement from ${agentName} agent (iteration ${iteration})`,
        timestamp: new Date(),
        iteration,
      });

      let feedbackData: MultishotFeedbackData | undefined;
      if (evaluations.length > 0) {
        const lastEval = evaluations[evaluations.length - 1];
        const refinementText = await this.generateRefinementFeedback(agentName, outputs[outputs.length - 1], lastEval);
        feedbackData = {
          iteration,
          maxIterations: this.maxIterationsPerAgent,
          feedback: refinementText,
          improvements: lastEval.improvements,
          criticalIssues: lastEval.criticalIssues,
          previousScore: lastEval.score,
        };
      }

      try {
        currentOutput = await executeAgent(feedbackData);
        outputs.push(currentOutput);

        messages.push({
          role: 'agent',
          agentName,
          content: currentOutput.success 
            ? `Completed execution. ${currentOutput.summary?.summary || 'Output generated.'}`
            : `Execution failed: ${currentOutput.error}`,
          timestamp: new Date(),
          iteration,
        });

        this.emitProgressWithProject(context.projectId, {
          type: 'agent_output',
          agentName,
          iteration,
          message: currentOutput.success 
            ? `${agentName} produced output`
            : `${agentName} failed: ${currentOutput.error}`,
          data: { success: currentOutput.success },
        });

        if (!currentOutput.success) {
          break;
        }

        const evaluation = await this.evaluateAgentOutput(agentName, currentOutput, {
          projectId: context.projectId,
          iteration,
          previousOutputs: outputs.slice(0, -1),
          previousEvaluations: evaluations,
        });

        evaluations.push(evaluation);

        const isAccepted = evaluation.score >= this.acceptanceThreshold && evaluation.accepted;

        messages.push({
          role: 'orchestrator',
          content: isAccepted 
            ? `Output accepted (score: ${evaluation.score}/100). ${evaluation.reasoning}`
            : `Output needs refinement (score: ${evaluation.score}/100). ${evaluation.reasoning}`,
          timestamp: new Date(),
          iteration,
          evaluation,
        });

        this.emitProgressWithProject(context.projectId, {
          type: 'evaluation',
          agentName,
          iteration,
          message: isAccepted 
            ? `Output accepted with score ${evaluation.score}/100`
            : `Score ${evaluation.score}/100 - refinement needed`,
          data: evaluation,
        });

        accepted = isAccepted;

        if (!accepted && iteration < this.maxIterationsPerAgent) {
          this.emitProgressWithProject(context.projectId, {
            type: 'refinement_request',
            agentName,
            iteration,
            message: `Requesting ${agentName} to refine output`,
            data: { improvements: evaluation.improvements },
          });
        }

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        
        messages.push({
          role: 'system',
          content: `Error in ${agentName}: ${errorMessage}`,
          timestamp: new Date(),
          iteration,
        });

        this.emitProgressWithProject(context.projectId, {
          type: 'error',
          agentName,
          iteration,
          message: `Error: ${errorMessage}`,
        });

        currentOutput = { success: false, error: errorMessage };
        break;
      }
    }

    this.emitProgressWithProject(context.projectId, {
      type: 'agent_complete',
      agentName,
      iteration,
      message: accepted 
        ? `${agentName} completed successfully after ${iteration} iteration(s)`
        : `${agentName} completed after ${iteration} iteration(s) (max iterations reached or error)`,
      data: { accepted, iterations: iteration },
    });

    return {
      output: currentOutput || { success: false, error: 'No output produced' },
      iterations: iteration,
      messages,
    };
  }

  async logExecution(
    projectId: string,
    agentName: string,
    iteration: number,
    status: string,
    input?: unknown,
    output?: unknown,
    error?: string
  ): Promise<void> {
    try {
      await db.insert(agentExecutions).values({
        projectId,
        agentName: `${agentName}_iter_${iteration}`,
        status,
        input: input as Record<string, unknown>,
        output: output as Record<string, unknown>,
        error,
        startedAt: new Date(),
        completedAt: status === 'completed' || status === 'failed' ? new Date() : undefined,
      });
    } catch (err) {
      console.error('[MasterOrchestrator] Failed to log execution:', err);
    }
  }

  async updateWorkflowState(
    projectId: string,
    state: Partial<MultiShotState>
  ): Promise<void> {
    try {
      await db
        .update(agentStates)
        .set({
          currentAgent: state.currentAgent,
          status: state.status,
          state: state as Record<string, unknown>,
          updatedAt: new Date(),
        })
        .where(eq(agentStates.projectId, projectId));
    } catch (err) {
      console.error('[MasterOrchestrator] Failed to update workflow state:', err);
    }
  }
}

export const masterOrchestrator = new MasterOrchestrator({
  maxIterationsPerAgent: 3,
  acceptanceThreshold: 75,
});
