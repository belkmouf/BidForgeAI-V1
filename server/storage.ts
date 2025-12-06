import { 
  projects, 
  documents, 
  documentChunks,
  rfpAnalyses,
  analysisAlerts,
  vendorDatabase,
  type Project, 
  type InsertProject,
  type Document,
  type InsertDocument,
  type DocumentChunk,
  type InsertDocumentChunk,
  type ProjectStatus,
  type RFPAnalysis,
  type InsertRFPAnalysis,
  type AnalysisAlert,
  type InsertAnalysisAlert,
  type Vendor,
  type InsertVendor
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, sql } from "drizzle-orm";

export interface IStorage {
  // Projects
  createProject(project: InsertProject): Promise<Project>;
  getProject(id: string): Promise<Project | undefined>;
  listProjects(): Promise<Project[]>;
  updateProjectStatus(id: string, status: ProjectStatus): Promise<Project | undefined>;
  
  // Documents
  createDocument(document: InsertDocument): Promise<Document>;
  getDocument(id: number): Promise<Document | undefined>;
  listDocumentsByProject(projectId: string): Promise<Document[]>;
  updateDocumentProcessed(id: number, isProcessed: boolean): Promise<void>;
  deleteDocument(id: number): Promise<boolean>;
  
  // Document Chunks
  createDocumentChunk(chunk: InsertDocumentChunk): Promise<DocumentChunk>;
  searchSimilarChunks(embedding: number[], projectId: string, limit: number): Promise<Array<DocumentChunk & { distance: number }>>;
  searchChunksByKeywords(query: string, projectId: string, limit: number): Promise<Array<DocumentChunk & { rank: number }>>;
  
  // Dashboard Stats
  getDashboardStats(): Promise<{
    pipeline: Record<string, number>;
    winRate: number;
    totalProjects: number;
  }>;
  
  // RFP Analysis
  getAnalysisByProject(projectId: string): Promise<RFPAnalysis | undefined>;
  createOrUpdateAnalysis(projectId: string, data: Partial<InsertRFPAnalysis>): Promise<RFPAnalysis>;
  
  // Analysis Alerts
  getAlertsByAnalysis(analysisId: number): Promise<AnalysisAlert[]>;
  createAlert(alert: InsertAnalysisAlert): Promise<AnalysisAlert>;
  resolveAlert(alertId: number): Promise<AnalysisAlert>;
  deleteAlertsByAnalysis(analysisId: number): Promise<void>;
  
  // Vendor Database
  getVendorByName(name: string): Promise<Vendor | undefined>;
  listVendors(): Promise<Vendor[]>;
  upsertVendor(data: Omit<InsertVendor, 'lastUpdated'>): Promise<Vendor>;
  countVendors(): Promise<number>;
  
  // Analysis Helpers
  getDocumentChunksForProject(projectId: string, limit?: number): Promise<Array<{ content: string; filename: string }>>;
}

export class DatabaseStorage implements IStorage {
  // Projects
  async createProject(insertProject: InsertProject): Promise<Project> {
    const [project] = await db
      .insert(projects)
      .values(insertProject)
      .returning();
    return project;
  }

  async getProject(id: string): Promise<Project | undefined> {
    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, id));
    return project || undefined;
  }

  async listProjects(): Promise<Project[]> {
    return await db
      .select()
      .from(projects)
      .orderBy(desc(projects.createdAt));
  }

  async updateProjectStatus(id: string, status: ProjectStatus): Promise<Project | undefined> {
    const [project] = await db
      .update(projects)
      .set({ status })
      .where(eq(projects.id, id))
      .returning();
    return project || undefined;
  }

  // Documents
  async createDocument(insertDocument: InsertDocument): Promise<Document> {
    const [document] = await db
      .insert(documents)
      .values(insertDocument as typeof documents.$inferInsert)
      .returning();
    return document;
  }

  async getDocument(id: number): Promise<Document | undefined> {
    const [document] = await db
      .select()
      .from(documents)
      .where(eq(documents.id, id));
    return document || undefined;
  }

  async listDocumentsByProject(projectId: string): Promise<Document[]> {
    return await db
      .select()
      .from(documents)
      .where(eq(documents.projectId, projectId))
      .orderBy(desc(documents.uploadedAt));
  }

  async updateDocumentProcessed(id: number, isProcessed: boolean): Promise<void> {
    await db
      .update(documents)
      .set({ isProcessed })
      .where(eq(documents.id, id));
  }

  async deleteDocument(id: number): Promise<boolean> {
    // First delete associated chunks (cascade should handle this, but being explicit)
    await db
      .delete(documentChunks)
      .where(eq(documentChunks.documentId, id));
    
    // Then delete the document
    const result = await db
      .delete(documents)
      .where(eq(documents.id, id))
      .returning();
    
    return result.length > 0;
  }

  // Document Chunks
  async createDocumentChunk(insertChunk: InsertDocumentChunk): Promise<DocumentChunk> {
    const [chunk] = await db
      .insert(documentChunks)
      .values(insertChunk as typeof documentChunks.$inferInsert)
      .returning();
    return chunk;
  }

  async searchSimilarChunks(
    embedding: number[], 
    projectId: string, 
    limit: number = 10
  ): Promise<Array<DocumentChunk & { distance: number }>> {
    // Convert embedding array to string format for pgvector
    const embeddingStr = `[${embedding.join(',')}]`;
    
    // Search chunks from current project AND "Closed-Won" projects
    const results = await db.execute(sql`
      SELECT 
        dc.id,
        dc.document_id,
        dc.content,
        dc.embedding,
        dc.chunk_index,
        dc.embedding <=> ${embeddingStr}::vector AS distance
      FROM document_chunks dc
      JOIN documents d ON dc.document_id = d.id
      JOIN projects p ON d.project_id = p.id
      WHERE (
        p.id = ${projectId}
        OR
        p.status = 'Closed-Won'
      )
      ORDER BY distance ASC
      LIMIT ${limit}
    `);

    return results.rows.map((row: any) => ({
      id: row.id,
      documentId: row.document_id,
      content: row.content,
      embedding: row.embedding,
      chunkIndex: row.chunk_index,
      distance: parseFloat(row.distance),
    }));
  }

  async searchChunksByKeywords(
    query: string, 
    projectId: string, 
    limit: number = 10
  ): Promise<Array<DocumentChunk & { rank: number }>> {
    // Extract keywords from query (simple word extraction)
    const keywords = query
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2);

    if (keywords.length === 0) {
      // If no valid keywords, return recent chunks from the project
      const results = await db.execute(sql`
        SELECT 
          dc.id,
          dc.document_id,
          dc.content,
          dc.chunk_index,
          0 as rank
        FROM document_chunks dc
        JOIN documents d ON dc.document_id = d.id
        JOIN projects p ON d.project_id = p.id
        WHERE (
          p.id = ${projectId}
          OR
          p.status = 'Closed-Won'
        )
        ORDER BY dc.id DESC
        LIMIT ${limit}
      `);

      return results.rows.map((row: any) => ({
        id: row.id,
        documentId: row.document_id,
        content: row.content,
        embedding: null,
        chunkIndex: row.chunk_index,
        rank: 0,
      }));
    }

    // Build a pattern for case-insensitive keyword matching
    const keywordPattern = keywords.join('|');
    
    // Search chunks using ILIKE for keyword matching
    const results = await db.execute(sql`
      SELECT 
        dc.id,
        dc.document_id,
        dc.content,
        dc.chunk_index,
        (
          SELECT COUNT(*) 
          FROM unnest(string_to_array(lower(dc.content), ' ')) word
          WHERE word ~ ${keywordPattern}
        ) as rank
      FROM document_chunks dc
      JOIN documents d ON dc.document_id = d.id
      JOIN projects p ON d.project_id = p.id
      WHERE (
        p.id = ${projectId}
        OR
        p.status = 'Closed-Won'
      )
      AND lower(dc.content) ~ ${keywordPattern}
      ORDER BY rank DESC, dc.id DESC
      LIMIT ${limit}
    `);

    return results.rows.map((row: any) => ({
      id: row.id,
      documentId: row.document_id,
      content: row.content,
      embedding: null,
      chunkIndex: row.chunk_index,
      rank: parseInt(row.rank) || 0,
    }));
  }

  // Dashboard Stats
  async getDashboardStats(): Promise<{
    pipeline: Record<string, number>;
    winRate: number;
    totalProjects: number;
  }> {
    // Get project counts by status
    const statusCounts = await db
      .select({
        status: projects.status,
        count: sql<number>`count(*)::int`,
      })
      .from(projects)
      .groupBy(projects.status);

    const pipeline: Record<string, number> = {
      "Active": 0,
      "Submitted": 0,
      "Closed-Won": 0,
      "Closed-Lost": 0,
    };

    let totalProjects = 0;
    for (const row of statusCounts) {
      pipeline[row.status] = row.count;
      totalProjects += row.count;
    }

    // Calculate win rate
    const closedWon = pipeline["Closed-Won"];
    const closedLost = pipeline["Closed-Lost"];
    const totalClosed = closedWon + closedLost;
    const winRate = totalClosed > 0 ? (closedWon / totalClosed) * 100 : 0;

    return {
      pipeline,
      winRate: Math.round(winRate * 10) / 10,
      totalProjects,
    };
  }

  // RFP Analysis
  async getAnalysisByProject(projectId: string): Promise<RFPAnalysis | undefined> {
    const [analysis] = await db
      .select()
      .from(rfpAnalyses)
      .where(eq(rfpAnalyses.projectId, projectId))
      .orderBy(desc(rfpAnalyses.analyzedAt))
      .limit(1);
    return analysis || undefined;
  }

  async createOrUpdateAnalysis(projectId: string, data: Partial<InsertRFPAnalysis>): Promise<RFPAnalysis> {
    const existing = await this.getAnalysisByProject(projectId);
    
    if (existing) {
      const [updated] = await db
        .update(rfpAnalyses)
        .set({ ...data, analyzedAt: new Date() })
        .where(eq(rfpAnalyses.id, existing.id))
        .returning();
      return updated;
    } else {
      const [inserted] = await db
        .insert(rfpAnalyses)
        .values({ ...data, projectId } as InsertRFPAnalysis)
        .returning();
      return inserted;
    }
  }

  // Analysis Alerts
  async getAlertsByAnalysis(analysisId: number): Promise<AnalysisAlert[]> {
    return await db
      .select()
      .from(analysisAlerts)
      .where(eq(analysisAlerts.analysisId, analysisId));
  }

  async createAlert(alert: InsertAnalysisAlert): Promise<AnalysisAlert> {
    const [created] = await db
      .insert(analysisAlerts)
      .values(alert)
      .returning();
    return created;
  }

  async resolveAlert(alertId: number): Promise<AnalysisAlert> {
    const [updated] = await db
      .update(analysisAlerts)
      .set({ isResolved: true })
      .where(eq(analysisAlerts.id, alertId))
      .returning();
    return updated;
  }

  async deleteAlertsByAnalysis(analysisId: number): Promise<void> {
    await db
      .delete(analysisAlerts)
      .where(eq(analysisAlerts.analysisId, analysisId));
  }

  // Vendor Database
  async getVendorByName(name: string): Promise<Vendor | undefined> {
    const cleanName = name.trim().toLowerCase();
    const [vendor] = await db
      .select()
      .from(vendorDatabase)
      .where(sql`LOWER(vendor_name) LIKE ${'%' + cleanName + '%'}`)
      .limit(1);
    return vendor || undefined;
  }

  async listVendors(): Promise<Vendor[]> {
    return await db.select().from(vendorDatabase);
  }

  async upsertVendor(data: Omit<InsertVendor, 'lastUpdated'>): Promise<Vendor> {
    const existing = await db
      .select()
      .from(vendorDatabase)
      .where(eq(vendorDatabase.vendorName, data.vendorName))
      .limit(1);
    
    if (existing.length > 0) {
      const [updated] = await db
        .update(vendorDatabase)
        .set({ ...data, lastUpdated: new Date() })
        .where(eq(vendorDatabase.id, existing[0].id))
        .returning();
      return updated;
    } else {
      const [inserted] = await db
        .insert(vendorDatabase)
        .values({ ...data, lastUpdated: new Date() } as InsertVendor)
        .returning();
      return inserted;
    }
  }

  async countVendors(): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(vendorDatabase);
    return result[0]?.count || 0;
  }

  // Analysis Helpers
  async getDocumentChunksForProject(projectId: string, limit: number = 50): Promise<Array<{ content: string; filename: string }>> {
    const results = await db
      .select({
        content: documentChunks.content,
        filename: documents.filename,
      })
      .from(documentChunks)
      .innerJoin(documents, eq(documentChunks.documentId, documents.id))
      .where(eq(documents.projectId, projectId))
      .orderBy(documentChunks.documentId, documentChunks.chunkIndex)
      .limit(limit);
    
    return results;
  }
}

export const storage = new DatabaseStorage();
