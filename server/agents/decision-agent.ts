import { BaseAgent, AgentInput, AgentOutput, AgentContext } from './base-agent';
import { AnalysisResultType } from './state';
import { storage } from '../storage';

const MIN_DOABILITY_THRESHOLD = 30;

export class DecisionAgent extends BaseAgent {
  name = 'decision';
  description = 'Makes strategic decisions about bid approach based on analysis';

  async execute(input: AgentInput, context: AgentContext): Promise<AgentOutput> {
    return this.wrapExecution(async () => {
      const state = input.data as { analysis?: AnalysisResultType; projectId?: string; companyId?: number | null };
      const analysis = state.analysis;
      const projectId = state.projectId;
      const companyId = state.companyId ?? null;

      if (!analysis) {
        return {
          success: false,
          error: 'No analysis available for decision making',
        };
      }

      this.log('Making strategic bid decisions');

      const { bidStrategy, decisionLog } = this.determineDecision(analysis);

      this.log(`Decision: ${decisionLog.decision} - ${decisionLog.triggeredRule}`);
      this.log(`Bid strategy determined: ${bidStrategy.approach}`);

      if (projectId) {
        try {
          await storage.createDecisionLog({
            projectId,
            companyId,
            doabilityScore: decisionLog.doabilityScore,
            minDoabilityThreshold: decisionLog.minDoabilityThreshold,
            criticalRiskLevel: decisionLog.criticalRiskLevel,
            vendorRiskScore: decisionLog.vendorRiskScore,
            decision: decisionLog.decision,
            reason: decisionLog.reason,
            triggeredRule: decisionLog.triggeredRule,
            bidStrategy: bidStrategy,
          });
          this.log('Decision log saved to database');
        } catch (error) {
          this.log(`Warning: Failed to save decision log: ${error}`);
        }
      }

      return {
        success: true,
        data: {
          bidStrategy,
          decisionLog,
          logs: [`Decision: ${decisionLog.decision}`, `Bid strategy: ${bidStrategy.approach}`],
        },
      };
    }, 'bid decision');
  }

  private determineDecision(analysis: AnalysisResultType) {
    const { doabilityScore, vendorRiskScore, overallRiskLevel } = analysis;
    
    const isCriticalRisk = overallRiskLevel === 'Critical';
    const isLowDoability = doabilityScore < MIN_DOABILITY_THRESHOLD;
    
    let decision: 'PROCEED' | 'REJECT' = 'PROCEED';
    let triggeredRule = 'Default: Scores within acceptable range';
    let reason = 'Analysis indicates acceptable risk levels and project feasibility.';

    if (isCriticalRisk) {
      decision = 'REJECT';
      triggeredRule = 'Critical Risk Level detected';
      reason = `Overall risk level is Critical, which exceeds acceptable thresholds. Vendor risk score: ${vendorRiskScore}%.`;
    } else if (isLowDoability) {
      decision = 'REJECT';
      triggeredRule = `Doability Score (${doabilityScore}%) below minimum threshold (${MIN_DOABILITY_THRESHOLD}%)`;
      reason = `Project doability score of ${doabilityScore}% is below the minimum threshold of ${MIN_DOABILITY_THRESHOLD}%, indicating low probability of successful execution.`;
    } else if (vendorRiskScore > 80) {
      decision = 'REJECT';
      triggeredRule = `Vendor Risk Score (${vendorRiskScore}%) exceeds 80%`;
      reason = `High vendor risk score of ${vendorRiskScore}% indicates significant payment or reliability concerns.`;
    }

    const decisionLog = {
      doabilityScore,
      minDoabilityThreshold: MIN_DOABILITY_THRESHOLD,
      criticalRiskLevel: isCriticalRisk,
      vendorRiskScore: vendorRiskScore || 0,
      decision,
      reason,
      triggeredRule,
    };

    const bidStrategy = this.determineBidStrategy(analysis);

    return { bidStrategy, decisionLog };
  }

  private determineBidStrategy(analysis: AnalysisResultType) {
    const { doabilityScore, vendorRiskScore, overallRiskLevel, opportunities, redFlags } = analysis;

    let approach: 'aggressive' | 'balanced' | 'conservative' = 'balanced';
    let pricePositioning: 'low' | 'mid' | 'premium' = 'mid';
    const focusAreas: string[] = [];

    if (doabilityScore >= 70 && vendorRiskScore <= 40) {
      approach = 'aggressive';
      pricePositioning = 'mid';
      focusAreas.push('competitive pricing', 'fast timeline');
    } else if (doabilityScore >= 50 && overallRiskLevel !== 'Critical') {
      approach = 'balanced';
      pricePositioning = 'mid';
      focusAreas.push('quality emphasis', 'value proposition');
    } else {
      approach = 'conservative';
      pricePositioning = 'premium';
      focusAreas.push('risk mitigation', 'detailed methodology');
    }

    if (opportunities.length > 0) {
      focusAreas.push(...opportunities.slice(0, 2));
    }

    const riskMitigations = redFlags.map(flag => ({
      risk: flag,
      mitigation: `Address in proposal: ${flag}`,
    }));

    return {
      approach,
      pricePositioning,
      focusAreas,
      riskMitigations,
      confidenceLevel: doabilityScore,
      recommendedMargin: this.calculateRecommendedMargin(analysis),
    };
  }

  private calculateRecommendedMargin(analysis: AnalysisResultType): string {
    const { vendorRiskScore, doabilityScore } = analysis;
    
    if (vendorRiskScore > 70) {
      return '18-22%';
    } else if (vendorRiskScore > 50) {
      return '15-18%';
    } else if (doabilityScore > 70) {
      return '10-13%';
    } else {
      return '12-15%';
    }
  }
}

export const decisionAgent = new DecisionAgent();
