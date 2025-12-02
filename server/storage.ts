import { 
  projects, 
  documents, 
  documentChunks,
  type Project, 
  type InsertProject,
  type Document,
  type InsertDocument,
  type DocumentChunk,
  type InsertDocumentChunk,
  type ProjectStatus
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
  
  // Document Chunks
  createDocumentChunk(chunk: InsertDocumentChunk): Promise<DocumentChunk>;
  searchSimilarChunks(embedding: number[], projectId: string, limit: number): Promise<Array<DocumentChunk & { distance: number }>>;
  
  // Dashboard Stats
  getDashboardStats(): Promise<{
    pipeline: Record<string, number>;
    winRate: number;
    totalProjects: number;
  }>;
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
}

export const storage = new DatabaseStorage();
