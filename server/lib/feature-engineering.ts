import { db } from '../db';
import { 
  projects, 
  documents, 
  rfpAnalyses, 
  bidOutcomes,
  projectFeatures,
  type Project,
  type RFPAnalysis,
  type BidOutcome,
  type ProjectFeature,
  type InsertProjectFeature
} from '@shared/schema';
import { eq, and, sql, desc } from 'drizzle-orm';

export interface ExtractedFeatures {
  projectTypeScore: number;
  clientRelationshipScore: number;
  competitivenessScore: number;
  teamCapacityScore: number;
  timelineScore: number;
  complexityScore: number;
  requirementsClarityScore: number;
  budgetAlignmentScore: number;
  historicalWinRate: number;
  similarProjectsWon: number;
  similarProjectsLost: number;
  rawFeatures: Record<string, any>;
}

export interface FeatureExtractionResult {
  features: ExtractedFeatures;
  metadata: {
    projectId: string;
    extractedAt: Date;
    dataQuality: number;
    missingFeatures: string[];
  };
}

const PROJECT_TYPE_KEYWORDS: Record<string, string[]> = {
  commercial: ['office', 'retail', 'shopping', 'mall', 'hotel', 'restaurant'],
  residential: ['house', 'apartment', 'condo', 'housing', 'residential', 'home'],
  industrial: ['factory', 'warehouse', 'manufacturing', 'plant', 'industrial'],
  infrastructure: ['road', 'bridge', 'highway', 'utility', 'water', 'sewer'],
  healthcare: ['hospital', 'clinic', 'medical', 'healthcare', 'laboratory'],
  education: ['school', 'university', 'college', 'campus', 'educational'],
  government: ['government', 'municipal', 'federal', 'state', 'public'],
};

export class FeatureEngineeringService {
  async extractFeatures(projectId: string): Promise<FeatureExtractionResult> {
    const [project] = await db.select().from(projects).where(eq(projects.id, projectId));
    
    if (!project) {
      throw new Error(`Project ${projectId} not found`);
    }

    const [analysis] = await db
      .select()
      .from(rfpAnalyses)
      .where(eq(rfpAnalyses.projectId, projectId))
      .orderBy(desc(rfpAnalyses.analyzedAt))
      .limit(1);

    const projectDocs = await db
      .select()
      .from(documents)
      .where(eq(documents.projectId, projectId));

    const historicalData = await this.getHistoricalData(project.clientName);

    const missingFeatures: string[] = [];
    
    const projectTypeScore = this.calculateProjectTypeScore(project, projectDocs);
    const clientRelationshipScore = this.calculateClientRelationshipScore(project.clientName, historicalData);
    const competitivenessScore = this.calculateCompetitivenessScore(analysis, historicalData);
    const teamCapacityScore = this.calculateTeamCapacityScore();
    const timelineScore = analysis ? this.calculateTimelineScore(analysis) : 0.5;
    const complexityScore = analysis ? this.calculateComplexityScore(analysis, projectDocs) : 0.5;
    const requirementsClarityScore = analysis ? this.calculateRequirementsClarityScore(analysis) : 0.5;
    const budgetAlignmentScore = this.calculateBudgetAlignmentScore(analysis);

    if (!analysis) missingFeatures.push('rfpAnalysis');
    if (projectDocs.length === 0) missingFeatures.push('documents');
    if (historicalData.totalProjects === 0) missingFeatures.push('historicalData');

    const features: ExtractedFeatures = {
      projectTypeScore,
      clientRelationshipScore,
      competitivenessScore,
      teamCapacityScore,
      timelineScore,
      complexityScore,
      requirementsClarityScore,
      budgetAlignmentScore,
      historicalWinRate: historicalData.winRate,
      similarProjectsWon: historicalData.won,
      similarProjectsLost: historicalData.lost,
      rawFeatures: {
        projectName: project.name,
        clientName: project.clientName,
        documentCount: projectDocs.length,
        hasAnalysis: !!analysis,
        analysisScores: analysis ? {
          quality: analysis.qualityScore,
          clarity: analysis.clarityScore,
          doability: analysis.doabilityScore,
          vendorRisk: analysis.vendorRiskScore,
        } : null,
        projectType: this.detectProjectType(project.name),
        historicalData,
      },
    };

    await this.saveFeatures(projectId, features);

    const dataQuality = this.calculateDataQuality(missingFeatures, features);

    return {
      features,
      metadata: {
        projectId,
        extractedAt: new Date(),
        dataQuality,
        missingFeatures,
      },
    };
  }

  private async getHistoricalData(clientName: string): Promise<{
    won: number;
    lost: number;
    totalProjects: number;
    winRate: number;
    avgBidAmount: number;
  }> {
    const clientProjects = await db
      .select({
        project: projects,
        outcome: bidOutcomes,
      })
      .from(projects)
      .leftJoin(bidOutcomes, eq(projects.id, bidOutcomes.projectId))
      .where(eq(projects.clientName, clientName));

    let won = 0;
    let lost = 0;
    let totalBidAmount = 0;
    let bidCount = 0;

    for (const { project, outcome } of clientProjects) {
      if (project.status === 'Closed-Won' || outcome?.outcome === 'won') {
        won++;
      } else if (project.status === 'Closed-Lost' || outcome?.outcome === 'lost') {
        lost++;
      }

      if (outcome?.bidAmount) {
        totalBidAmount += outcome.bidAmount;
        bidCount++;
      }
    }

    const totalProjects = won + lost;
    const winRate = totalProjects > 0 ? won / totalProjects : 0.5;
    const avgBidAmount = bidCount > 0 ? totalBidAmount / bidCount : 0;

    return { won, lost, totalProjects, winRate, avgBidAmount };
  }

  private detectProjectType(projectName: string): string {
    const nameLower = projectName.toLowerCase();
    
    for (const [type, keywords] of Object.entries(PROJECT_TYPE_KEYWORDS)) {
      if (keywords.some(keyword => nameLower.includes(keyword))) {
        return type;
      }
    }
    
    return 'general';
  }

  private calculateProjectTypeScore(project: Project, docs: any[]): number {
    const projectType = this.detectProjectType(project.name);
    
    const typeExperienceScores: Record<string, number> = {
      commercial: 0.8,
      residential: 0.85,
      industrial: 0.7,
      infrastructure: 0.65,
      healthcare: 0.6,
      education: 0.75,
      government: 0.7,
      general: 0.5,
    };
    
    let score = typeExperienceScores[projectType] || 0.5;
    
    if (docs.length > 5) score += 0.1;
    if (docs.length > 10) score += 0.05;
    
    return Math.min(1, Math.max(0, score));
  }

  private calculateClientRelationshipScore(clientName: string, historicalData: any): number {
    if (historicalData.totalProjects === 0) {
      return 0.5;
    }

    let score = 0.4;
    
    score += historicalData.winRate * 0.3;
    
    if (historicalData.totalProjects >= 5) score += 0.1;
    if (historicalData.totalProjects >= 10) score += 0.1;
    if (historicalData.totalProjects >= 20) score += 0.1;
    
    return Math.min(1, Math.max(0, score));
  }

  private calculateCompetitivenessScore(analysis: RFPAnalysis | undefined, historicalData: any): number {
    let score = 0.5;

    if (analysis) {
      if (analysis.doabilityScore) {
        score = analysis.doabilityScore / 100 * 0.4 + 0.3;
      }
    }

    if (historicalData.winRate > 0.6) score += 0.1;
    if (historicalData.winRate > 0.8) score += 0.1;

    return Math.min(1, Math.max(0, score));
  }

  private calculateTeamCapacityScore(): number {
    return 0.75;
  }

  private calculateTimelineScore(analysis: RFPAnalysis): number {
    const redFlags = analysis.redFlags as any[] || [];
    const timelineFlags = redFlags.filter(flag => 
      typeof flag === 'string' 
        ? flag.toLowerCase().includes('timeline') || flag.toLowerCase().includes('deadline')
        : (flag?.title || '').toLowerCase().includes('timeline')
    );

    let score = 0.8;
    score -= timelineFlags.length * 0.15;

    return Math.min(1, Math.max(0.2, score));
  }

  private calculateComplexityScore(analysis: RFPAnalysis, docs: any[]): number {
    let score = 0.7;

    if (analysis.qualityScore) {
      score = 0.5 + (analysis.qualityScore / 100) * 0.3;
    }

    if (docs.length > 20) score -= 0.1;
    if (docs.length > 50) score -= 0.1;

    return Math.min(1, Math.max(0.2, score));
  }

  private calculateRequirementsClarityScore(analysis: RFPAnalysis): number {
    let score = 0.5;

    if (analysis.clarityScore) {
      score = analysis.clarityScore / 100;
    }

    const unclearReqs = analysis.unclearRequirements as any[] || [];
    score -= unclearReqs.length * 0.05;

    return Math.min(1, Math.max(0, score));
  }

  private calculateBudgetAlignmentScore(analysis: RFPAnalysis | undefined): number {
    if (!analysis) return 0.5;

    let score = 0.6;

    if (analysis.doabilityScore && analysis.doabilityScore > 70) {
      score += 0.2;
    }

    const opportunities = analysis.opportunities as any[] || [];
    const budgetOpportunities = opportunities.filter(opp =>
      typeof opp === 'string'
        ? opp.toLowerCase().includes('budget') || opp.toLowerCase().includes('cost')
        : (opp?.title || '').toLowerCase().includes('budget')
    );

    if (budgetOpportunities.length > 0) score += 0.1;

    return Math.min(1, Math.max(0.2, score));
  }

  private calculateDataQuality(missingFeatures: string[], features: ExtractedFeatures): number {
    let quality = 1.0;

    quality -= missingFeatures.length * 0.15;

    const featureValues = [
      features.projectTypeScore,
      features.clientRelationshipScore,
      features.competitivenessScore,
      features.teamCapacityScore,
      features.timelineScore,
      features.complexityScore,
      features.requirementsClarityScore,
      features.budgetAlignmentScore,
    ];

    const defaultCount = featureValues.filter(v => v === 0.5).length;
    quality -= defaultCount * 0.05;

    return Math.max(0.1, quality);
  }

  private async saveFeatures(projectId: string, features: ExtractedFeatures): Promise<void> {
    const existing = await db
      .select()
      .from(projectFeatures)
      .where(eq(projectFeatures.projectId, projectId))
      .limit(1);

    const featureData: InsertProjectFeature = {
      projectId,
      projectTypeScore: features.projectTypeScore,
      clientRelationshipScore: features.clientRelationshipScore,
      competitivenessScore: features.competitivenessScore,
      teamCapacityScore: features.teamCapacityScore,
      timelineScore: features.timelineScore,
      complexityScore: features.complexityScore,
      requirementsClarityScore: features.requirementsClarityScore,
      budgetAlignmentScore: features.budgetAlignmentScore,
      historicalWinRate: features.historicalWinRate,
      similarProjectsWon: features.similarProjectsWon,
      similarProjectsLost: features.similarProjectsLost,
      rawFeatures: features.rawFeatures,
      extractedAt: new Date(),
      version: '1.0',
    };

    if (existing.length > 0) {
      await db
        .update(projectFeatures)
        .set(featureData)
        .where(eq(projectFeatures.projectId, projectId));
    } else {
      await db.insert(projectFeatures).values(featureData);
    }
  }

  async getFeatures(projectId: string): Promise<ProjectFeature | null> {
    const [feature] = await db
      .select()
      .from(projectFeatures)
      .where(eq(projectFeatures.projectId, projectId))
      .limit(1);

    return feature || null;
  }

  async getFeatureImportance(): Promise<Record<string, number>> {
    return {
      projectTypeScore: 0.12,
      clientRelationshipScore: 0.18,
      competitivenessScore: 0.15,
      teamCapacityScore: 0.10,
      timelineScore: 0.12,
      complexityScore: 0.10,
      requirementsClarityScore: 0.13,
      budgetAlignmentScore: 0.10,
    };
  }
}

export const featureEngineeringService = new FeatureEngineeringService();
