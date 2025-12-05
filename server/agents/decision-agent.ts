import { BaseAgent, AgentInput, AgentOutput, AgentContext } from './base-agent';
import { AnalysisResultType } from './state';

export class DecisionAgent extends BaseAgent {
  name = 'decision';
  description = 'Makes strategic decisions about bid approach based on analysis';

  async execute(input: AgentInput, context: AgentContext): Promise<AgentOutput> {
    return this.wrapExecution(async () => {
      const state = input.data as { analysis?: AnalysisResultType };
      const analysis = state.analysis;

      if (!analysis) {
        return {
          success: false,
          error: 'No analysis available for decision making',
        };
      }

      this.log('Making strategic bid decisions');

      const bidStrategy = this.determineBidStrategy(analysis);

      this.log(`Bid strategy determined: ${bidStrategy.approach}`);

      return {
        success: true,
        data: {
          bidStrategy,
          logs: [`Bid strategy: ${bidStrategy.approach}`],
        },
      };
    }, 'bid decision');
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
