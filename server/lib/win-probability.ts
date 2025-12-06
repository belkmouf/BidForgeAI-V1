import { db } from '../db';
import { 
  winProbabilityPredictions,
  bidOutcomes,
  projectFeatures,
  projects,
  type WinProbabilityPrediction,
  type InsertWinProbabilityPrediction,
  type ProjectFeature
} from '@shared/schema';
import { eq, desc, and, gte, sql } from 'drizzle-orm';
import { featureEngineeringService, type ExtractedFeatures } from './feature-engineering';

export interface WinProbabilityResult {
  probability: number;
  confidence: number;
  featureScores: Record<string, number>;
  featureWeights: Record<string, number>;
  riskFactors: string[];
  strengthFactors: string[];
  recommendations: string[];
  breakdown: FeatureBreakdown[];
  topContributors: ContributionSummary[];
  topDetractors: ContributionSummary[];
}

export interface ContributionSummary {
  factor: string;
  contribution: string;
  insight: string;
}

export interface FeatureBreakdown {
  name: string;
  displayName: string;
  score: number;
  weight: number;
  contribution: number;
  status: 'positive' | 'neutral' | 'negative';
  insight: string;
}

export interface ModelMetrics {
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  sampleSize: number;
  lastTrainedAt: Date | null;
}

const DEFAULT_FEATURE_WEIGHTS: Record<string, number> = {
  projectTypeScore: 0.12,
  clientRelationshipScore: 0.18,
  competitivenessScore: 0.15,
  teamCapacityScore: 0.10,
  timelineScore: 0.12,
  complexityScore: 0.10,
  requirementsClarityScore: 0.13,
  budgetAlignmentScore: 0.10,
};

const FEATURE_DISPLAY_NAMES: Record<string, string> = {
  projectTypeScore: 'Project Type Fit',
  clientRelationshipScore: 'Client Relationship',
  competitivenessScore: 'Competitive Position',
  teamCapacityScore: 'Team Capacity',
  timelineScore: 'Timeline Feasibility',
  complexityScore: 'Complexity Management',
  requirementsClarityScore: 'Requirements Clarity',
  budgetAlignmentScore: 'Budget Alignment',
};

export class WinProbabilityService {
  private weights: Record<string, number> = { ...DEFAULT_FEATURE_WEIGHTS };
  private modelVersion = '1.0';

  async predict(projectId: string): Promise<WinProbabilityResult> {
    const featureResult = await featureEngineeringService.extractFeatures(projectId);
    const features = featureResult.features;

    const featureScores: Record<string, number> = {
      projectTypeScore: features.projectTypeScore,
      clientRelationshipScore: features.clientRelationshipScore,
      competitivenessScore: features.competitivenessScore,
      teamCapacityScore: features.teamCapacityScore,
      timelineScore: features.timelineScore,
      complexityScore: features.complexityScore,
      requirementsClarityScore: features.requirementsClarityScore,
      budgetAlignmentScore: features.budgetAlignmentScore,
    };

    let probability = 0;
    for (const [feature, score] of Object.entries(featureScores)) {
      probability += score * (this.weights[feature] || 0);
    }

    probability = this.applyHistoricalAdjustment(probability, features);
    probability = this.applySigmoid(probability);

    const confidence = this.calculateConfidence(featureResult.metadata.dataQuality, features);

    const breakdown = this.generateBreakdown(featureScores);
    const riskFactors = this.identifyRiskFactors(featureScores);
    const strengthFactors = this.identifyStrengthFactors(featureScores);
    const recommendations = this.generateRecommendations(featureScores, riskFactors);

    const { topContributors, topDetractors } = this.generateContributionSummaries(breakdown);

    const result: WinProbabilityResult = {
      probability: Math.round(probability * 100) / 100,
      confidence: Math.round(confidence * 100) / 100,
      featureScores,
      featureWeights: { ...this.weights },
      riskFactors,
      strengthFactors,
      recommendations,
      breakdown,
      topContributors,
      topDetractors,
    };

    await this.savePrediction(projectId, result);

    return result;
  }

  private generateContributionSummaries(breakdown: FeatureBreakdown[]): {
    topContributors: ContributionSummary[];
    topDetractors: ContributionSummary[];
  } {
    const sorted = [...breakdown].sort((a, b) => b.contribution - a.contribution);
    
    const topContributors: ContributionSummary[] = sorted
      .filter(b => b.status === 'positive')
      .slice(0, 3)
      .map(b => ({
        factor: b.displayName,
        contribution: `+${Math.round(b.contribution * 100)}%`,
        insight: this.generateDetailedInsight(b, 'positive'),
      }));

    const topDetractors: ContributionSummary[] = sorted
      .filter(b => b.status === 'negative')
      .slice(0, 3)
      .map(b => ({
        factor: b.displayName,
        contribution: `-${Math.round((0.5 - b.score) * b.weight * 100)}%`,
        insight: this.generateDetailedInsight(b, 'negative'),
      }));

    return { topContributors, topDetractors };
  }

  private generateDetailedInsight(breakdown: FeatureBreakdown, type: 'positive' | 'negative'): string {
    const scorePercent = Math.round(breakdown.score * 100);
    const weightPercent = Math.round(breakdown.weight * 100);
    
    if (type === 'positive') {
      switch (breakdown.name) {
        case 'clientRelationshipScore':
          return `Strong ${scorePercent}/100 rating indicating excellent client history and trust.`;
        case 'projectTypeScore':
          return `${scorePercent}% alignment with your core expertise areas.`;
        case 'competitivenessScore':
          return `Competitive advantage score of ${scorePercent}% in this market segment.`;
        case 'teamCapacityScore':
          return `Team availability rated at ${scorePercent}%, resources are ready.`;
        case 'timelineScore':
          return `Timeline feasibility at ${scorePercent}%, deliverables are achievable.`;
        case 'requirementsClarityScore':
          return `Requirements clarity at ${scorePercent}%, reducing scope risk.`;
        case 'budgetAlignmentScore':
          return `Budget alignment at ${scorePercent}%, expectations match capabilities.`;
        case 'complexityScore':
          return `Complexity manageable at ${scorePercent}%, within team capabilities.`;
        default:
          return `Contributing ${weightPercent}% weight with ${scorePercent}% score.`;
      }
    } else {
      switch (breakdown.name) {
        case 'clientRelationshipScore':
          return `Limited history (${scorePercent}/100) increases relationship building effort needed.`;
        case 'projectTypeScore':
          return `Only ${scorePercent}% alignment with expertise - may require additional resources.`;
        case 'competitivenessScore':
          return `Competitive position at ${scorePercent}% indicates strong market competition.`;
        case 'teamCapacityScore':
          return `Team availability at ${scorePercent}% may constrain project execution.`;
        case 'timelineScore':
          return `Timeline feasibility at ${scorePercent}% poses delivery risk.`;
        case 'requirementsClarityScore':
          return `Requirements clarity at ${scorePercent}% increases scope creep risk.`;
        case 'budgetAlignmentScore':
          return `Budget alignment at ${scorePercent}% indicates potential margin pressure.`;
        case 'complexityScore':
          return `Complexity score of ${scorePercent}% indicates challenging execution.`;
        default:
          return `Reducing probability by ${weightPercent}% weight with ${scorePercent}% score.`;
      }
    }
  }

  private applyHistoricalAdjustment(probability: number, features: ExtractedFeatures): number {
    if (features.historicalWinRate > 0 && features.similarProjectsWon + features.similarProjectsLost > 0) {
      const historicalWeight = Math.min(0.2, (features.similarProjectsWon + features.similarProjectsLost) / 20);
      probability = probability * (1 - historicalWeight) + features.historicalWinRate * historicalWeight;
    }
    return probability;
  }

  private applySigmoid(x: number): number {
    const scaled = (x - 0.5) * 6;
    return 1 / (1 + Math.exp(-scaled));
  }

  private calculateConfidence(dataQuality: number, features: ExtractedFeatures): number {
    let confidence = dataQuality;

    const totalHistoricalData = features.similarProjectsWon + features.similarProjectsLost;
    if (totalHistoricalData > 10) confidence += 0.1;
    if (totalHistoricalData > 20) confidence += 0.1;

    const featureVariance = this.calculateFeatureVariance(features);
    if (featureVariance < 0.1) confidence -= 0.1;

    return Math.min(0.95, Math.max(0.3, confidence));
  }

  private calculateFeatureVariance(features: ExtractedFeatures): number {
    const scores = [
      features.projectTypeScore,
      features.clientRelationshipScore,
      features.competitivenessScore,
      features.teamCapacityScore,
      features.timelineScore,
      features.complexityScore,
      features.requirementsClarityScore,
      features.budgetAlignmentScore,
    ];

    const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
    const variance = scores.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) / scores.length;
    return variance;
  }

  private generateBreakdown(featureScores: Record<string, number>): FeatureBreakdown[] {
    const breakdown: FeatureBreakdown[] = [];

    for (const [name, score] of Object.entries(featureScores)) {
      const weight = this.weights[name] || 0;
      const contribution = score * weight;
      
      let status: 'positive' | 'neutral' | 'negative';
      if (score >= 0.7) status = 'positive';
      else if (score >= 0.4) status = 'neutral';
      else status = 'negative';

      const insight = this.generateFeatureInsight(name, score);

      breakdown.push({
        name,
        displayName: FEATURE_DISPLAY_NAMES[name] || name,
        score: Math.round(score * 100) / 100,
        weight: Math.round(weight * 100) / 100,
        contribution: Math.round(contribution * 1000) / 1000,
        status,
        insight,
      });
    }

    return breakdown.sort((a, b) => b.contribution - a.contribution);
  }

  private generateFeatureInsight(name: string, score: number): string {
    const insights: Record<string, Record<string, string>> = {
      projectTypeScore: {
        high: 'Strong alignment with your typical project types',
        medium: 'Moderate fit with your experience portfolio',
        low: 'Project type outside your core expertise',
      },
      clientRelationshipScore: {
        high: 'Strong existing relationship with this client',
        medium: 'Limited history with this client',
        low: 'New client - relationship building needed',
      },
      competitivenessScore: {
        high: 'Strong competitive position for this bid',
        medium: 'Moderate competitive standing',
        low: 'Facing strong competition',
      },
      teamCapacityScore: {
        high: 'Team has capacity for this project',
        medium: 'Some capacity constraints exist',
        low: 'Significant capacity concerns',
      },
      timelineScore: {
        high: 'Timeline is achievable',
        medium: 'Timeline may be challenging',
        low: 'Timeline poses significant risk',
      },
      complexityScore: {
        high: 'Project complexity is manageable',
        medium: 'Moderate complexity challenges',
        low: 'High complexity - requires careful planning',
      },
      requirementsClarityScore: {
        high: 'Requirements are well-defined',
        medium: 'Some requirements need clarification',
        low: 'Many unclear or missing requirements',
      },
      budgetAlignmentScore: {
        high: 'Budget expectations align well',
        medium: 'Some budget concerns exist',
        low: 'Significant budget alignment issues',
      },
    };

    const level = score >= 0.7 ? 'high' : score >= 0.4 ? 'medium' : 'low';
    return insights[name]?.[level] || `Score: ${Math.round(score * 100)}%`;
  }

  private identifyRiskFactors(scores: Record<string, number>): string[] {
    const risks: string[] = [];

    if (scores.timelineScore < 0.5) {
      risks.push('Tight timeline may affect quality or profitability');
    }
    if (scores.requirementsClarityScore < 0.5) {
      risks.push('Unclear requirements increase scope creep risk');
    }
    if (scores.clientRelationshipScore < 0.4) {
      risks.push('Limited client history increases uncertainty');
    }
    if (scores.budgetAlignmentScore < 0.5) {
      risks.push('Budget expectations may not align with project scope');
    }
    if (scores.complexityScore < 0.4) {
      risks.push('High project complexity requires additional resources');
    }
    if (scores.teamCapacityScore < 0.5) {
      risks.push('Team capacity constraints may impact delivery');
    }

    return risks;
  }

  private identifyStrengthFactors(scores: Record<string, number>): string[] {
    const strengths: string[] = [];

    if (scores.clientRelationshipScore >= 0.7) {
      strengths.push('Strong existing client relationship');
    }
    if (scores.projectTypeScore >= 0.7) {
      strengths.push('Excellent fit with core competencies');
    }
    if (scores.competitivenessScore >= 0.7) {
      strengths.push('Strong competitive positioning');
    }
    if (scores.teamCapacityScore >= 0.7) {
      strengths.push('Adequate team availability');
    }
    if (scores.requirementsClarityScore >= 0.7) {
      strengths.push('Well-defined project requirements');
    }
    if (scores.budgetAlignmentScore >= 0.7) {
      strengths.push('Good budget-scope alignment');
    }

    return strengths;
  }

  private generateRecommendations(
    scores: Record<string, number>, 
    riskFactors: string[]
  ): string[] {
    const recommendations: string[] = [];

    if (scores.requirementsClarityScore < 0.6) {
      recommendations.push('Schedule a clarification meeting to address unclear requirements');
    }
    if (scores.clientRelationshipScore < 0.5) {
      recommendations.push('Invest in relationship-building activities with the client');
    }
    if (scores.budgetAlignmentScore < 0.5) {
      recommendations.push('Consider value engineering options to align with budget constraints');
    }
    if (scores.timelineScore < 0.5) {
      recommendations.push('Propose phased delivery approach to manage timeline risk');
    }
    if (scores.competitivenessScore < 0.5) {
      recommendations.push('Highlight unique differentiators in your proposal');
    }
    if (scores.complexityScore < 0.4) {
      recommendations.push('Include detailed risk mitigation plan in proposal');
    }

    if (riskFactors.length === 0 && recommendations.length === 0) {
      recommendations.push('Strong position - focus on competitive pricing and quality proposal');
    }

    return recommendations.slice(0, 5);
  }

  private async savePrediction(projectId: string, result: WinProbabilityResult): Promise<void> {
    const predictionData: InsertWinProbabilityPrediction = {
      projectId,
      probability: result.probability,
      confidence: result.confidence,
      featureScores: result.featureScores,
      featureWeights: result.featureWeights,
      breakdown: result.breakdown,
      riskFactors: result.riskFactors,
      strengthFactors: result.strengthFactors,
      recommendations: result.recommendations,
      modelVersion: this.modelVersion,
      predictionDate: new Date(),
    };

    await db.insert(winProbabilityPredictions).values(predictionData);
  }

  async getPredictionHistory(projectId: string): Promise<WinProbabilityPrediction[]> {
    return db
      .select()
      .from(winProbabilityPredictions)
      .where(eq(winProbabilityPredictions.projectId, projectId))
      .orderBy(desc(winProbabilityPredictions.predictionDate));
  }

  async getLatestPrediction(projectId: string): Promise<WinProbabilityPrediction | null> {
    const [prediction] = await db
      .select()
      .from(winProbabilityPredictions)
      .where(eq(winProbabilityPredictions.projectId, projectId))
      .orderBy(desc(winProbabilityPredictions.predictionDate))
      .limit(1);

    return prediction || null;
  }

  async recordOutcome(
    projectId: string,
    outcome: 'won' | 'lost' | 'no_bid',
    details?: {
      bidAmount?: number;
      winningBidAmount?: number;
      competitorCount?: number;
      outcomeFactors?: string[];
      clientFeedback?: string;
      lessonsLearned?: string;
    },
    userId?: number
  ): Promise<void> {
    await db.insert(bidOutcomes).values({
      projectId,
      outcome,
      bidAmount: details?.bidAmount,
      winningBidAmount: details?.winningBidAmount,
      competitorCount: details?.competitorCount,
      outcomeFactors: details?.outcomeFactors || [],
      clientFeedback: details?.clientFeedback,
      lessonsLearned: details?.lessonsLearned,
      recordedBy: userId,
    });

    await this.updateModelFromOutcome(projectId, outcome);
  }

  private async updateModelFromOutcome(projectId: string, outcome: string): Promise<void> {
    const [features] = await db
      .select()
      .from(projectFeatures)
      .where(eq(projectFeatures.projectId, projectId))
      .limit(1);

    if (!features) return;

    console.log(`[WinProbability] Recording outcome '${outcome}' for project ${projectId}`);
  }

  async getModelMetrics(): Promise<ModelMetrics> {
    const outcomes = await db
      .select({
        outcome: bidOutcomes,
        prediction: winProbabilityPredictions,
      })
      .from(bidOutcomes)
      .leftJoin(
        winProbabilityPredictions,
        eq(bidOutcomes.projectId, winProbabilityPredictions.projectId)
      )
      .where(
        sql`${bidOutcomes.outcome} IN ('won', 'lost')`
      );

    let correct = 0;
    let truePositives = 0;
    let falsePositives = 0;
    let falseNegatives = 0;
    let evaluated = 0;

    for (const { outcome, prediction } of outcomes) {
      if (!prediction) continue;
      evaluated++;

      const predictedWin = prediction.probability >= 0.5;
      const actualWin = outcome.outcome === 'won';

      if (predictedWin === actualWin) correct++;
      if (predictedWin && actualWin) truePositives++;
      if (predictedWin && !actualWin) falsePositives++;
      if (!predictedWin && actualWin) falseNegatives++;
    }

    const accuracy = evaluated > 0 ? correct / evaluated : 0;
    const precision = truePositives + falsePositives > 0 
      ? truePositives / (truePositives + falsePositives) 
      : 0;
    const recall = truePositives + falseNegatives > 0 
      ? truePositives / (truePositives + falseNegatives) 
      : 0;
    const f1Score = precision + recall > 0 
      ? 2 * (precision * recall) / (precision + recall) 
      : 0;

    return {
      accuracy: Math.round(accuracy * 100) / 100,
      precision: Math.round(precision * 100) / 100,
      recall: Math.round(recall * 100) / 100,
      f1Score: Math.round(f1Score * 100) / 100,
      sampleSize: evaluated,
      lastTrainedAt: null,
    };
  }

  async getAggregateStats(): Promise<{
    totalPredictions: number;
    avgProbability: number;
    avgConfidence: number;
    winRate: number;
    outcomeDistribution: Record<string, number>;
  }> {
    const predictions = await db
      .select()
      .from(winProbabilityPredictions);

    const outcomes = await db
      .select()
      .from(bidOutcomes);

    const totalPredictions = predictions.length;
    const avgProbability = predictions.length > 0
      ? predictions.reduce((sum, p) => sum + p.probability, 0) / predictions.length
      : 0;
    const avgConfidence = predictions.length > 0
      ? predictions.reduce((sum, p) => sum + p.confidence, 0) / predictions.length
      : 0;

    const outcomeDistribution: Record<string, number> = {};
    let wonCount = 0;
    let totalClosed = 0;

    for (const outcome of outcomes) {
      outcomeDistribution[outcome.outcome] = (outcomeDistribution[outcome.outcome] || 0) + 1;
      if (outcome.outcome === 'won') wonCount++;
      if (outcome.outcome === 'won' || outcome.outcome === 'lost') totalClosed++;
    }

    const winRate = totalClosed > 0 ? wonCount / totalClosed : 0;

    return {
      totalPredictions,
      avgProbability: Math.round(avgProbability * 100) / 100,
      avgConfidence: Math.round(avgConfidence * 100) / 100,
      winRate: Math.round(winRate * 100) / 100,
      outcomeDistribution,
    };
  }
}

export const winProbabilityService = new WinProbabilityService();
