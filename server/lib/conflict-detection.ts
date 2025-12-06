import OpenAI from 'openai';
import { db } from '../db';
import { 
  documentConflicts, 
  conflictDetectionRuns, 
  documents, 
  documentChunks,
  InsertDocumentConflict,
  ConflictType,
  ConflictSeverity
} from '@shared/schema';
import { eq, sql, and, ne } from 'drizzle-orm';

function getOpenAIClient(): OpenAI {
  return new OpenAI();
}

interface ExtractedValue {
  value: string | number;
  type: 'number' | 'percentage' | 'date' | 'currency' | 'duration' | 'quantity';
  unit?: string;
  context: string;
  chunkId: number;
  documentId: number;
  position: number;
}

interface SemanticConflict {
  sourceChunkId: number;
  sourceDocumentId: number;
  sourceText: string;
  targetChunkId: number;
  targetDocumentId: number;
  targetText: string;
  description: string;
  severity: ConflictSeverity;
  confidenceScore: number;
  semanticSimilarity: number;
  suggestedResolution?: string;
}

interface NumericConflict {
  sourceChunkId: number;
  sourceDocumentId: number;
  sourceText: string;
  sourceValue: ExtractedValue;
  targetChunkId: number;
  targetDocumentId: number;
  targetText: string;
  targetValue: ExtractedValue;
  description: string;
  severity: ConflictSeverity;
}

export class ConflictDetectionService {
  private numericPatterns = {
    currency: /\$[\d,]+(?:\.\d{2})?|\d+(?:,\d{3})*(?:\.\d{2})?\s*(?:USD|dollars?|EUR|euros?)/gi,
    percentage: /\d+(?:\.\d+)?%/g,
    date: /\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4}/gi,
    duration: /\d+\s*(?:days?|weeks?|months?|years?|hours?)/gi,
    quantity: /\d+(?:,\d{3})*(?:\.\d+)?\s*(?:units?|items?|pieces?|sq\s*ft|sqft|square\s*feet|cubic\s*(?:feet|yards?)|tons?|lbs?|pounds?|gallons?|liters?)/gi,
    number: /\b\d+(?:,\d{3})*(?:\.\d+)?\b/g,
  };

  async runDetection(projectId: string, options: { 
    detectSemantic?: boolean; 
    detectNumeric?: boolean;
    semanticThreshold?: number;
  } = {}): Promise<{
    runId: number;
    totalConflicts: number;
    semanticConflicts: number;
    numericConflicts: number;
    temporalConflicts: number;
  }> {
    const { 
      detectSemantic = true, 
      detectNumeric = true,
      semanticThreshold = 0.85 
    } = options;

    const [run] = await db.insert(conflictDetectionRuns).values({
      projectId,
      status: 'running',
    }).returning();

    try {
      const projectDocs = await db
        .select()
        .from(documents)
        .where(eq(documents.projectId, projectId));

      if (projectDocs.length === 0) {
        await db.update(conflictDetectionRuns)
          .set({ 
            status: 'completed', 
            completedAt: new Date(),
            totalConflicts: 0 
          })
          .where(eq(conflictDetectionRuns.id, run.id));

        return {
          runId: run.id,
          totalConflicts: 0,
          semanticConflicts: 0,
          numericConflicts: 0,
          temporalConflicts: 0,
        };
      }

      const chunks = await db
        .select({
          id: documentChunks.id,
          documentId: documentChunks.documentId,
          content: documentChunks.content,
          embedding: documentChunks.embedding,
          chunkIndex: documentChunks.chunkIndex,
        })
        .from(documentChunks)
        .innerJoin(documents, eq(documentChunks.documentId, documents.id))
        .where(eq(documents.projectId, projectId));

      let semanticConflicts: SemanticConflict[] = [];
      let numericConflicts: NumericConflict[] = [];
      let temporalConflicts: NumericConflict[] = [];

      if (detectSemantic && chunks.length > 1) {
        semanticConflicts = await this.detectSemanticConflicts(chunks, semanticThreshold);
      }

      if (detectNumeric) {
        const allConflicts = await this.detectNumericConflicts(chunks);
        numericConflicts = allConflicts.filter(c => !c.sourceValue.type.includes('date'));
        temporalConflicts = allConflicts.filter(c => c.sourceValue.type === 'date');
      }

      for (const conflict of semanticConflicts) {
        await db.insert(documentConflicts).values({
          projectId,
          conflictType: 'semantic',
          severity: conflict.severity,
          status: 'detected',
          sourceDocumentId: conflict.sourceDocumentId,
          sourceChunkId: conflict.sourceChunkId,
          sourceText: conflict.sourceText.substring(0, 2000),
          targetDocumentId: conflict.targetDocumentId,
          targetChunkId: conflict.targetChunkId,
          targetText: conflict.targetText.substring(0, 2000),
          description: conflict.description,
          suggestedResolution: conflict.suggestedResolution,
          confidenceScore: conflict.confidenceScore,
          semanticSimilarity: conflict.semanticSimilarity,
        });
      }

      for (const conflict of numericConflicts) {
        await db.insert(documentConflicts).values({
          projectId,
          conflictType: 'numeric',
          severity: conflict.severity,
          status: 'detected',
          sourceDocumentId: conflict.sourceDocumentId,
          sourceChunkId: conflict.sourceChunkId,
          sourceText: conflict.sourceText.substring(0, 2000),
          targetDocumentId: conflict.targetDocumentId,
          targetChunkId: conflict.targetChunkId,
          targetText: conflict.targetText.substring(0, 2000),
          description: conflict.description,
          metadata: {
            sourceValue: conflict.sourceValue,
            targetValue: conflict.targetValue,
          },
        });
      }

      for (const conflict of temporalConflicts) {
        await db.insert(documentConflicts).values({
          projectId,
          conflictType: 'temporal',
          severity: conflict.severity,
          status: 'detected',
          sourceDocumentId: conflict.sourceDocumentId,
          sourceChunkId: conflict.sourceChunkId,
          sourceText: conflict.sourceText.substring(0, 2000),
          targetDocumentId: conflict.targetDocumentId,
          targetChunkId: conflict.targetChunkId,
          targetText: conflict.targetText.substring(0, 2000),
          description: conflict.description,
          metadata: {
            sourceValue: conflict.sourceValue,
            targetValue: conflict.targetValue,
          },
        });
      }

      const totalConflicts = semanticConflicts.length + numericConflicts.length + temporalConflicts.length;

      await db.update(conflictDetectionRuns)
        .set({
          status: 'completed',
          completedAt: new Date(),
          totalConflicts,
          semanticConflicts: semanticConflicts.length,
          numericConflicts: numericConflicts.length,
          temporalConflicts: temporalConflicts.length,
        })
        .where(eq(conflictDetectionRuns.id, run.id));

      return {
        runId: run.id,
        totalConflicts,
        semanticConflicts: semanticConflicts.length,
        numericConflicts: numericConflicts.length,
        temporalConflicts: temporalConflicts.length,
      };

    } catch (error) {
      await db.update(conflictDetectionRuns)
        .set({
          status: 'failed',
          completedAt: new Date(),
          error: (error as Error).message,
        })
        .where(eq(conflictDetectionRuns.id, run.id));

      throw error;
    }
  }

  private async detectSemanticConflicts(
    chunks: Array<{
      id: number;
      documentId: number;
      content: string;
      embedding: unknown;
      chunkIndex: number;
    }>,
    threshold: number
  ): Promise<SemanticConflict[]> {
    const conflicts: SemanticConflict[] = [];
    const chunksWithEmbeddings = chunks.filter(c => c.embedding);

    for (let i = 0; i < chunksWithEmbeddings.length; i++) {
      for (let j = i + 1; j < chunksWithEmbeddings.length; j++) {
        const chunk1 = chunksWithEmbeddings[i];
        const chunk2 = chunksWithEmbeddings[j];

        if (chunk1.documentId === chunk2.documentId) continue;

        const similarity = this.cosineSimilarity(
          chunk1.embedding as number[],
          chunk2.embedding as number[]
        );

        if (similarity >= threshold) {
          const analysisResult = await this.analyzeConflictWithAI(
            chunk1.content,
            chunk2.content
          );

          if (analysisResult.isConflict) {
            conflicts.push({
              sourceChunkId: chunk1.id,
              sourceDocumentId: chunk1.documentId,
              sourceText: chunk1.content,
              targetChunkId: chunk2.id,
              targetDocumentId: chunk2.documentId,
              targetText: chunk2.content,
              description: analysisResult.description,
              severity: analysisResult.severity,
              confidenceScore: analysisResult.confidence,
              semanticSimilarity: similarity,
              suggestedResolution: analysisResult.suggestedResolution,
            });
          }
        }
      }
    }

    return conflicts;
  }

  private async analyzeConflictWithAI(text1: string, text2: string): Promise<{
    isConflict: boolean;
    description: string;
    severity: ConflictSeverity;
    confidence: number;
    suggestedResolution?: string;
  }> {
    try {
      const openai = getOpenAIClient();
      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are an expert document analyst specializing in detecting conflicts and inconsistencies in construction bid documents.

Analyze the two text excerpts and determine if they contain conflicting or contradictory information.

Consider:
- Contradictory statements about scope, requirements, or specifications
- Inconsistent technical specifications
- Conflicting timelines or deadlines
- Contradictory pricing or cost information
- Inconsistent material or equipment specifications

Respond in JSON format:
{
  "isConflict": boolean,
  "description": "Clear description of the conflict",
  "severity": "low" | "medium" | "high" | "critical",
  "confidence": 0.0-1.0,
  "suggestedResolution": "How to resolve this conflict"
}`
          },
          {
            role: 'user',
            content: `Text 1:\n${text1.substring(0, 1500)}\n\nText 2:\n${text2.substring(0, 1500)}`
          }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
      });

      const result = JSON.parse(response.choices[0].message.content || '{}');

      return {
        isConflict: result.isConflict || false,
        description: result.description || 'Unknown conflict',
        severity: result.severity || 'medium',
        confidence: result.confidence || 0.5,
        suggestedResolution: result.suggestedResolution,
      };
    } catch (error) {
      console.error('[ConflictDetection] AI analysis error:', error);
      return {
        isConflict: false,
        description: 'Analysis failed',
        severity: 'low',
        confidence: 0,
      };
    }
  }

  private async detectNumericConflicts(
    chunks: Array<{
      id: number;
      documentId: number;
      content: string;
      chunkIndex: number;
    }>
  ): Promise<NumericConflict[]> {
    const conflicts: NumericConflict[] = [];
    const extractedValues: ExtractedValue[] = [];

    for (const chunk of chunks) {
      const values = this.extractNumericValues(chunk.content, chunk.id, chunk.documentId);
      extractedValues.push(...values);
    }

    const valuesByContext = this.groupValuesByContext(extractedValues);

    for (const [context, values] of Object.entries(valuesByContext)) {
      if (values.length < 2) continue;

      for (let i = 0; i < values.length; i++) {
        for (let j = i + 1; j < values.length; j++) {
          const val1 = values[i];
          const val2 = values[j];

          if (val1.documentId === val2.documentId) continue;
          if (val1.type !== val2.type) continue;

          if (this.valuesConflict(val1, val2)) {
            const sourceChunk = chunks.find(c => c.id === val1.chunkId);
            const targetChunk = chunks.find(c => c.id === val2.chunkId);

            if (!sourceChunk || !targetChunk) continue;

            const severity = this.calculateNumericSeverity(val1, val2);

            conflicts.push({
              sourceChunkId: val1.chunkId,
              sourceDocumentId: val1.documentId,
              sourceText: this.extractSentenceAround(sourceChunk.content, val1.position),
              sourceValue: val1,
              targetChunkId: val2.chunkId,
              targetDocumentId: val2.documentId,
              targetText: this.extractSentenceAround(targetChunk.content, val2.position),
              targetValue: val2,
              description: this.generateNumericConflictDescription(val1, val2, context),
              severity,
            });
          }
        }
      }
    }

    return conflicts;
  }

  private extractNumericValues(text: string, chunkId: number, documentId: number): ExtractedValue[] {
    const values: ExtractedValue[] = [];

    for (const [type, pattern] of Object.entries(this.numericPatterns)) {
      const regex = new RegExp(pattern);
      let match: RegExpExecArray | null;

      while ((match = regex.exec(text)) !== null) {
        if (!match.index) continue;

        const context = this.extractContext(text, match.index);
        const numericValue = this.parseNumericValue(match[0], type as ExtractedValue['type']);

        if (numericValue !== null) {
          values.push({
            value: numericValue,
            type: type as ExtractedValue['type'],
            unit: this.extractUnit(match[0]),
            context,
            chunkId,
            documentId,
            position: match.index,
          });
        }
      }
    }

    return values;
  }

  private extractContext(text: string, position: number): string {
    const sentenceStart = Math.max(0, text.lastIndexOf('.', position) + 1);
    const sentenceEnd = text.indexOf('.', position);
    const sentence = text.substring(
      sentenceStart,
      sentenceEnd > -1 ? sentenceEnd + 1 : text.length
    ).trim();

    const keywords = ['total', 'cost', 'price', 'budget', 'deadline', 'completion', 
                     'duration', 'area', 'quantity', 'material', 'labor', 'equipment',
                     'project', 'phase', 'timeline', 'payment', 'retainage'];

    const foundKeywords = keywords.filter(k => 
      sentence.toLowerCase().includes(k)
    );

    return foundKeywords.join('_') || 'general';
  }

  private parseNumericValue(match: string, type: string): number | string | null {
    if (type === 'date') {
      return match;
    }

    const cleanValue = match.replace(/[$,]/g, '').replace(/[a-zA-Z\s]+$/, '').trim();
    const parsed = parseFloat(cleanValue);

    return isNaN(parsed) ? null : parsed;
  }

  private extractUnit(match: string): string | undefined {
    const unitMatch = match.match(/[a-zA-Z\s]+$/);
    return unitMatch ? unitMatch[0].trim() : undefined;
  }

  private groupValuesByContext(values: ExtractedValue[]): Record<string, ExtractedValue[]> {
    const groups: Record<string, ExtractedValue[]> = {};

    for (const value of values) {
      if (!groups[value.context]) {
        groups[value.context] = [];
      }
      groups[value.context].push(value);
    }

    return groups;
  }

  private valuesConflict(val1: ExtractedValue, val2: ExtractedValue): boolean {
    if (val1.type === 'date' || val2.type === 'date') {
      return val1.value !== val2.value;
    }

    if (typeof val1.value === 'number' && typeof val2.value === 'number') {
      const percentDiff = Math.abs(val1.value - val2.value) / Math.max(val1.value, val2.value);
      return percentDiff > 0.01;
    }

    return val1.value !== val2.value;
  }

  private calculateNumericSeverity(val1: ExtractedValue, val2: ExtractedValue): ConflictSeverity {
    if (val1.type === 'date' || val1.type === 'currency') {
      return 'high';
    }

    if (typeof val1.value === 'number' && typeof val2.value === 'number') {
      const percentDiff = Math.abs(val1.value - val2.value) / Math.max(val1.value, val2.value);

      if (percentDiff > 0.5) return 'critical';
      if (percentDiff > 0.2) return 'high';
      if (percentDiff > 0.05) return 'medium';
      return 'low';
    }

    return 'medium';
  }

  private generateNumericConflictDescription(
    val1: ExtractedValue, 
    val2: ExtractedValue, 
    context: string
  ): string {
    const contextLabel = context.replace(/_/g, ' ');
    
    if (val1.type === 'date') {
      return `Conflicting dates in ${contextLabel}: "${val1.value}" vs "${val2.value}"`;
    }

    if (val1.type === 'currency') {
      return `Conflicting amounts in ${contextLabel}: $${val1.value.toLocaleString()} vs $${val2.value.toLocaleString()}`;
    }

    if (val1.type === 'percentage') {
      return `Conflicting percentages in ${contextLabel}: ${val1.value}% vs ${val2.value}%`;
    }

    return `Conflicting ${val1.type} values in ${contextLabel}: ${val1.value} vs ${val2.value}`;
  }

  private extractSentenceAround(text: string, position: number): string {
    const start = Math.max(0, text.lastIndexOf('.', position - 1) + 1);
    let end = text.indexOf('.', position);
    if (end === -1) end = text.length;

    return text.substring(start, end + 1).trim().substring(0, 500);
  }

  private cosineSimilarity(vec1: number[], vec2: number[]): number {
    if (!vec1 || !vec2 || vec1.length !== vec2.length) return 0;

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i];
      norm1 += vec1[i] * vec1[i];
      norm2 += vec2[i] * vec2[i];
    }

    const magnitude = Math.sqrt(norm1) * Math.sqrt(norm2);
    return magnitude === 0 ? 0 : dotProduct / magnitude;
  }

  async getConflicts(projectId: string, filters?: {
    type?: ConflictType;
    severity?: ConflictSeverity;
    status?: string;
  }): Promise<typeof documentConflicts.$inferSelect[]> {
    let query = db
      .select()
      .from(documentConflicts)
      .where(eq(documentConflicts.projectId, projectId));

    const conditions = [eq(documentConflicts.projectId, projectId)];

    if (filters?.type) {
      conditions.push(eq(documentConflicts.conflictType, filters.type));
    }
    if (filters?.severity) {
      conditions.push(eq(documentConflicts.severity, filters.severity));
    }
    if (filters?.status) {
      conditions.push(eq(documentConflicts.status, filters.status));
    }

    return db
      .select()
      .from(documentConflicts)
      .where(and(...conditions))
      .orderBy(documentConflicts.detectedAt);
  }

  async updateConflictStatus(
    conflictId: number, 
    projectId: string,
    status: string, 
    userId?: number,
    resolution?: string
  ): Promise<typeof documentConflicts.$inferSelect | null> {
    const updateData: Partial<typeof documentConflicts.$inferInsert> = {
      status,
      updatedAt: new Date(),
    };

    if (status === 'resolved' && userId) {
      updateData.resolvedBy = userId;
      updateData.resolvedAt = new Date();
      if (resolution) {
        updateData.resolution = resolution;
      }
    }

    // Only update if conflict belongs to the specified project (multi-tenant security)
    const [updated] = await db
      .update(documentConflicts)
      .set(updateData)
      .where(and(
        eq(documentConflicts.id, conflictId),
        eq(documentConflicts.projectId, projectId)
      ))
      .returning();

    return updated || null;
  }

  async getConflictStats(projectId: string): Promise<{
    total: number;
    byType: Record<string, number>;
    bySeverity: Record<string, number>;
    byStatus: Record<string, number>;
    resolved: number;
    pending: number;
  }> {
    const conflicts = await db
      .select()
      .from(documentConflicts)
      .where(eq(documentConflicts.projectId, projectId));

    const stats = {
      total: conflicts.length,
      byType: {} as Record<string, number>,
      bySeverity: {} as Record<string, number>,
      byStatus: {} as Record<string, number>,
      resolved: 0,
      pending: 0,
    };

    for (const conflict of conflicts) {
      stats.byType[conflict.conflictType] = (stats.byType[conflict.conflictType] || 0) + 1;
      stats.bySeverity[conflict.severity] = (stats.bySeverity[conflict.severity] || 0) + 1;
      stats.byStatus[conflict.status] = (stats.byStatus[conflict.status] || 0) + 1;

      if (conflict.status === 'resolved' || conflict.status === 'dismissed') {
        stats.resolved++;
      } else {
        stats.pending++;
      }
    }

    return stats;
  }
}

export const conflictDetectionService = new ConflictDetectionService();
