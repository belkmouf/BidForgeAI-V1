export { BaseAgent, InMemoryAgentRegistry } from './base-agent';
export type { AgentInput, AgentOutput, AgentContext, AgentRegistry } from './base-agent';
export { BidWorkflowAnnotation, AgentStateSchema } from './state';
export type { BidWorkflowState, AgentState } from './state';
export { AgentOrchestrator, orchestrator } from './orchestrator';
export type { OrchestratorConfig } from './orchestrator';
export { IntakeAgent, intakeAgent } from './intake-agent';
export { AnalysisAgent, analysisAgent } from './analysis-agent';
export { DecisionAgent, decisionAgent } from './decision-agent';
export { GenerationAgent, generationAgent } from './generation-agent';
export { ReviewAgent, reviewAgent } from './review-agent';

import { orchestrator } from './orchestrator';
import { intakeAgent } from './intake-agent';
import { analysisAgent } from './analysis-agent';
import { decisionAgent } from './decision-agent';
import { generationAgent } from './generation-agent';
import { reviewAgent } from './review-agent';

export function initializeAgents() {
  orchestrator.registerAgent(intakeAgent);
  orchestrator.registerAgent(analysisAgent);
  orchestrator.registerAgent(decisionAgent);
  orchestrator.registerAgent(generationAgent);
  orchestrator.registerAgent(reviewAgent);
  
  orchestrator.buildGraph();
  
  console.log('[Agents] All agents initialized and registered');
  
  return orchestrator;
}
