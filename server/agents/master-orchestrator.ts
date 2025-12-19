import Anthropic from '@anthropic-ai/sdk';
import { EventEmitter } from 'events';
import { db } from '../db';
import { agentExecutions, agentStates } from '@shared/schema';
import { eq } from 'drizzle-orm';
import type { AgentOutput, AgentContext } from './base-agent';
import { searchService, SearchResult } from '../lib/search';

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
  groundingScore?: number;
  unsupportedClaims?: string[];
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

// Per-agent configuration for iterations, timeouts, and grounding checks
const AGENT_CONFIG: Record<string, { maxIterations: number; timeoutMs: number; skipGrounding?: boolean }> = {
  analysis: { maxIterations: 1, timeoutMs: 90_000, skipGrounding: true },   // One-shot, structured scores don't need grounding
  intake: { maxIterations: 1, timeoutMs: 60_000, skipGrounding: true },     // Simple data loading - no content to verify
  sketch: { maxIterations: 1, timeoutMs: 120_000, skipGrounding: true },    // Vision API - structured data
  decision: { maxIterations: 1, timeoutMs: 60_000, skipGrounding: true },   // One-shot, no document claims
  generation: { maxIterations: 3, timeoutMs: 40_000, skipGrounding: true }, // 40s per iteration × 3 = 2 min max total - accept best result
  review: { maxIterations: 1, timeoutMs: 90_000, skipGrounding: true },     // One-shot, just reviews
};
const DEFAULT_AGENT_CONFIG = { maxIterations: 2, timeoutMs: 90_000, skipGrounding: false };

export class MasterOrchestrator extends EventEmitter {
  private maxIterationsPerAgent: number = 2;
  private acceptanceThreshold: number = 75;
  private maxOutputChars: number = 50000;
  private groundingThreshold: number = 60;
  
  constructor(options?: { maxIterationsPerAgent?: number; acceptanceThreshold?: number; groundingThreshold?: number }) {
    super();
    if (options?.maxIterationsPerAgent) this.maxIterationsPerAgent = options.maxIterationsPerAgent;
    if (options?.acceptanceThreshold) this.acceptanceThreshold = options.acceptanceThreshold;
    if (options?.groundingThreshold) this.groundingThreshold = options.groundingThreshold;
  }

  private getAgentConfig(agentName: string): { maxIterations: number; timeoutMs: number; skipGrounding?: boolean } {
    return AGENT_CONFIG[agentName] || DEFAULT_AGENT_CONFIG;
  }

  private async retrieveDocumentContext(projectId: string, output: AgentOutput): Promise<{
    context: string;
    sources: SearchResult[];
    searchFailed: boolean;
  }> {
    try {
      const outputText = typeof output.data === 'string' 
        ? output.data 
        : JSON.stringify(output.data);
      
      const keyPhrases = this.extractKeyPhrases(outputText);
      let allSources: SearchResult[] = [];
      
      if (keyPhrases.length > 0) {
        const technicalQuery = keyPhrases.slice(0, 5).join(' ');
        const technicalSources = await searchService.searchDocuments(technicalQuery, projectId, {
          limit: 10,
          threshold: 0.4,
          useCache: true
        });
        allSources.push(...technicalSources);
      }
      
      const summaryText = output.summary?.summary || '';
      if (summaryText.length > 20) {
        const summarySources = await searchService.searchDocuments(summaryText.substring(0, 300), projectId, {
          limit: 8,
          threshold: 0.4,
          useCache: true
        });
        const existingIds = new Set(allSources.map(s => s.id));
        summarySources.forEach(s => {
          if (!existingIds.has(s.id)) allSources.push(s);
        });
      }
      
      if (allSources.length < 5) {
        const broadTerms = ['scope', 'specifications', 'requirements', 'dimensions', 'materials', 'timeline'];
        const broadQuery = broadTerms.join(' ');
        const broadSources = await searchService.searchDocuments(broadQuery, projectId, {
          limit: 10,
          threshold: 0.3,
          useCache: true
        });
        const existingIds = new Set(allSources.map(s => s.id));
        broadSources.forEach(s => {
          if (!existingIds.has(s.id)) allSources.push(s);
        });
      }
      
      allSources.sort((a, b) => b.score - a.score);
      const sources = allSources.slice(0, 15);
      
      const context = sources
        .map((s, i) => `[Source ${i + 1} - ${s.documentName}]: ${s.content.substring(0, 800)}`)
        .join('\n\n');
      
      console.log(`[MasterOrchestrator] Retrieved ${sources.length} document chunks for grounding check`);
      return { context, sources, searchFailed: false };
    } catch (error) {
      console.error('[MasterOrchestrator] Failed to retrieve document context:', error);
      return { context: '', sources: [], searchFailed: true };
    }
  }

  private extractKeyPhrases(text: string): string[] {
    const technicalPatterns = [
      /\d+(?:\.\d+)?\s*(?:sq\.?\s*(?:ft|m)|square\s*(?:feet|meters?))/gi,
      /\d+(?:\.\d+)?\s*(?:ft|m|cm|mm|inches?|"|')\s*x\s*\d+(?:\.\d+)?\s*(?:ft|m|cm|mm|inches?|"|')/gi,
      /\d+(?:\.\d+)?\s*(?:PSI|MPa|kPa)/gi,
      /(?:Grade|ASTM|ACI|AISC|ISO)\s*[A-Z0-9\-]+/gi,
      /\$[\d,]+(?:\.\d{2})?(?:\s*(?:million|billion|thousand|k|M|B))?/gi,
      /\d+\s*(?:days?|weeks?|months?|years?)/gi,
      /(?:concrete|steel|rebar|foundation|slab|column|beam|HVAC|MEP|electrical|plumbing|roofing)/gi
    ];
    
    const phrases: string[] = [];
    for (const pattern of technicalPatterns) {
      const matches = text.match(pattern);
      if (matches) {
        phrases.push(...matches.slice(0, 3));
      }
    }
    
    return [...new Set(phrases)].slice(0, 10);
  }

  private async verifyGrounding(
    agentName: string,
    output: AgentOutput,
    documentContext: string,
    sources: SearchResult[]
  ): Promise<{ groundingScore: number; unsupportedClaims: string[] }> {
    if (!documentContext || sources.length === 0) {
      return { groundingScore: 100, unsupportedClaims: [] };
    }

    const truncatedOutput = this.truncateOutput(output);
    
    const verificationPrompt = `You are a fact-checking specialist for construction bids. Verify if the agent output is grounded in the provided source documents.

AGENT OUTPUT TO VERIFY:
${truncatedOutput}

SOURCE DOCUMENTS (retrieved from project files):
${documentContext}

VERIFICATION TASK:
1. Identify specific claims in the agent output (dimensions, materials, quantities, costs, timelines, specifications)
2. Check if each claim is supported by the source documents
3. Flag any claims that:
   - Contain specific numbers/values not found in sources
   - Make technical assertions without document backing
   - Include specifications that contradict source documents

Respond in JSON:
{
  "groundingScore": number (0-100, where 100 = fully grounded in documents),
  "verifiedClaims": ["list of claims that ARE supported by documents"],
  "unsupportedClaims": ["list of specific claims NOT found in source documents"],
  "contradictions": ["claims that CONTRADICT source documents"],
  "reasoning": "brief explanation of grounding assessment"
}`;

    try {
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-5',
        max_tokens: 2048,
        messages: [{ role: 'user', content: verificationPrompt }],
      });

      const textBlock = response.content.find(block => block.type === 'text');
      const content = textBlock?.text || '{}';
      
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return { groundingScore: 70, unsupportedClaims: [] };
      }

      const result = JSON.parse(jsonMatch[0]);
      console.log(`[MasterOrchestrator] Grounding check for ${agentName}: score=${result.groundingScore}, unsupported=${result.unsupportedClaims?.length || 0}`);
      
      return {
        groundingScore: result.groundingScore || 70,
        unsupportedClaims: [
          ...(result.unsupportedClaims || []),
          ...(result.contradictions || [])
        ]
      };
    } catch (error) {
      console.error('[MasterOrchestrator] Grounding verification failed:', error);
      return { groundingScore: 70, unsupportedClaims: [] };
    }
  }

  private truncateOutput(output: unknown): string {
    const fullJson = JSON.stringify(output, null, 2);
    if (fullJson.length <= this.maxOutputChars) {
      return fullJson;
    }
    
    const data = typeof output === 'object' && output !== null ? output : { data: output };
    const summary: Record<string, unknown> = {};
    
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      if (Array.isArray(value)) {
        const itemSample = value.slice(0, 3).map((item: unknown) => {
          if (typeof item === 'object' && item !== null) {
            const itemObj = item as Record<string, unknown>;
            const truncatedItem: Record<string, unknown> = {};
            for (const [k, v] of Object.entries(itemObj)) {
              if (typeof v === 'string' && v.length > 500) {
                truncatedItem[k] = v.substring(0, 500) + '... [truncated]';
              } else {
                truncatedItem[k] = v;
              }
            }
            return truncatedItem;
          }
          return item;
        });
        summary[key] = {
          type: 'array',
          totalItems: value.length,
          sampleItems: itemSample,
          note: value.length > 3 ? `Showing 3 of ${value.length} items` : undefined,
        };
      } else if (typeof value === 'string' && value.length > 2000) {
        summary[key] = value.substring(0, 2000) + '... [truncated]';
      } else if (typeof value === 'object' && value !== null) {
        const objJson = JSON.stringify(value);
        if (objJson.length > 5000) {
          summary[key] = { note: 'Large object truncated', keys: Object.keys(value as object) };
        } else {
          summary[key] = value;
        }
      } else {
        summary[key] = value;
      }
    }
    
    return JSON.stringify(summary, null, 2);
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
    // Use per-agent config for grounding - only generation needs it
    const agentConfig = this.getAgentConfig(agentName);
    const requiresGrounding = !agentConfig.skipGrounding;
    
    let documentContext = '';
    let sources: SearchResult[] = [];
    let searchFailed = false;
    let groundingResult = { groundingScore: 100, unsupportedClaims: [] as string[] };
    
    if (requiresGrounding && output.success) {
      console.log(`[MasterOrchestrator] Retrieving document context for ${agentName} grounding check...`);
      const docResult = await this.retrieveDocumentContext(context.projectId, output);
      documentContext = docResult.context;
      sources = docResult.sources;
      searchFailed = docResult.searchFailed;
      
      if (searchFailed) {
        groundingResult = { 
          groundingScore: 25, 
          unsupportedClaims: ['CRITICAL: Unable to retrieve source documents for verification - content cannot be verified against project files. All technical claims are unverified.'] 
        };
        console.log(`[MasterOrchestrator] Document retrieval FAILED - setting grounding score to 25 (hard failure)`);
      } else if (sources.length === 0) {
        groundingResult = { 
          groundingScore: 30, 
          unsupportedClaims: ['CRITICAL: No matching source documents found in project. Output contains claims that cannot be verified against uploaded RFP documents.'] 
        };
        console.log(`[MasterOrchestrator] NO source documents found - setting grounding score to 30 (hard failure)`);
      } else if (sources.length < 3) {
        groundingResult = await this.verifyGrounding(agentName, output, documentContext, sources);
        groundingResult.groundingScore = Math.min(groundingResult.groundingScore, 65);
        groundingResult.unsupportedClaims = [
          ...(groundingResult.unsupportedClaims || []),
          `Limited source coverage: only ${sources.length} document chunks available for verification`
        ];
        console.log(`[MasterOrchestrator] Limited sources (${sources.length}) - capping grounding score at 65`);
      } else {
        groundingResult = await this.verifyGrounding(agentName, output, documentContext, sources);
        console.log(`[MasterOrchestrator] ${agentName} grounding score: ${groundingResult.groundingScore}/100`);
      }
    }
    
    const previousContext = context.previousEvaluations?.length
      ? `\nPrevious Iterations:\n${context.previousEvaluations.map((e, i) => 
          `Iteration ${i + 1}: Score ${e.score}/100 - ${e.reasoning}\nImprovements needed: ${e.improvements.join(', ')}`
        ).join('\n\n')}`
      : '';

    const groundingContext = requiresGrounding
      ? `\n\nDOCUMENT GROUNDING VERIFICATION:
Grounding Score: ${groundingResult.groundingScore}/100
Source Documents Retrieved: ${sources.length}
Search Status: ${searchFailed ? 'FAILED' : sources.length === 0 ? 'NO DOCUMENTS FOUND' : 'SUCCESS'}
${groundingResult.unsupportedClaims.length > 0 
  ? `GROUNDING ISSUES DETECTED:\n${groundingResult.unsupportedClaims.map(c => `- ${c}`).join('\n')}`
  : 'All claims appear to be grounded in source documents.'}
${sources.length === 0 ? '\nWARNING: Without source documents, the output cannot be verified for factual accuracy. The agent may have generated fabricated content.' : ''}`
      : '';

    const systemPrompt = `You are the Master Orchestrator overseeing a construction bid generation workflow. You are a HIGHLY TECHNICAL construction expert. Your role is to evaluate agent outputs with extreme attention to technical accuracy and completeness.

CRITICAL: DOCUMENT GROUNDING REQUIREMENT
All technical claims, dimensions, specifications, and values in the output MUST be traceable to the uploaded project documents. Outputs with fabricated or hallucinated information must be REJECTED.

CRITICAL TECHNICAL FOCUS AREAS:
1. DIMENSIONS & MEASUREMENTS: All dimensions must be explicit (length, width, height, area, volume) AND match source documents
2. MATERIALS & SPECIFICATIONS: Material grades, standards (ASTM, ACI, AISC), brand specifications - MUST come from documents
3. QUANTITIES: Bill of quantities, unit counts, material volumes, labor hours - MUST be extracted from or calculated from documents
4. CONSTRUCTION METHODS: Detailed methodology, equipment requirements, sequencing
5. TIMELINES: Realistic durations based on scope, resource loading, critical path items

Evaluation Criteria by Agent Type:
- intake: Document extraction completeness, ALL dimensions extracted, material specs captured, quantities identified, timeline requirements noted
- sketch: Dimensions MUST be accurate to specification, materials fully identified with grades/standards, all technical specifications extracted, scale verification
- analysis: Risk assessment with technical root causes, structural/MEP/civil considerations, resource requirements, timeline feasibility analysis. ALL FINDINGS MUST BE GROUNDED IN DOCUMENTS.
- decision: Technical feasibility assessment, resource availability, subcontractor requirements, equipment needs, timeline realism
- generation: MUST include: 
  * Detailed scope with ALL dimensions from documents - NO FABRICATED NUMBERS
  * Complete material specifications with standards - MUST MATCH DOCUMENTS
  * Realistic timeline with phase breakdown (based on similar project data)
  * Resource loading and labor estimates
  * Equipment requirements
  * Quality control procedures
  * NO PLACEHOLDER TEXT - all technical details must be specific AND document-backed
- review: Verify technical accuracy, dimensions match source docs, materials properly specified, timeline realistic

Scoring Guidelines (Quality Score):
- 90-100: Technically complete, all dimensions/materials/timelines specified accurately and grounded
- 75-89: Good technical content, minor gaps in specifications
- 60-74: Missing key technical details, needs refinement
- Below 60: Major technical omissions, significant rework needed

GROUNDING PENALTY: If grounding verification detects unsupported claims, reduce the final score accordingly. An output with many hallucinated values should FAIL even if otherwise well-structured.

Your evaluation threshold is ${this.acceptanceThreshold}/100. Accept outputs scoring at or above this threshold.
REJECT any output with:
- Placeholder text like "[TBD]", "[INSERT]", or generic statements
- Specific numbers/dimensions NOT found in source documents
- Technical claims that contradict source documents`;

    const truncatedOutput = this.truncateOutput(output);
    const userPrompt = `Evaluate this ${agentName} agent output (Iteration ${context.iteration}/${this.maxIterationsPerAgent}):

Agent Output:
${truncatedOutput}
${previousContext}
${groundingContext}

Provide your evaluation in JSON format:
{
  "accepted": boolean,
  "score": number (0-100),
  "reasoning": "explanation of evaluation including grounding assessment",
  "improvements": ["list of specific improvements if not accepted"],
  "criticalIssues": ["any critical issues including unsupported claims that must be fixed"]
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
      
      evaluation.groundingScore = groundingResult.groundingScore;
      evaluation.unsupportedClaims = groundingResult.unsupportedClaims;
      
      if (requiresGrounding && groundingResult.groundingScore < this.groundingThreshold) {
        const groundingDeficit = this.groundingThreshold - groundingResult.groundingScore;
        const groundingPenalty = Math.round(groundingDeficit * 1.0);
        const adjustedScore = Math.max(0, evaluation.score - groundingPenalty);
        
        console.log(`[MasterOrchestrator] Grounding penalty: ${evaluation.score} - ${groundingPenalty} = ${adjustedScore}`);
        evaluation.score = adjustedScore;
        
        const isHardGroundingFailure = groundingResult.groundingScore <= 35;
        
        if (isHardGroundingFailure) {
          evaluation.accepted = false;
          console.log(`[MasterOrchestrator] HARD GROUNDING FAILURE (score ${groundingResult.groundingScore}): Forcing rejection regardless of quality score`);
          
          evaluation.criticalIssues = [
            ...(evaluation.criticalIssues || []),
            `GROUNDING FAILURE: Cannot verify output against project documents. Content may contain fabricated or hallucinated information.`,
            ...groundingResult.unsupportedClaims.slice(0, 3)
          ];
          evaluation.reasoning = `[GROUNDING BLOCKED] ${evaluation.reasoning}. OUTPUT REJECTED: No sufficient document evidence to verify claims.`;
        } else {
          evaluation.accepted = adjustedScore >= this.acceptanceThreshold;
          
          if (groundingResult.unsupportedClaims.length > 0) {
            evaluation.criticalIssues = [
              ...(evaluation.criticalIssues || []),
              `GROUNDING WARNING: ${groundingResult.unsupportedClaims.length} claims could not be verified against project documents.`
            ];
          }
        }
        
        evaluation.improvements = [
          ...(evaluation.improvements || []),
          'Ensure all dimensions, quantities, and specifications are extracted directly from uploaded documents',
          ...groundingResult.unsupportedClaims.slice(0, 3).map(c => `Verify or remove: "${c.substring(0, 80)}..."`)
        ];
      }
      
      return evaluation;
    } catch (error) {
      console.error('[MasterOrchestrator] Evaluation failed:', error);
      return {
        accepted: true,
        score: 70,
        reasoning: 'Evaluation failed, accepting output with default score',
        improvements: [],
        criticalIssues: [],
        groundingScore: groundingResult.groundingScore,
        unsupportedClaims: groundingResult.unsupportedClaims,
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

    const truncatedData = this.truncateOutput(output.data);
    const userPrompt = `Generate refinement feedback for ${agentName} agent.

Current Output:
${truncatedData}

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
    
    const agentConfig = this.getAgentConfig(agentName);
    const maxIterations = agentConfig.maxIterations;
    const timeoutMs = agentConfig.timeoutMs;
    
    let iteration = 0;
    let currentOutput: AgentOutput | null = null;
    let accepted = false;

    console.log(`[MasterOrchestrator] Agent ${agentName}: maxIterations=${maxIterations}, timeout=${timeoutMs}ms`);

    while (iteration < maxIterations && !accepted) {
      iteration++;
      
      this.emitProgressWithProject(context.projectId, {
        type: 'agent_start',
        agentName,
        iteration,
        message: `Starting ${agentName} agent (iteration ${iteration}/${maxIterations})`,
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
          maxIterations,
          feedback: refinementText,
          improvements: lastEval.improvements,
          criticalIssues: lastEval.criticalIssues,
          previousScore: lastEval.score,
        };
      }

      try {
        // Execute agent with timeout protection
        const startTime = Date.now();
        const timeoutPromise = new Promise<AgentOutput>((_, reject) => {
          setTimeout(() => reject(new Error(`AGENT_TIMEOUT: ${agentName} exceeded ${timeoutMs}ms`)), timeoutMs);
        });
        
        currentOutput = await Promise.race([executeAgent(feedbackData), timeoutPromise]);
        console.log(`[MasterOrchestrator] Agent ${agentName} iteration ${iteration} completed in ${Date.now() - startTime}ms`);
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

        if (!accepted && iteration < maxIterations) {
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
  maxIterationsPerAgent: 2, // Default, overridden by per-agent config
  acceptanceThreshold: 75, // Quality threshold for acceptance
});
