import { db } from '../db';
import { documents, documentSummaries, documentChunks, projects } from '@shared/schema';
import { openai } from './openai.js';
import { generateEmbedding } from './openai.js';
import { eq, and, sql } from 'drizzle-orm';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';

export interface SummarizationResult {
  summaryId: number;
  chunksCreated: number;
  processingTimeMs: number;
}

export class DocumentSummarizationService {
  /**
   * Generate comprehensive summary from document content
   * Called automatically during document ingestion
   */
  async summarizeDocument(documentId: number): Promise<SummarizationResult> {
    const startTime = Date.now();
    console.log(`[Summarization] Starting for document ${documentId}`);

    // Get document
    const [doc] = await db
      .select()
      .from(documents)
      .where(eq(documents.id, documentId))
      .limit(1);

    if (!doc || !doc.content) {
      throw new Error(`Document ${documentId} not found or has no content`);
    }

    // Skip if content is too short
    if (doc.content.trim().length < 100) {
      console.log(`[Summarization] Skipping document ${documentId}: insufficient content`);
      return {
        summaryId: 0,
        chunksCreated: 0,
        processingTimeMs: Date.now() - startTime,
      };
    }

    // Fetch project description for context
    const [project] = await db
      .select({ description: projects.description, name: projects.name })
      .from(projects)
      .where(eq(projects.id, doc.projectId))
      .limit(1);

    const projectContext = project ? {
      name: project.name,
      description: project.description || '',
    } : null;

    // Generate comprehensive summary using LLM
    const summaryData = await this.extractComprehensiveInfo(
      doc.content,
      doc.filename,
      projectContext
    );

    // Store summary in database
    const [summary] = await db
      .insert(documentSummaries)
      .values({
        documentId: doc.id,
        projectId: doc.projectId,
        summaryContent: summaryData.summaryContent,
        structuredData: summaryData.structuredData,
        extractionConfidence: summaryData.confidence,
        processingTimeMs: Date.now() - startTime,
      })
      .returning();

    console.log(`[Summarization] Generated summary ${summary.id} for document ${documentId}`);

    // Create summary chunks with embeddings
    const chunksCreated = await this.createSummaryChunks(
      doc.id,
      summaryData.summaryContent
    );

    const totalTime = Date.now() - startTime;
    console.log(`[Summarization] Completed for document ${documentId}: ${chunksCreated} chunks in ${totalTime}ms`);

    return {
      summaryId: summary.id,
      chunksCreated,
      processingTimeMs: totalTime,
    };
  }

  /**
   * Extract comprehensive information using LLM (GPT-4o) with retry logic
   */
  private async extractComprehensiveInfo(
    content: string,
    filename: string,
    projectContext: { name: string; description: string } | null,
    retries = 2
  ): Promise<{
    summaryContent: string;
    structuredData: any;
    confidence: number;
  }> {
    // Truncate content to fit within token limits
    const truncatedContent = content.substring(0, 20000);
    const isTruncated = content.length > 20000;

    // Build project context section
    const projectContextSection = projectContext && projectContext.description
      ? `## Project Context (Use this to understand the bid we are preparing)
Project Name: ${projectContext.name}
Project Description: ${projectContext.description}

Use this project context to better understand the purpose of this document and how it relates to the overall bid. Extract information that is most relevant to preparing a winning bid proposal.

---

`
      : '';

    const prompt = `You are an expert at analyzing construction/tender documents. Extract comprehensive information from this document.

${projectContextSection}Document: ${filename}
${isTruncated ? '[Content truncated to 20,000 characters]' : ''}
Content:
${truncatedContent}

Extract and structure the following information, keeping the project context in mind:

1. **Requirements**: All project requirements (technical, legal, administrative)
2. **Specifications**: Technical specifications, standards, codes
3. **Quantities**: Measurements, quantities, dimensions, areas, volumes
4. **Materials**: Materials specified with grades/standards
5. **Budget**: Cost estimates, budget ranges, payment terms
6. **Timeline**: Deadlines, milestones, project duration, submission dates
7. **Constraints**: Special conditions, restrictions, limitations

Create a comprehensive Markdown-formatted summary with clear structure:
- Use ## for main section headers
- Use ### for subsection headers
- Use - for bullet point lists
- Use markdown tables (| header | header |) for tabular data (quantities, materials, timeline)
- Use regular text for paragraphs
- Use **bold** for emphasis on key values

The summary MUST include these sections with proper Markdown:
1. ## Project Overview - Brief introduction paragraph that aligns with the project context
2. ## Scope of Work - Bulleted list of key deliverables
3. ## Key Requirements - Technical, legal, administrative requirements as bullets
4. ## Materials & Quantities - Table format if quantities exist, otherwise bullets
5. ## Timeline & Deadlines - Key dates and milestones
6. ## Budget & Cost - Cost information if available
7. ## Constraints & Risks - Any limitations or special conditions

Return JSON with this structure:
{
  "summaryContent": "## Project Overview\n\nBrief description...\n\n## Scope of Work\n\n- Item 1\n- Item 2\n...",
  "structuredData": {
    "requirements": [{"type": "technical|legal|admin", "description": "...", "priority": "high|medium|low"}],
    "specifications": {"category": "details", ...},
    "quantities": [{"item": "...", "quantity": "...", "unit": "..."}],
    "materials": [{"name": "...", "specification": "...", "quantity": "..."}],
    "budgetInfo": {"estimated": "...", "breakdown": {...}},
    "timeline": {"deadlines": [{"date": "...", "milestone": "..."}], "duration": "..."},
    "constraints": ["constraint1", "constraint2", ...]
  },
  "confidence": 0.85
}

IMPORTANT:
- The summaryContent MUST be valid Markdown format (not HTML)
- Only extract information explicitly stated in the document
- Use professional construction industry terminology
- Be comprehensive but accurate
- Align the summary with the project context when available
- Set confidence based on clarity of information (0.0-1.0)`;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const response = await openai.chat.completions.create({
          model: 'gpt-4o',
          messages: [{ role: 'user', content: prompt }],
          response_format: { type: 'json_object' },
          temperature: 0.2, // Low temperature for consistent extraction
        });

        const parsed = JSON.parse(response.choices[0].message.content || '{}');

        return {
          summaryContent: parsed.summaryContent || 'No summary generated',
          structuredData: parsed.structuredData || {},
          confidence: parsed.confidence || 0.5,
        };
      } catch (error) {
        if (attempt === retries) {
          // Final attempt failed, return fallback
          console.error(`[Summarization] LLM extraction failed after ${retries + 1} attempts:`, error);
          return {
            summaryContent: `Summary generation failed for ${filename}. Document contains ${content.length} characters but automatic extraction encountered an error.`,
            structuredData: {},
            confidence: 0.1,
          };
        }
        console.warn(`[Summarization] LLM attempt ${attempt + 1} failed, retrying...`);
        // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
      }
    }

    // Fallback (should never reach here)
    return {
      summaryContent: `Summary generation failed for ${filename}`,
      structuredData: {},
      confidence: 0.1,
    };
  }

  /**
   * Create summary chunks and embeddings
   */
  private async createSummaryChunks(
    documentId: number,
    summaryText: string
  ): Promise<number> {
    // Chunk the summary text
    const chunks = await this.chunkSummary(summaryText);

    console.log(`[Summarization] Creating ${chunks.length} summary chunks for document ${documentId}`);

    // Generate embeddings and insert chunks
    for (let i = 0; i < chunks.length; i++) {
      try {
        const embedding = await generateEmbedding(chunks[i]);
        const embeddingStr = `[${embedding.join(',')}]`;

        await db.insert(documentChunks).values({
          documentId,
          content: chunks[i],
          chunkIndex: i,
          embedding: sql`${embeddingStr}::vector`,
          sourceType: 'summary',
        });
      } catch (error) {
        console.error(`[Summarization] Failed to create chunk ${i}:`, error);
        // Continue with next chunk
      }
    }

    return chunks.length;
  }

  /**
   * Chunk summary text using semantic splitter
   */
  private async chunkSummary(summaryText: string): Promise<string[]> {
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1500, // Smaller chunks for summaries
      chunkOverlap: 150,
      separators: ['\n\n', '\n', '. ', '! ', '? ', '; ', ', ', ' ', ''],
    });

    const chunks = await splitter.splitText(summaryText);
    return chunks.filter(chunk => chunk.trim().length > 50);
  }

  /**
   * Update existing summary (when user edits in UI)
   * This regenerates summary chunks in the RAG system
   */
  async updateSummary(
    summaryId: number,
    updates: {
      summaryContent?: string;
      structuredData?: any;
    }
  ): Promise<void> {
    console.log(`[Summarization] Updating summary ${summaryId}`);

    // Update summary record
    const [updated] = await db
      .update(documentSummaries)
      .set({
        ...updates,
        isUserEdited: true,
        updatedAt: new Date(),
      })
      .where(eq(documentSummaries.id, summaryId))
      .returning();

    if (!updated) {
      throw new Error('Summary not found');
    }

    // Delete old summary chunks
    await db
      .delete(documentChunks)
      .where(
        and(
          eq(documentChunks.documentId, updated.documentId),
          eq(documentChunks.sourceType, 'summary')
        )
      );

    console.log(`[Summarization] Deleted old summary chunks for document ${updated.documentId}`);

    // Re-create chunks with new content if provided
    if (updates.summaryContent) {
      const chunksCreated = await this.createSummaryChunks(
        updated.documentId,
        updates.summaryContent
      );

      console.log(`[Summarization] Regenerated ${chunksCreated} summary chunks`);
    }
  }

  /**
   * Get summary for a document
   */
  async getSummary(documentId: number) {
    const [summary] = await db
      .select()
      .from(documentSummaries)
      .where(eq(documentSummaries.documentId, documentId))
      .limit(1);

    return summary || null;
  }

  /**
   * Get all summaries for a project
   */
  async getProjectSummaries(projectId: string) {
    return await db
      .select()
      .from(documentSummaries)
      .where(eq(documentSummaries.projectId, projectId));
  }
}

export const documentSummarizationService = new DocumentSummarizationService();
