import { db } from '../db';
import {
  projectSummaries,
  documentMetadata,
  documents,
  documentChunks,
  type ProjectSummary,
  type InsertProjectSummary,
  type DocumentMetadata,
  type InsertDocumentMetadata
} from '@shared/schema';
import { eq, sql } from 'drizzle-orm';
import { openai } from './openai.js';

/**
 * Extract entities and key information from document content
 */
export async function extractEntitiesFromDocument(
  content: string,
  filename: string
): Promise<{
  keyInformation: NonNullable<DocumentMetadata['keyInformation']>;
  extractedEntities: NonNullable<DocumentMetadata['extractedEntities']>;
}> {
  try {
    const prompt = `
You are an expert at extracting structured information from construction RFQ/RFP documents.

Analyze this document and extract key information:

Filename: ${filename}
Content: ${content.substring(0, 8000)} ${content.length > 8000 ? '...(truncated)' : ''}

Extract and return as JSON:
{
  "keyInformation": {
    "projectType": "string (e.g., Commercial Construction, Residential, Infrastructure)",
    "location": "string (project address or location)",
    "deadline": "string (bid submission deadline)",
    "budget": "string (budget range or estimated value)",
    "requirements": ["array", "of", "key", "requirements"]
  },
  "extractedEntities": [
    {
      "type": "date|money|location|requirement|contact|deadline",
      "value": "extracted value",
      "confidence": 0.0-1.0,
      "context": "brief context where found"
    }
  ]
}

Rules:
- Only extract information explicitly stated in the document
- Set confidence lower (0.3-0.6) if inferring
- Set confidence higher (0.7-1.0) if explicitly stated
- Leave fields empty/null if not found
- Focus on construction-relevant information
`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.1, // Low temperature for consistent extraction
    });

    const extracted = JSON.parse(response.choices[0].message.content || '{}');

    return {
      keyInformation: extracted.keyInformation || {},
      extractedEntities: extracted.extractedEntities || [],
    };
  } catch (error) {
    console.error('[DocumentAnalysis] Entity extraction error:', error);
    return {
      keyInformation: {},
      extractedEntities: [],
    };
  }
}

/**
 * Calculate coverage score based on how complete the information is
 */
function calculateCoverageScore(summary: Partial<InsertProjectSummary>): number {
  const weights = {
    overview: 20,
    scopeOfWork: 20,
    keyRequirements_budget: 15,
    keyRequirements_timeline: 15,
    keyRequirements_certifications: 10,
    keyRequirements_labor: 10,
    riskFactors: 5,
    opportunities: 5,
  };

  let score = 0;

  if (summary.overview && summary.overview.length > 50) {
    score += weights.overview;
  }

  if (summary.scopeOfWork && summary.scopeOfWork.length >= 3) {
    score += weights.scopeOfWork;
  }

  if (summary.keyRequirements?.budget) {
    score += weights.keyRequirements_budget;
  }

  if (summary.keyRequirements?.timeline) {
    score += weights.keyRequirements_timeline;
  }

  if (summary.keyRequirements?.certifications && summary.keyRequirements.certifications.length > 0) {
    score += weights.keyRequirements_certifications;
  }

  if (summary.keyRequirements?.labor) {
    score += weights.keyRequirements_labor;
  }

  if (summary.riskFactors && summary.riskFactors.length > 0) {
    score += weights.riskFactors;
  }

  if (summary.opportunities && summary.opportunities.length > 0) {
    score += weights.opportunities;
  }

  return Math.min(100, Math.round(score));
}

/**
 * Calculate completeness score based on missing information
 */
function calculateCompletenessScore(summary: Partial<InsertProjectSummary>): number {
  const missingCount = summary.missingInformation?.length || 0;

  // If more than 5 missing items, score decreases significantly
  if (missingCount === 0) return 100;
  if (missingCount === 1) return 90;
  if (missingCount === 2) return 80;
  if (missingCount === 3) return 70;
  if (missingCount === 4) return 60;
  if (missingCount === 5) return 50;
  return Math.max(20, 50 - (missingCount - 5) * 5);
}

/**
 * Generate comprehensive project summary from all project documents
 */
export async function generateProjectSummary(projectId: string): Promise<ProjectSummary> {
  try {
    console.log(`[DocumentAnalysis] Generating summary for project ${projectId}`);

    // Get all document chunks for this project
    const chunks = await db
      .select({
        content: documentChunks.content,
        filename: documents.filename,
      })
      .from(documentChunks)
      .innerJoin(documents, eq(documentChunks.documentId, documents.id))
      .where(eq(documents.projectId, projectId))
      .orderBy(documentChunks.chunkIndex);

    if (chunks.length === 0) {
      throw new Error('No document chunks found for project');
    }

    // Combine all content (limit to avoid token limits)
    const allContent = chunks
      .map((c) => c.content)
      .join('\n\n')
      .substring(0, 30000); // Limit to ~30k chars

    // Generate structured summary using AI
    const prompt = `
You are an expert construction project analyst. Analyze these RFQ/RFP documents and generate a comprehensive structured summary.

Documents:
${allContent}

Generate a JSON summary with:
{
  "overview": "2-3 sentence project overview",
  "scopeOfWork": ["bullet", "points", "of", "work", "items"],
  "keyRequirements": {
    "budget": "budget range or value",
    "timeline": "project duration or deadline",
    "certifications": ["required", "certifications"],
    "labor": "labor requirements (union, non-union, etc)",
    "insurance": ["insurance", "requirements"],
    "bonding": "bonding requirements"
  },
  "riskFactors": ["identified", "risk", "factors"],
  "opportunities": ["potential", "opportunities", "or", "strengths"],
  "missingInformation": ["items", "not", "specified", "in", "documents"]
}

Instructions:
- Be specific and accurate
- Only include information explicitly stated or clearly implied
- Identify risks (tight deadlines, complex requirements, location challenges)
- Note opportunities (preferred vendor status, flexible terms, good margins)
- List missing critical information clearly
- Use professional construction industry terminology
`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    });

    const summaryData = JSON.parse(response.choices[0].message.content || '{}');

    // Calculate scores
    const coverageScore = calculateCoverageScore(summaryData);
    const completenessScore = calculateCompletenessScore(summaryData);

    // Insert or update summary in database
    const [existingSummary] = await db
      .select()
      .from(projectSummaries)
      .where(eq(projectSummaries.projectId, projectId))
      .limit(1);

    if (existingSummary) {
      // Update existing
      const [updated] = await db
        .update(projectSummaries)
        .set({
          ...summaryData,
          coverageScore,
          completenessScore,
          isUserEdited: false,
          updatedAt: new Date(),
        })
        .where(eq(projectSummaries.projectId, projectId))
        .returning();

      console.log(`[DocumentAnalysis] Updated summary for project ${projectId}`);
      return updated;
    } else {
      // Create new
      const [created] = await db
        .insert(projectSummaries)
        .values({
          projectId,
          ...summaryData,
          coverageScore,
          completenessScore,
        })
        .returning();

      console.log(`[DocumentAnalysis] Created summary for project ${projectId}`);
      return created;
    }
  } catch (error) {
    console.error('[DocumentAnalysis] Summary generation error:', error);
    throw error;
  }
}

/**
 * Update project summary with user edits
 */
export async function updateProjectSummary(
  projectId: string,
  updates: Partial<InsertProjectSummary>
): Promise<ProjectSummary> {
  // Recalculate scores with updated data
  const [existingSummary] = await db
    .select()
    .from(projectSummaries)
    .where(eq(projectSummaries.projectId, projectId))
    .limit(1);

  if (!existingSummary) {
    throw new Error('Project summary not found');
  }

  const updatedData = { ...existingSummary, ...updates };
  const coverageScore = calculateCoverageScore(updatedData);
  const completenessScore = calculateCompletenessScore(updatedData);

  const [updated] = await db
    .update(projectSummaries)
    .set({
      ...updates,
      coverageScore,
      completenessScore,
      isUserEdited: true,
      updatedAt: new Date(),
    })
    .where(eq(projectSummaries.projectId, projectId))
    .returning();

  return updated;
}

/**
 * Get project summary statistics
 */
export async function getProjectSummaryStats(projectId: string) {
  // Get document count and processing status
  const docs = await db
    .select({
      id: documents.id,
      filename: documents.filename,
      isProcessed: documents.isProcessed,
      uploadedAt: documents.uploadedAt,
    })
    .from(documents)
    .where(eq(documents.projectId, projectId));

  // Get total chunks
  const [chunkCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(documentChunks)
    .innerJoin(documents, eq(documentChunks.documentId, documents.id))
    .where(eq(documents.projectId, projectId));

  // Get total file size from metadata
  const metadataList = await db
    .select({ fileSize: documentMetadata.fileSize })
    .from(documentMetadata)
    .innerJoin(documents, eq(documentMetadata.documentId, documents.id))
    .where(eq(documents.projectId, projectId));

  const totalSize = metadataList.reduce((sum, m) => sum + (m.fileSize || 0), 0);

  return {
    documentCount: docs.length,
    totalSize,
    totalChunks: chunkCount.count || 0,
    allProcessed: docs.every((d) => d.isProcessed),
    documents: docs,
  };
}

/**
 * Calculate readiness score for project
 */
export async function calculateReadinessScore(projectId: string) {
  const stats = await getProjectSummaryStats(projectId);

  const [summary] = await db
    .select()
    .from(projectSummaries)
    .where(eq(projectSummaries.projectId, projectId))
    .limit(1);

  const checks = {
    documentsUploaded: stats.documentCount > 0,
    documentsProcessed: stats.allProcessed,
    analysisComplete: !!summary,
    hasEnoughChunks: stats.totalChunks >= 10,
    missingInfo: summary?.missingInformation || [],
  };

  // Calculate overall readiness score
  let score = 0;
  if (checks.documentsUploaded) score += 20;
  if (checks.documentsProcessed) score += 30;
  if (checks.analysisComplete) score += 30;
  if (checks.hasEnoughChunks) score += 10;
  if (checks.missingInfo.length === 0) score += 10;
  else if (checks.missingInfo.length <= 2) score += 5;

  return {
    score: Math.min(100, score),
    checks: {
      documentsUploaded: checks.documentsUploaded,
      documentsProcessed: checks.documentsProcessed,
      analysisComplete: checks.analysisComplete,
      missingInfo: checks.missingInfo,
    },
  };
}
