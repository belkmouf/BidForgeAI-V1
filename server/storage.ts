import { 
  projects, 
  documents, 
  documentChunks,
  bids,
  rfpAnalyses,
  analysisAlerts,
  vendorDatabase,
  decisionLogs,
  users,
  companies,
  companyInvites,
  type Project, 
  type InsertProject,
  type Document,
  type InsertDocument,
  type DocumentChunk,
  type InsertDocumentChunk,
  type Bid,
  type InsertBid,
  type ProjectStatus,
  type RFPAnalysis,
  type InsertRFPAnalysis,
  type AnalysisAlert,
  type InsertAnalysisAlert,
  type Vendor,
  type InsertVendor,
  type DecisionLogRecord,
  type InsertDecisionLog,
  type User,
  type Company,
  type CompanyInvite,
  type UserRole,
  type BrandingProfile
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, sql, and, isNull, or } from "drizzle-orm";

export interface IStorage {
  // Projects (company-scoped)
  createProject(project: InsertProject, companyId: number | null): Promise<Project>;
  getProject(id: string, companyId: number | null): Promise<Project | undefined>;
  listProjects(companyId: number | null): Promise<Project[]>;
  updateProjectStatus(id: string, status: ProjectStatus, companyId: number | null): Promise<Project | undefined>;
  
  // Documents
  createDocument(document: InsertDocument): Promise<Document>;
  getDocument(id: number, companyId: number | null): Promise<Document | undefined>;
  listDocumentsByProject(projectId: string): Promise<Document[]>;
  updateDocumentProcessed(id: number, isProcessed: boolean): Promise<void>;
  deleteDocument(id: number, companyId: number | null): Promise<boolean>;
  
  // Document Chunks (company-scoped RAG)
  createDocumentChunk(chunk: InsertDocumentChunk): Promise<DocumentChunk>;
  searchSimilarChunks(embedding: number[], projectId: string, companyId: number | null, limit: number): Promise<Array<DocumentChunk & { distance: number }>>;
  searchChunksByKeywords(query: string, projectId: string, companyId: number | null, limit: number): Promise<Array<DocumentChunk & { rank: number }>>;
  searchHybrid(
    query: string, 
    embedding: number[], 
    projectId: string, 
    companyId: number | null, 
    limit: number,
    options?: { vectorWeight?: number; textWeight?: number }
  ): Promise<Array<DocumentChunk & { score: number; vectorScore: number; textScore: number }>>;
  
  // Dashboard Stats (company-scoped)
  getDashboardStats(companyId: number | null): Promise<{
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
  
  // Vendor Database (global - not company-scoped)
  getVendorByName(name: string): Promise<Vendor | undefined>;
  listVendors(): Promise<Vendor[]>;
  upsertVendor(data: Omit<InsertVendor, 'lastUpdated'>): Promise<Vendor>;
  countVendors(): Promise<number>;
  
  // Analysis Helpers
  getDocumentChunksForProject(projectId: string, limit?: number): Promise<Array<{ content: string; filename: string }>>;
  
  // Bids (company-scoped)
  createBid(bid: InsertBid): Promise<Bid>;
  getBid(id: number, companyId: number | null): Promise<Bid | undefined>;
  listBidsByProject(projectId: string, companyId: number | null): Promise<Bid[]>;
  getLatestBidForProject(projectId: string, companyId: number | null): Promise<Bid | undefined>;
  
  // Onboarding
  completeOnboarding(userId: number, brandingProfile: BrandingProfile): Promise<User | undefined>;
  getUserOnboardingStatus(userId: number): Promise<{ status: string; brandingProfile: BrandingProfile | null } | undefined>;
}

export class DatabaseStorage implements IStorage {
  // Helper to build company filter condition
  private companyFilter(companyId: number | null) {
    return companyId !== null 
      ? eq(projects.companyId, companyId)
      : isNull(projects.companyId);
  }

  // Projects (company-scoped)
  async createProject(insertProject: InsertProject, companyId: number | null): Promise<Project> {
    const [project] = await db
      .insert(projects)
      .values({ ...insertProject, companyId })
      .returning();
    return project;
  }

  async getProject(id: string, companyId: number | null): Promise<Project | undefined> {
    const [project] = await db
      .select()
      .from(projects)
      .where(and(
        eq(projects.id, id),
        this.companyFilter(companyId)
      ));
    return project || undefined;
  }

  async listProjects(companyId: number | null): Promise<Project[]> {
    return await db
      .select()
      .from(projects)
      .where(this.companyFilter(companyId))
      .orderBy(desc(projects.createdAt));
  }

  async updateProjectStatus(id: string, status: ProjectStatus, companyId: number | null): Promise<Project | undefined> {
    const [project] = await db
      .update(projects)
      .set({ status })
      .where(and(
        eq(projects.id, id),
        this.companyFilter(companyId)
      ))
      .returning();
    return project || undefined;
  }

  // Documents (company access verified through project ownership)
  async createDocument(insertDocument: InsertDocument): Promise<Document> {
    const [document] = await db
      .insert(documents)
      .values(insertDocument as typeof documents.$inferInsert)
      .returning();
    return document;
  }

  async getDocument(id: number, companyId: number | null): Promise<Document | undefined> {
    // Verify document belongs to a project owned by this company
    const [document] = await db
      .select({ document: documents })
      .from(documents)
      .innerJoin(projects, eq(documents.projectId, projects.id))
      .where(and(
        eq(documents.id, id),
        this.companyFilter(companyId)
      ));
    return document?.document || undefined;
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

  async deleteDocument(id: number, companyId: number | null): Promise<boolean> {
    // First verify document belongs to this company's project
    const doc = await this.getDocument(id, companyId);
    if (!doc) {
      return false;
    }
    
    // Delete associated chunks (cascade should handle this, but being explicit)
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

  // Document Chunks (company-scoped RAG)
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
    companyId: number | null,
    limit: number = 10
  ): Promise<Array<DocumentChunk & { distance: number }>> {
    // Convert embedding array to string format for pgvector
    const embeddingStr = `[${embedding.join(',')}]`;
    
    // Search chunks from current project AND "Closed-Won" projects WITHIN THE SAME COMPANY
    // This ensures complete data isolation between tenants
    const companyCondition = companyId !== null 
      ? sql`p.company_id = ${companyId}`
      : sql`p.company_id IS NULL`;
    
    const results = await db.execute(sql`
      SELECT 
        dc.id,
        dc.document_id,
        dc.content,
        dc.embedding,
        dc.chunk_index,
        dc.company_id,
        dc.embedding <=> ${embeddingStr}::vector AS distance
      FROM document_chunks dc
      JOIN documents d ON dc.document_id = d.id
      JOIN projects p ON d.project_id = p.id
      WHERE ${companyCondition}
        AND (
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
      companyId: row.company_id,
      distance: parseFloat(row.distance),
    }));
  }

  async searchChunksByKeywords(
    query: string, 
    projectId: string, 
    companyId: number | null,
    limit: number = 10
  ): Promise<Array<DocumentChunk & { rank: number }>> {
    // Extract keywords from query (simple word extraction)
    const keywords = query
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2);

    // Build company condition for tenant isolation
    const companyCondition = companyId !== null 
      ? sql`p.company_id = ${companyId}`
      : sql`p.company_id IS NULL`;

    if (keywords.length === 0) {
      // If no valid keywords, return recent chunks from the project (company-scoped)
      const results = await db.execute(sql`
        SELECT 
          dc.id,
          dc.document_id,
          dc.content,
          dc.chunk_index,
          dc.company_id,
          0 as rank
        FROM document_chunks dc
        JOIN documents d ON dc.document_id = d.id
        JOIN projects p ON d.project_id = p.id
        WHERE ${companyCondition}
          AND (
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
        companyId: row.company_id,
        rank: 0,
      }));
    }

    // Build a pattern for case-insensitive keyword matching
    const keywordPattern = keywords.join('|');
    
    // Search chunks using ILIKE for keyword matching (company-scoped)
    const results = await db.execute(sql`
      SELECT 
        dc.id,
        dc.document_id,
        dc.content,
        dc.chunk_index,
        dc.company_id,
        (
          SELECT COUNT(*) 
          FROM unnest(string_to_array(lower(dc.content), ' ')) word
          WHERE word ~ ${keywordPattern}
        ) as rank
      FROM document_chunks dc
      JOIN documents d ON dc.document_id = d.id
      JOIN projects p ON d.project_id = p.id
      WHERE ${companyCondition}
        AND (
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
      companyId: row.company_id,
      rank: parseInt(row.rank) || 0,
    }));
  }

  async searchHybrid(
    query: string,
    embedding: number[],
    projectId: string,
    companyId: number | null,
    limit: number = 10,
    options: { vectorWeight?: number; textWeight?: number } = {}
  ): Promise<Array<DocumentChunk & { score: number; vectorScore: number; textScore: number }>> {
    const vectorWeight = options.vectorWeight ?? 0.7;
    const textWeight = options.textWeight ?? 0.3;
    
    const embeddingStr = `[${embedding.join(',')}]`;
    
    const sanitizedQuery = query
      .replace(/[^\w\s]/g, ' ')
      .trim();
    
    const companyCondition = companyId !== null 
      ? sql`p.company_id = ${companyId}`
      : sql`p.company_id IS NULL`;
    
    const results = await db.execute(sql`
      WITH vector_search AS (
        SELECT 
          dc.id,
          dc.document_id,
          dc.content,
          dc.chunk_index,
          dc.company_id,
          GREATEST(0, LEAST(1, 1 - (dc.embedding <=> ${embeddingStr}::vector))) AS vector_score
        FROM document_chunks dc
        JOIN documents d ON dc.document_id = d.id
        JOIN projects p ON d.project_id = p.id
        WHERE ${companyCondition}
          AND (p.id = ${projectId} OR p.status = 'Closed-Won')
          AND dc.embedding IS NOT NULL
      ),
      text_search AS (
        SELECT 
          dc.id,
          CASE 
            WHEN ${sanitizedQuery} = '' THEN 0
            ELSE LEAST(1, GREATEST(0, ts_rank_cd(to_tsvector('english', dc.content), plainto_tsquery('english', ${sanitizedQuery}))))
          END AS text_score
        FROM document_chunks dc
        JOIN documents d ON dc.document_id = d.id
        JOIN projects p ON d.project_id = p.id
        WHERE ${companyCondition}
          AND (p.id = ${projectId} OR p.status = 'Closed-Won')
      )
      SELECT 
        vs.id,
        vs.document_id,
        vs.content,
        vs.chunk_index,
        vs.company_id,
        vs.vector_score,
        COALESCE(ts.text_score, 0) AS text_score,
        GREATEST(0, vs.vector_score * ${vectorWeight} + COALESCE(ts.text_score, 0) * ${textWeight}) AS combined_score
      FROM vector_search vs
      LEFT JOIN text_search ts ON vs.id = ts.id
      ORDER BY combined_score DESC
      LIMIT ${limit}
    `);

    return results.rows.map((row: any) => ({
      id: row.id,
      documentId: row.document_id,
      content: row.content,
      embedding: null,
      chunkIndex: row.chunk_index,
      companyId: row.company_id,
      score: parseFloat(row.combined_score) || 0,
      vectorScore: parseFloat(row.vector_score) || 0,
      textScore: parseFloat(row.text_score) || 0,
    }));
  }

  // Dashboard Stats (company-scoped)
  async getDashboardStats(companyId: number | null): Promise<{
    pipeline: Record<string, number>;
    winRate: number;
    totalProjects: number;
  }> {
    // Get project counts by status for this company only
    const statusCounts = await db
      .select({
        status: projects.status,
        count: sql<number>`count(*)::int`,
      })
      .from(projects)
      .where(this.companyFilter(companyId))
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

  // Decision Logs
  async createDecisionLog(data: InsertDecisionLog): Promise<DecisionLogRecord> {
    const [log] = await db
      .insert(decisionLogs)
      .values(data)
      .returning();
    return log;
  }

  async getDecisionLogByProject(projectId: string, companyId: number | null): Promise<DecisionLogRecord | undefined> {
    const conditions = [eq(decisionLogs.projectId, projectId)];
    if (companyId !== null) {
      conditions.push(eq(decisionLogs.companyId, companyId));
    } else {
      conditions.push(isNull(decisionLogs.companyId));
    }
    
    const [log] = await db
      .select()
      .from(decisionLogs)
      .where(and(...conditions))
      .orderBy(desc(decisionLogs.createdAt))
      .limit(1);
    return log || undefined;
  }

  async getDecisionLogHistory(projectId: string, companyId: number | null): Promise<DecisionLogRecord[]> {
    const conditions = [eq(decisionLogs.projectId, projectId)];
    if (companyId !== null) {
      conditions.push(eq(decisionLogs.companyId, companyId));
    } else {
      conditions.push(isNull(decisionLogs.companyId));
    }
    
    return await db
      .select()
      .from(decisionLogs)
      .where(and(...conditions))
      .orderBy(desc(decisionLogs.createdAt));
  }

  // Bids - uses transaction for atomic version increment and isLatest management
  async createBid(bid: InsertBid): Promise<Bid> {
    return await db.transaction(async (tx) => {
      // Mark any existing bids for this project as not latest
      if (bid.projectId) {
        await tx
          .update(bids)
          .set({ isLatest: false })
          .where(eq(bids.projectId, bid.projectId));
      }
      
      // Get the next version number within the transaction
      const existingBids = await tx
        .select({ maxVersion: sql<number>`COALESCE(MAX(${bids.version}), 0)` })
        .from(bids)
        .where(eq(bids.projectId, bid.projectId));
      
      const nextVersion = (existingBids[0]?.maxVersion || 0) + 1;
      
      const [created] = await tx
        .insert(bids)
        .values({ ...bid, version: nextVersion, isLatest: true })
        .returning();
      return created;
    });
  }

  async getBid(id: number, companyId: number | null): Promise<Bid | undefined> {
    const conditions = [eq(bids.id, id)];
    if (companyId !== null) {
      conditions.push(eq(bids.companyId, companyId));
    } else {
      conditions.push(isNull(bids.companyId));
    }
    
    const [bid] = await db
      .select()
      .from(bids)
      .where(and(...conditions));
    return bid || undefined;
  }

  async listBidsByProject(projectId: string, companyId: number | null): Promise<Bid[]> {
    const conditions = [eq(bids.projectId, projectId)];
    if (companyId !== null) {
      conditions.push(eq(bids.companyId, companyId));
    } else {
      conditions.push(isNull(bids.companyId));
    }
    
    return await db
      .select()
      .from(bids)
      .where(and(...conditions))
      .orderBy(desc(bids.version));
  }

  async getLatestBidForProject(projectId: string, companyId: number | null): Promise<Bid | undefined> {
    const conditions = [
      eq(bids.projectId, projectId),
      eq(bids.isLatest, true)
    ];
    if (companyId !== null) {
      conditions.push(eq(bids.companyId, companyId));
    } else {
      conditions.push(isNull(bids.companyId));
    }
    
    const [bid] = await db
      .select()
      .from(bids)
      .where(and(...conditions));
    return bid || undefined;
  }

  // ==================== COMPANY ADMIN METHODS ====================

  // Get company by ID
  async getCompany(companyId: number): Promise<Company | undefined> {
    const [company] = await db
      .select()
      .from(companies)
      .where(eq(companies.id, companyId));
    return company || undefined;
  }

  // Create a new company
  async createCompany(data: { name: string; slug: string }): Promise<Company> {
    const [company] = await db
      .insert(companies)
      .values(data)
      .returning();
    return company;
  }

  // List users in a company
  async listCompanyUsers(companyId: number): Promise<Omit<User, 'passwordHash'>[]> {
    const result = await db
      .select({
        id: users.id,
        companyId: users.companyId,
        email: users.email,
        name: users.name,
        role: users.role,
        isActive: users.isActive,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
        lastLoginAt: users.lastLoginAt,
      })
      .from(users)
      .where(eq(users.companyId, companyId))
      .orderBy(desc(users.createdAt));
    return result;
  }

  // Update user role within company
  async updateUserRole(userId: number, companyId: number, role: string): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ role, updatedAt: new Date() })
      .where(and(eq(users.id, userId), eq(users.companyId, companyId)))
      .returning();
    return user || undefined;
  }

  // Deactivate user (soft delete)
  async deactivateUser(userId: number, companyId: number): Promise<boolean> {
    const result = await db
      .update(users)
      .set({ isActive: false, updatedAt: new Date() })
      .where(and(eq(users.id, userId), eq(users.companyId, companyId)));
    return (result.rowCount ?? 0) > 0;
  }

  // Reactivate user
  async reactivateUser(userId: number, companyId: number): Promise<boolean> {
    const result = await db
      .update(users)
      .set({ isActive: true, updatedAt: new Date() })
      .where(and(eq(users.id, userId), eq(users.companyId, companyId)));
    return (result.rowCount ?? 0) > 0;
  }

  // Create company invite
  async createCompanyInvite(data: {
    companyId: number;
    email: string;
    role: string;
    inviteCode: string;
    invitedBy: number;
    expiresAt: Date;
  }): Promise<CompanyInvite> {
    const [invite] = await db
      .insert(companyInvites)
      .values(data)
      .returning();
    return invite;
  }

  // Get invite by code
  async getInviteByCode(inviteCode: string): Promise<CompanyInvite | undefined> {
    const [invite] = await db
      .select()
      .from(companyInvites)
      .where(eq(companyInvites.inviteCode, inviteCode));
    return invite || undefined;
  }

  // List pending invites for a company
  async listCompanyInvites(companyId: number): Promise<CompanyInvite[]> {
    return await db
      .select()
      .from(companyInvites)
      .where(and(
        eq(companyInvites.companyId, companyId),
        eq(companyInvites.status, 'pending')
      ))
      .orderBy(desc(companyInvites.createdAt));
  }

  // Accept invite (mark as accepted)
  async acceptInvite(inviteCode: string): Promise<CompanyInvite | undefined> {
    const [invite] = await db
      .update(companyInvites)
      .set({ status: 'accepted', acceptedAt: new Date() })
      .where(eq(companyInvites.inviteCode, inviteCode))
      .returning();
    return invite || undefined;
  }

  // Revoke invite
  async revokeInvite(inviteId: number, companyId: number): Promise<boolean> {
    const result = await db
      .update(companyInvites)
      .set({ status: 'revoked' })
      .where(and(
        eq(companyInvites.id, inviteId),
        eq(companyInvites.companyId, companyId)
      ));
    return (result.rowCount ?? 0) > 0;
  }

  // Check if email already has pending invite for company
  async hasExistingInvite(email: string, companyId: number): Promise<boolean> {
    const [existing] = await db
      .select()
      .from(companyInvites)
      .where(and(
        eq(companyInvites.email, email),
        eq(companyInvites.companyId, companyId),
        eq(companyInvites.status, 'pending')
      ));
    return !!existing;
  }

  // Onboarding methods
  async completeOnboarding(userId: number, brandingProfile: BrandingProfile): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({
        onboardingStatus: 'complete',
        brandingProfile,
        updatedAt: new Date()
      })
      .where(eq(users.id, userId))
      .returning();
    return user || undefined;
  }

  async getUserOnboardingStatus(userId: number): Promise<{ status: string; brandingProfile: BrandingProfile | null } | undefined> {
    const [user] = await db
      .select({
        status: users.onboardingStatus,
        brandingProfile: users.brandingProfile
      })
      .from(users)
      .where(eq(users.id, userId));
    
    if (!user) return undefined;
    return {
      status: user.status,
      brandingProfile: user.brandingProfile || null
    };
  }
}

export const storage = new DatabaseStorage();
