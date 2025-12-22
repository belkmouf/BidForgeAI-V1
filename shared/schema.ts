import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, jsonb, boolean, integer, vector, real, serial } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

// Project Status Enum (Business Status)
export const projectStatusEnum = z.enum(["Active", "Submitted", "Closed-Won", "Closed-Lost"]);
export type ProjectStatus = z.infer<typeof projectStatusEnum>;

// Workflow Status Enum (Pipeline Stage)
export const workflowStatusEnum = z.enum([
  "uploading",        // Document upload phase
  "summarizing",      // Summarization agent processing
  "summary_review",   // User reviewing/editing summary
  "analyzing",        // RFP Analysis agent processing
  "analysis_review",  // User reviewing analysis
  "conflict_check",   // Conflict detection running
  "generating",       // Bid generation in progress
  "review",           // Final review phase
  "completed"         // All steps completed
]);
export type WorkflowStatus = z.infer<typeof workflowStatusEnum>;

// Risk Level Enum
export const riskLevelEnum = z.enum(["Low", "Medium", "High", "Critical"]);
export type RiskLevel = z.infer<typeof riskLevelEnum>;

// User Role Enum
// Role hierarchy:
// - system_admin: Full access to everything (all companies, all features)
// - system_user: Platform access with partial authority (view across platform, limited actions)
// - company_admin: Full access within their company
// - company_user: Limited access within their company
export const userRoleEnum = z.enum(["system_admin", "system_user", "company_admin", "company_user"]);
export type UserRole = z.infer<typeof userRoleEnum>;

// Helper to check if role is system-level (cross-company access)
export function isSystemRole(role: UserRole): boolean {
  return role === 'system_admin' || role === 'system_user';
}

// Helper to check if role has admin privileges (within scope)
export function isAdminRole(role: UserRole): boolean {
  return role === 'system_admin' || role === 'company_admin';
}

// Helper to check if role is company-scoped (non-system)
export function isCompanyRole(role: UserRole): boolean {
  return role === 'company_admin' || role === 'company_user';
}

// Validate that a role is appropriate for a company user
export function validateCompanyUserRole(role: string): role is 'company_admin' | 'company_user' {
  return role === 'company_admin' || role === 'company_user';
}

// ==================== MULTI-TENANCY ====================

// Companies Table
export const companies = pgTable("companies", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  logo: text("logo"),
  settings: jsonb("settings").$type<Record<string, any>>().default(sql`'{}'::jsonb`),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  deletedAt: timestamp("deleted_at"),
});

export type Company = typeof companies.$inferSelect;
export type InsertCompany = typeof companies.$inferInsert;

export const insertCompanySchema = z.object({
  name: z.string().min(1, "Company name is required"),
  slug: z.string().min(1, "Company slug is required").regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with dashes"),
  logo: z.string().optional(),
  settings: z.record(z.any()).optional(),
});

// Users Table
// Product/Service Type for company branding
export type CompanyProductService = {
  name: string;
  description?: string;
  category?: string;
  type: 'product' | 'service';
};

// Social Media Links Type
export type SocialMediaLinks = {
  linkedin?: string;
  twitter?: string;
  facebook?: string;
  instagram?: string;
  youtube?: string;
};

// Branding Profile Type (extended to include all website-fetched data)
export type BrandingProfile = {
  companyName?: string;
  tagline?: string;
  websiteUrl?: string;
  primaryColor?: string;
  logoUrl?: string;
  aboutUs?: string;
  fullAboutContent?: string; // Full multi-paragraph about content from website
  contactName?: string;
  contactTitle?: string;
  contactPhone?: string;
  contactEmail?: string;
  streetAddress?: string;
  city?: string;
  state?: string;
  zip?: string;
  licenseNumber?: string;
  // Extended fields for website-fetched data
  industry?: string;
  founded?: string;
  companySize?: string;
  products?: CompanyProductService[];
  services?: CompanyProductService[];
  socialMedia?: SocialMediaLinks;
  dataSource?: 'manual' | 'website' | 'mixed'; // Track where data came from
  lastFetchedAt?: string; // ISO timestamp of last website fetch
  fetchConfidence?: number; // Confidence score from website fetch
};

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").references(() => companies.id, { onDelete: "cascade" }),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  name: varchar("name", { length: 255 }),
  role: text("role").default("company_user").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  onboardingStatus: varchar("onboarding_status", { length: 20 }).default("pending").notNull(),
  brandingProfile: jsonb("branding_profile").$type<BrandingProfile>().default({}),
  termsAcceptedAt: timestamp("terms_accepted_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  lastLoginAt: timestamp("last_login_at"),
  deletedAt: timestamp("deleted_at"),
});

// Sessions Table (for refresh tokens)
export const sessions = pgTable("sessions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: varchar("token_hash", { length: 255 }).notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Roles Table (for RBAC)
export const roles = pgTable("roles", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 50 }).notNull().unique(),
  permissions: jsonb("permissions").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// User Roles Junction Table (for project-specific roles)
export const userRoles = pgTable("user_roles", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  roleId: integer("role_id").notNull().references(() => roles.id, { onDelete: "cascade" }),
  projectId: varchar("project_id").references(() => projects.id, { onDelete: "cascade" }),
  grantedAt: timestamp("granted_at").defaultNow().notNull(),
});

// Company Invitations Table
export const companyInvites = pgTable("company_invites", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  email: varchar("email", { length: 255 }).notNull(),
  role: text("role").default("company_user").notNull(),
  inviteCode: varchar("invite_code", { length: 64 }).notNull().unique(),
  invitedBy: integer("invited_by").notNull().references(() => users.id, { onDelete: "cascade" }),
  status: text("status").default("pending").notNull(), // pending, accepted, expired, revoked
  expiresAt: timestamp("expires_at").notNull(),
  acceptedAt: timestamp("accepted_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type CompanyInvite = typeof companyInvites.$inferSelect;
export type InsertCompanyInvite = typeof companyInvites.$inferInsert;

// Templates Table
export const templates = pgTable("templates", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  category: varchar("category", { length: 100 }).notNull(),
  sections: jsonb("sections").$type<{ title: string; content: string }[]>().default(sql`'[]'::jsonb`),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type Template = typeof templates.$inferSelect;
export type InsertTemplate = typeof templates.$inferInsert;

export const insertTemplateSchema = createInsertSchema(templates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertTemplateInput = z.infer<typeof insertTemplateSchema>;

// Projects Table
export const projects = pgTable("projects", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: integer("company_id").references(() => companies.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  clientName: text("client_name").notNull(),
  description: text("description"),
  status: text("status").notNull().default("Active"),
  workflowStatus: varchar("workflow_status", { length: 50 }).notNull().default("uploading"),
  intakeStatus: varchar("intake_status", { length: 50 }).notNull().default("pending"),
  isArchived: boolean("is_archived").default(false).notNull(),
  metadata: jsonb("metadata").default(sql`'{}'::jsonb`),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  deletedAt: timestamp("deleted_at"),
});

// Documents Table
export const documents = pgTable("documents", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  projectId: varchar("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  filename: text("filename").notNull(),
  originalFilename: text("original_filename"),
  description: text("description"),
  content: text("content"),
  isProcessed: boolean("is_processed").default(false).notNull(),
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
  deletedAt: timestamp("deleted_at"),
  version: integer("version").default(1),
  groupId: varchar("group_id", { length: 255 }),
});

// Document Chunks Table (for RAG)
export const documentChunks = pgTable("document_chunks", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  documentId: integer("document_id").notNull().references(() => documents.id, { onDelete: "cascade" }),
  companyId: integer("company_id").references(() => companies.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  embedding: vector("embedding", { dimensions: 1536 }),
  chunkIndex: integer("chunk_index").notNull(),
  sourceType: varchar("source_type", { length: 20 }).default("original"),
});

// Document Metadata Table (stores extracted information and processing details)
export const documentMetadata = pgTable("document_metadata", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  documentId: integer("document_id").notNull().unique().references(() => documents.id, { onDelete: "cascade" }),
  pageCount: integer("page_count"),
  fileSize: integer("file_size"),
  fileType: varchar("file_type", { length: 50 }),
  keyInformation: jsonb("key_information").$type<{
    projectType?: string;
    location?: string;
    deadline?: string;
    budget?: string;
    requirements?: string[];
  }>(),
  extractedEntities: jsonb("extracted_entities").$type<Array<{
    type: 'date' | 'money' | 'location' | 'requirement' | 'contact' | 'deadline';
    value: string;
    confidence: number;
    context?: string;
  }>>(),
  processingTimeMs: integer("processing_time_ms"),
  processingStatus: varchar("processing_status", { length: 20 }).default("pending"),
  processingError: text("processing_error"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type DocumentMetadata = typeof documentMetadata.$inferSelect;
export type InsertDocumentMetadata = typeof documentMetadata.$inferInsert;

// Document Summaries Table (AI-generated comprehensive summaries of individual documents)
export const documentSummaries = pgTable("document_summaries", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  documentId: integer("document_id").notNull().unique().references(() => documents.id, { onDelete: "cascade" }),
  projectId: varchar("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  summaryContent: text("summary_content").notNull(),
  structuredData: jsonb("structured_data").$type<{
    requirements?: Array<{type: string; description: string; priority?: string}>;
    specifications?: Record<string, any>;
    quantities?: Array<{item: string; quantity: string; unit?: string}>;
    materials?: Array<{name: string; specification?: string; quantity?: string}>;
    budgetInfo?: {estimated?: string; breakdown?: Record<string, string>};
    timeline?: {deadlines?: Array<{date: string; milestone: string}>; duration?: string};
    constraints?: Array<string>;
  }>().default(sql`'{}'::jsonb`),
  isUserEdited: boolean("is_user_edited").default(false).notNull(),
  extractionConfidence: real("extraction_confidence"),
  processingTimeMs: integer("processing_time_ms"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type DocumentSummary = typeof documentSummaries.$inferSelect;
export type InsertDocumentSummary = typeof documentSummaries.$inferInsert;

// Project Summaries Table (AI-generated summaries of project documents)
export const projectSummaries = pgTable("project_summaries", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  projectId: varchar("project_id").notNull().unique().references(() => projects.id, { onDelete: "cascade" }),
  overview: text("overview"),
  scopeOfWork: jsonb("scope_of_work").$type<string[]>(),
  keyRequirements: jsonb("key_requirements").$type<{
    budget?: string;
    timeline?: string;
    certifications?: string[];
    labor?: string;
    insurance?: string[];
    bonding?: string;
  }>(),
  riskFactors: jsonb("risk_factors").$type<string[]>(),
  opportunities: jsonb("opportunities").$type<string[]>(),
  missingInformation: jsonb("missing_information").$type<string[]>(),
  coverageScore: integer("coverage_score").default(0), // 0-100
  completenessScore: integer("completeness_score").default(0), // 0-100
  isUserEdited: boolean("is_user_edited").default(false),
  generatedAt: timestamp("generated_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type ProjectSummary = typeof projectSummaries.$inferSelect;
export type InsertProjectSummary = typeof projectSummaries.$inferInsert;

export const insertProjectSummarySchema = createInsertSchema(projectSummaries).omit({
  id: true,
  generatedAt: true,
  updatedAt: true,
});

// AI Instructions Table (company-scoped presets for bid generation)
export const aiInstructions = pgTable("ai_instructions", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  instructions: text("instructions").notNull(),
  isDefault: boolean("is_default").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type AIInstruction = typeof aiInstructions.$inferSelect;
export type InsertAIInstruction = typeof aiInstructions.$inferInsert;

// Company Knowledge Base Documents Table (for RAG during bid generation)
export const knowledgeBaseDocuments = pgTable("knowledge_base_documents", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  filename: text("filename").notNull(),
  originalName: text("original_name").notNull(),
  fileType: text("file_type").notNull(), // csv, docx, pdf, txt, xlsx
  fileSize: integer("file_size").notNull(),
  content: text("content"),
  isProcessed: boolean("is_processed").default(false).notNull(),
  chunkCount: integer("chunk_count").default(0),
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
});

export type KnowledgeBaseDocument = typeof knowledgeBaseDocuments.$inferSelect;
export type InsertKnowledgeBaseDocument = typeof knowledgeBaseDocuments.$inferInsert;

// Knowledge Base Chunks Table (for RAG)
export const knowledgeBaseChunks = pgTable("knowledge_base_chunks", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  documentId: integer("document_id").notNull().references(() => knowledgeBaseDocuments.id, { onDelete: "cascade" }),
  companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  embedding: vector("embedding", { dimensions: 1536 }),
  chunkIndex: integer("chunk_index").notNull(),
});

export type KnowledgeBaseChunk = typeof knowledgeBaseChunks.$inferSelect;
export type InsertKnowledgeBaseChunk = typeof knowledgeBaseChunks.$inferInsert;

// Generated Bids Table
export const bids = pgTable("bids", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  projectId: varchar("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  companyId: integer("company_id").references(() => companies.id, { onDelete: "cascade" }),
  userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
  
  content: text("content").notNull(),
  rawContent: text("raw_content"),
  instructions: text("instructions"),
  tone: text("tone").default("professional"),
  
  model: text("model").notNull(),
  searchMethod: text("search_method").notNull(),
  chunksUsed: integer("chunks_used").default(0),
  
  version: integer("version").default(1).notNull(),
  isLatest: boolean("is_latest").default(true).notNull(),
  
  shareToken: varchar("share_token", { length: 64 }).unique(),
  
  lmmCost: real("lmm_cost").default(0),
  generationTimeSeconds: integer("generation_time_seconds"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  deletedAt: timestamp("deleted_at"),
});

export type Bid = typeof bids.$inferSelect;
export type InsertBid = typeof bids.$inferInsert;

export const insertBidSchema = createInsertSchema(bids).omit({
  id: true,
  createdAt: true,
});

// RFP Analysis Table
export const rfpAnalyses = pgTable("rfp_analyses", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  projectId: varchar("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  
  qualityScore: real("quality_score"),
  doabilityScore: real("doability_score"),
  clarityScore: real("clarity_score"),
  vendorRiskScore: real("vendor_risk_score"),
  overallRiskLevel: text("overall_risk_level"),
  
  missingDocuments: jsonb("missing_documents").default(sql`'[]'::jsonb`),
  unclearRequirements: jsonb("unclear_requirements").default(sql`'[]'::jsonb`),
  redFlags: jsonb("red_flags").default(sql`'[]'::jsonb`),
  opportunities: jsonb("opportunities").default(sql`'[]'::jsonb`),
  recommendations: jsonb("recommendations").default(sql`'[]'::jsonb`),
  
  vendorName: text("vendor_name"),
  vendorPaymentRating: text("vendor_payment_rating"),
  paymentHistory: jsonb("payment_history"),
  industryReputation: jsonb("industry_reputation"),
  
  analyzedAt: timestamp("analyzed_at").defaultNow().notNull(),
  analysisVersion: text("analysis_version").default("1.0"),
});

// Analysis Alerts Table
export const analysisAlerts = pgTable("analysis_alerts", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  analysisId: integer("analysis_id").notNull().references(() => rfpAnalyses.id, { onDelete: "cascade" }),
  
  alertType: text("alert_type").notNull(),
  severity: text("severity").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  recommendedAction: text("recommended_action"),
  isResolved: boolean("is_resolved").default(false).notNull(),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Conflict Type Enum
export const conflictTypeEnum = z.enum(["semantic", "numeric", "temporal", "scope"]);
export type ConflictType = z.infer<typeof conflictTypeEnum>;

// Conflict Severity Enum
export const conflictSeverityEnum = z.enum(["low", "medium", "high", "critical"]);
export type ConflictSeverity = z.infer<typeof conflictSeverityEnum>;

// Conflict Status Enum
export const conflictStatusEnum = z.enum(["detected", "reviewing", "resolved", "dismissed"]);
export type ConflictStatus = z.infer<typeof conflictStatusEnum>;

// Document Conflicts Table
export const documentConflicts = pgTable("document_conflicts", {
  id: serial("id").primaryKey(),
  projectId: varchar("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  
  conflictType: text("conflict_type").notNull(),
  severity: text("severity").notNull().default("medium"),
  status: text("status").notNull().default("detected"),
  
  sourceDocumentId: integer("source_document_id").references(() => documents.id, { onDelete: "cascade" }),
  sourceChunkId: integer("source_chunk_id").references(() => documentChunks.id, { onDelete: "cascade" }),
  sourceText: text("source_text").notNull(),
  sourceLocation: jsonb("source_location").$type<{ page?: number; paragraph?: number; sentence?: number }>(),
  
  targetDocumentId: integer("target_document_id").references(() => documents.id, { onDelete: "cascade" }),
  targetChunkId: integer("target_chunk_id").references(() => documentChunks.id, { onDelete: "cascade" }),
  targetText: text("target_text").notNull(),
  targetLocation: jsonb("target_location").$type<{ page?: number; paragraph?: number; sentence?: number }>(),
  
  description: text("description").notNull(),
  suggestedResolution: text("suggested_resolution"),
  
  confidenceScore: real("confidence_score"),
  semanticSimilarity: real("semantic_similarity"),
  
  resolvedBy: integer("resolved_by").references(() => users.id),
  resolvedAt: timestamp("resolved_at"),
  resolution: text("resolution"),
  
  metadata: jsonb("metadata").default(sql`'{}'::jsonb`),
  detectedAt: timestamp("detected_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Conflict Detection Runs Table
export const conflictDetectionRuns = pgTable("conflict_detection_runs", {
  id: serial("id").primaryKey(),
  projectId: varchar("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  
  status: text("status").notNull().default("running"),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
  
  totalConflicts: integer("total_conflicts").default(0),
  semanticConflicts: integer("semantic_conflicts").default(0),
  numericConflicts: integer("numeric_conflicts").default(0),
  temporalConflicts: integer("temporal_conflicts").default(0),
  
  error: text("error"),
  metadata: jsonb("metadata").default(sql`'{}'::jsonb`),
});

// Agent Executions Table (for workflow tracking)
export const agentExecutions = pgTable("agent_executions", {
  id: serial("id").primaryKey(),
  projectId: varchar("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  agentName: varchar("agent_name", { length: 100 }).notNull(),
  status: varchar("status", { length: 50 }).notNull(),
  input: jsonb("input"),
  output: jsonb("output"),
  error: text("error"),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
  durationMs: integer("duration_ms"),
});

// Agent States Table (for workflow state persistence)
export const agentStates = pgTable("agent_states", {
  id: serial("id").primaryKey(),
  projectId: varchar("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }).unique(),
  currentAgent: varchar("current_agent", { length: 100 }).notNull(),
  status: varchar("status", { length: 50 }).notNull().default("pending"),
  state: jsonb("state").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Vendor Database Table
export const vendorDatabase = pgTable("vendor_database", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  vendorName: text("vendor_name").notNull().unique(),
  
  averagePaymentDays: integer("average_payment_days"),
  onTimePaymentRate: real("on_time_payment_rate"),
  totalProjects: integer("total_projects"),
  latePayments: integer("late_payments"),
  disputedPayments: integer("disputed_payments"),
  
  overallRating: text("overall_rating"),
  paymentRating: text("payment_rating"),
  communicationRating: text("communication_rating"),
  
  industrySectors: jsonb("industry_sectors").default(sql`'[]'::jsonb`),
  typicalProjectSize: text("typical_project_size"),
  geographicRegions: jsonb("geographic_regions").default(sql`'[]'::jsonb`),
  notes: text("notes"),
  
  lastUpdated: timestamp("last_updated").defaultNow().notNull(),
});

// Relations
export const companiesRelations = relations(companies, ({ many }) => ({
  users: many(users),
  projects: many(projects),
}));

export const projectsRelations = relations(projects, ({ many, one }) => ({
  company: one(companies, {
    fields: [projects.companyId],
    references: [companies.id],
  }),
  documents: many(documents),
  analysis: one(rfpAnalyses),
}));

export const rfpAnalysesRelations = relations(rfpAnalyses, ({ one, many }) => ({
  project: one(projects, {
    fields: [rfpAnalyses.projectId],
    references: [projects.id],
  }),
  alerts: many(analysisAlerts),
}));

export const analysisAlertsRelations = relations(analysisAlerts, ({ one }) => ({
  analysis: one(rfpAnalyses, {
    fields: [analysisAlerts.analysisId],
    references: [rfpAnalyses.id],
  }),
}));

export const documentsRelations = relations(documents, ({ one, many }) => ({
  project: one(projects, {
    fields: [documents.projectId],
    references: [projects.id],
  }),
  chunks: many(documentChunks),
}));

export const documentChunksRelations = relations(documentChunks, ({ one }) => ({
  document: one(documents, {
    fields: [documentChunks.documentId],
    references: [documents.id],
  }),
}));

// User Relations
export const usersRelations = relations(users, ({ many, one }) => ({
  company: one(companies, {
    fields: [users.companyId],
    references: [companies.id],
  }),
  sessions: many(sessions),
  userRoles: many(userRoles),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

export const rolesRelations = relations(roles, ({ many }) => ({
  userRoles: many(userRoles),
}));

export const userRolesRelations = relations(userRoles, ({ one }) => ({
  user: one(users, {
    fields: [userRoles.userId],
    references: [users.id],
  }),
  role: one(roles, {
    fields: [userRoles.roleId],
    references: [roles.id],
  }),
  project: one(projects, {
    fields: [userRoles.projectId],
    references: [projects.id],
  }),
}));

// Insert Schemas - using z.object directly for simpler typing
export const insertProjectSchema = z.object({
  name: z.string().min(1, "Project name is required"),
  clientName: z.string().min(1, "Client name is required"),
  description: z.string().min(1, "Project description is required").max(5000, "Description must be 5000 characters or less"),
  status: projectStatusEnum.optional(),
  metadata: z.any().optional(),
});

export const insertDocumentSchema = z.object({
  projectId: z.string(),
  filename: z.string(),
  originalFilename: z.string().optional().nullable(),
  content: z.string().optional().nullable(),
  isProcessed: z.boolean().optional(),
  version: z.number().int().positive().optional(),
  groupId: z.string().optional().nullable(),
});

export const insertDocumentChunkSchema = z.object({
  documentId: z.number(),
  content: z.string(),
  chunkIndex: z.number(),
  embedding: z.any().optional(),
});

// Select Schemas
export const selectProjectSchema = createSelectSchema(projects);
export const selectDocumentSchema = createSelectSchema(documents);
export const selectDocumentChunkSchema = createSelectSchema(documentChunks);

// Types
export type Project = typeof projects.$inferSelect;
export type InsertProject = z.infer<typeof insertProjectSchema>;

export type Document = typeof documents.$inferSelect;
export type InsertDocument = z.infer<typeof insertDocumentSchema>;

export type DocumentChunk = typeof documentChunks.$inferSelect;
export type InsertDocumentChunk = z.infer<typeof insertDocumentChunkSchema>;

export type RFPAnalysis = typeof rfpAnalyses.$inferSelect;
export type InsertRFPAnalysis = typeof rfpAnalyses.$inferInsert;

export type AnalysisAlert = typeof analysisAlerts.$inferSelect;
export type InsertAnalysisAlert = typeof analysisAlerts.$inferInsert;

export type Vendor = typeof vendorDatabase.$inferSelect;
export type InsertVendor = typeof vendorDatabase.$inferInsert;

// User Types
export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export type Session = typeof sessions.$inferSelect;
export type InsertSession = typeof sessions.$inferInsert;

export type Role = typeof roles.$inferSelect;
export type InsertRole = typeof roles.$inferInsert;

export type UserRoleAssignment = typeof userRoles.$inferSelect;
export type InsertUserRoleAssignment = typeof userRoles.$inferInsert;

// Agent Types
export type AgentExecution = typeof agentExecutions.$inferSelect;
export type InsertAgentExecution = typeof agentExecutions.$inferInsert;

export type AgentState = typeof agentStates.$inferSelect;
export type InsertAgentState = typeof agentStates.$inferInsert;

// User Insert Schema
export const insertUserSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().min(1, "Name is required").optional(),
  role: userRoleEnum.optional().default("company_user"),
  companyName: z.string().min(1, "Company name is required").optional(),
});

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export type InsertUserInput = z.infer<typeof insertUserSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

// Company Invite Schemas
export const createInviteSchema = z.object({
  email: z.string().email("Invalid email address"),
  role: userRoleEnum.optional().default("company_user"),
});

export const acceptInviteSchema = z.object({
  inviteCode: z.string().min(1, "Invite code is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().min(1, "Name is required"),
});

export type CreateInviteInput = z.infer<typeof createInviteSchema>;
export type AcceptInviteInput = z.infer<typeof acceptInviteSchema>;

// Conflict Types
export type DocumentConflict = typeof documentConflicts.$inferSelect;
export type InsertDocumentConflict = typeof documentConflicts.$inferInsert;

export type ConflictDetectionRun = typeof conflictDetectionRuns.$inferSelect;
export type InsertConflictDetectionRun = typeof conflictDetectionRuns.$inferInsert;

// Conflict Schemas
export const insertConflictSchema = z.object({
  projectId: z.string(),
  conflictType: conflictTypeEnum,
  severity: conflictSeverityEnum.optional().default("medium"),
  status: conflictStatusEnum.optional().default("detected"),
  sourceDocumentId: z.number().optional(),
  sourceChunkId: z.number().optional(),
  sourceText: z.string(),
  sourceLocation: z.object({
    page: z.number().optional(),
    paragraph: z.number().optional(),
    sentence: z.number().optional(),
  }).optional(),
  targetDocumentId: z.number().optional(),
  targetChunkId: z.number().optional(),
  targetText: z.string(),
  targetLocation: z.object({
    page: z.number().optional(),
    paragraph: z.number().optional(),
    sentence: z.number().optional(),
  }).optional(),
  description: z.string(),
  suggestedResolution: z.string().optional(),
  confidenceScore: z.number().optional(),
  semanticSimilarity: z.number().optional(),
});

export const updateConflictStatusSchema = z.object({
  status: conflictStatusEnum,
  resolution: z.string().optional(),
});

// Feature Breakdown Type
export interface FeatureBreakdown {
  name: string;
  displayName: string;
  score: number;
  weight: number;
  contribution: number;
  status: 'positive' | 'neutral' | 'negative';
  insight: string;
}

// Win Probability Tables
export const winProbabilityPredictions = pgTable("win_probability_predictions", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  projectId: varchar("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  
  probability: real("probability").notNull(),
  confidence: real("confidence").notNull(),
  predictionDate: timestamp("prediction_date").defaultNow().notNull(),
  
  featureScores: jsonb("feature_scores").$type<Record<string, number>>().notNull(),
  featureWeights: jsonb("feature_weights").$type<Record<string, number>>().notNull(),
  breakdown: jsonb("breakdown").$type<FeatureBreakdown[]>().default(sql`'[]'::jsonb`),
  
  riskFactors: jsonb("risk_factors").$type<string[]>().default(sql`'[]'::jsonb`),
  strengthFactors: jsonb("strength_factors").$type<string[]>().default(sql`'[]'::jsonb`),
  recommendations: jsonb("recommendations").$type<string[]>().default(sql`'[]'::jsonb`),
  
  modelVersion: text("model_version").default("1.0").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const bidOutcomes = pgTable("bid_outcomes", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  projectId: varchar("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  
  outcome: text("outcome").notNull(),
  bidAmount: real("bid_amount"),
  winningBidAmount: real("winning_bid_amount"),
  competitorCount: integer("competitor_count"),
  
  outcomeFactors: jsonb("outcome_factors").$type<string[]>().default(sql`'[]'::jsonb`),
  clientFeedback: text("client_feedback"),
  lessonsLearned: text("lessons_learned"),
  
  recordedAt: timestamp("recorded_at").defaultNow().notNull(),
  recordedBy: integer("recorded_by").references(() => users.id),
});

export const projectFeatures = pgTable("project_features", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  projectId: varchar("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  
  projectTypeScore: real("project_type_score"),
  clientRelationshipScore: real("client_relationship_score"),
  competitivenessScore: real("competitiveness_score"),
  teamCapacityScore: real("team_capacity_score"),
  timelineScore: real("timeline_score"),
  complexityScore: real("complexity_score"),
  requirementsClarityScore: real("requirements_clarity_score"),
  budgetAlignmentScore: real("budget_alignment_score"),
  
  historicalWinRate: real("historical_win_rate"),
  similarProjectsWon: integer("similar_projects_won").default(0),
  similarProjectsLost: integer("similar_projects_lost").default(0),
  
  rawFeatures: jsonb("raw_features").$type<Record<string, any>>().default(sql`'{}'::jsonb`),
  extractedAt: timestamp("extracted_at").defaultNow().notNull(),
  version: text("version").default("1.0"),
});

// Win Probability Types
export type WinProbabilityPrediction = typeof winProbabilityPredictions.$inferSelect;
export type InsertWinProbabilityPrediction = typeof winProbabilityPredictions.$inferInsert;

export type BidOutcome = typeof bidOutcomes.$inferSelect;
export type InsertBidOutcome = typeof bidOutcomes.$inferInsert;

export type ProjectFeature = typeof projectFeatures.$inferSelect;
export type InsertProjectFeature = typeof projectFeatures.$inferInsert;

// Win Probability Schemas
export const bidOutcomeEnum = z.enum(["won", "lost", "no_bid", "pending"]);
export type BidOutcomeType = z.infer<typeof bidOutcomeEnum>;

export const insertBidOutcomeSchema = z.object({
  projectId: z.string(),
  outcome: bidOutcomeEnum,
  bidAmount: z.number().optional(),
  winningBidAmount: z.number().optional(),
  competitorCount: z.number().optional(),
  outcomeFactors: z.array(z.string()).optional(),
  clientFeedback: z.string().optional(),
  lessonsLearned: z.string().optional(),
});

// ==================== ENTERPRISE FEATURES ====================

// Team Member Role Enum
export const teamRoleEnum = z.enum(["owner", "editor", "viewer"]);
export type TeamRole = z.infer<typeof teamRoleEnum>;

// Project Team Members Table
export const projectTeamMembers = pgTable("project_team_members", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  projectId: varchar("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  role: text("role").notNull().default("viewer"),
  addedBy: integer("added_by").references(() => users.id),
  addedAt: timestamp("added_at").defaultNow().notNull(),
  lastAccessedAt: timestamp("last_accessed_at"),
});

// User Presence Table (for real-time collaboration)
export const userPresence = pgTable("user_presence", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  projectId: varchar("project_id").references(() => projects.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("online"),
  currentPage: text("current_page"),
  lastActiveAt: timestamp("last_active_at").defaultNow().notNull(),
  socketId: text("socket_id"),
});

// Audit Logs Table
export const auditLogs = pgTable("audit_logs", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: integer("user_id").references(() => users.id),
  userEmail: text("user_email"),
  action: text("action").notNull(),
  resourceType: text("resource_type").notNull(),
  resourceId: text("resource_id"),
  projectId: varchar("project_id").references(() => projects.id, { onDelete: "set null" }),
  details: jsonb("details").$type<Record<string, any>>().default(sql`'{}'::jsonb`),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Team Activity Feed
export const teamActivity = pgTable("team_activity", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  projectId: varchar("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  activityType: text("activity_type").notNull(),
  description: text("description").notNull(),
  metadata: jsonb("metadata").$type<Record<string, any>>().default(sql`'{}'::jsonb`),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Project Comments (for collaboration)
export const projectComments = pgTable("project_comments", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  projectId: varchar("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  parentId: integer("parent_id"),
  isResolved: boolean("is_resolved").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Enterprise Types
export type ProjectTeamMember = typeof projectTeamMembers.$inferSelect;
export type InsertProjectTeamMember = typeof projectTeamMembers.$inferInsert;

export type UserPresence = typeof userPresence.$inferSelect;
export type InsertUserPresence = typeof userPresence.$inferInsert;

export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = typeof auditLogs.$inferInsert;

export type TeamActivity = typeof teamActivity.$inferSelect;
export type InsertTeamActivity = typeof teamActivity.$inferInsert;

export type ProjectComment = typeof projectComments.$inferSelect;
export type InsertProjectComment = typeof projectComments.$inferInsert;

// Enterprise Schemas
export const insertProjectTeamMemberSchema = z.object({
  projectId: z.string(),
  userId: z.number(),
  role: teamRoleEnum.optional().default("viewer"),
});

export const insertProjectCommentSchema = z.object({
  projectId: z.string(),
  content: z.string().min(1),
  parentId: z.number().optional(),
});

export const updateProjectCommentSchema = z.object({
  content: z.string().min(1).optional(),
  isResolved: z.boolean().optional(),
});

// ==================== DECISION LOGS ====================

// Decision Log Schema (for Go/No-Go visualization)
export const decisionLogSchema = z.object({
  doabilityScore: z.number(),
  minDoabilityThreshold: z.number().default(30),
  criticalRiskLevel: z.boolean(),
  vendorRiskScore: z.number(),
  decision: z.enum(['PROCEED', 'REJECT']),
  reason: z.string(),
  triggeredRule: z.string(),
  bidStrategy: z.object({
    approach: z.enum(['aggressive', 'balanced', 'conservative']),
    pricePositioning: z.enum(['low', 'mid', 'premium']),
    focusAreas: z.array(z.string()),
    confidenceLevel: z.number(),
    recommendedMargin: z.string(),
  }).optional(),
});

export type DecisionLog = z.infer<typeof decisionLogSchema>;

// Decision Logs Table
export const decisionLogs = pgTable("decision_logs", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  projectId: varchar("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  companyId: integer("company_id").references(() => companies.id, { onDelete: "cascade" }),
  doabilityScore: real("doability_score").notNull(),
  minDoabilityThreshold: real("min_doability_threshold").default(30),
  criticalRiskLevel: boolean("critical_risk_level").notNull(),
  vendorRiskScore: real("vendor_risk_score"),
  decision: text("decision").notNull(),
  reason: text("reason").notNull(),
  triggeredRule: text("triggered_rule").notNull(),
  bidStrategy: jsonb("bid_strategy").$type<{
    approach: string;
    pricePositioning: string;
    focusAreas: string[];
    confidenceLevel: number;
    recommendedMargin: string;
  }>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type DecisionLogRecord = typeof decisionLogs.$inferSelect;
export type InsertDecisionLog = typeof decisionLogs.$inferInsert;

// ==================== DASHBOARD CONFIGURATION ====================

// Dashboard Widget Type Enum
export const widgetTypeEnum = z.enum([
  'win_rate_gauge',
  'monthly_trends',
  'project_type_breakdown',
  'client_performance',
  'revenue_by_status',
  'recent_outcomes',
  'avg_bid_amount',
  'prediction_accuracy'
]);
export type WidgetType = z.infer<typeof widgetTypeEnum>;

// Dashboard Widget Configuration
export type DashboardWidget = {
  id: string;
  type: WidgetType;
  title: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
  settings?: Record<string, any>;
};

// User Dashboard Configuration Table
export const dashboardConfigs = pgTable("dashboard_configs", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  companyId: integer("company_id").references(() => companies.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 100 }).notNull().default("My Dashboard"),
  isDefault: boolean("is_default").default(false),
  widgets: jsonb("widgets").$type<DashboardWidget[]>().default(sql`'[]'::jsonb`),
  dateRange: varchar("date_range", { length: 50 }).default("30d"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type DashboardConfig = typeof dashboardConfigs.$inferSelect;
export type InsertDashboardConfig = typeof dashboardConfigs.$inferInsert;

export const insertDashboardConfigSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  isDefault: z.boolean().optional(),
  widgets: z.array(z.object({
    id: z.string(),
    type: widgetTypeEnum,
    title: z.string(),
    position: z.object({ x: z.number(), y: z.number() }),
    size: z.object({ width: z.number(), height: z.number() }),
    settings: z.record(z.any()).optional(),
  })).optional(),
  dateRange: z.string().optional(),
});

export const updateDashboardConfigSchema = insertDashboardConfigSchema.partial();

// ==================== DOCUMENT VERIFICATION & CHECKLIST SYSTEM ====================

// Intake Status Enum
export const intakeStatusEnum = z.enum([
  "pending",           // Intake profile not yet created
  "profile_created",   // Profile created, awaiting document upload
  "documents_pending", // Documents being uploaded
  "verification",      // Documents being verified
  "gate1_pending",     // Awaiting Gate 1 approval
  "gate1_passed",      // Gate 1 passed
  "analysis",          // Analysis in progress
  "gate2_pending",     // Awaiting Gate 2 approval (pre-submission)
  "gate2_passed",      // Gate 2 passed, ready for submission
  "submitted"          // Bid submitted
]);
export type IntakeStatus = z.infer<typeof intakeStatusEnum>;

// RFP Type Enum
export const rfpTypeEnum = z.enum([
  "construction",
  "it_technology",
  "consulting",
  "supply_equipment",
  "maintenance",
  "design_build",
  "other"
]);
export type RFPType = z.infer<typeof rfpTypeEnum>;

// Contract Value Range Enum
export const contractValueEnum = z.enum([
  "under_500k",
  "500k_5m",
  "5m_50m",
  "over_50m"
]);
export type ContractValueRange = z.infer<typeof contractValueEnum>;

// GCC Region Enum
export const gccRegionEnum = z.enum([
  "uae",
  "saudi_arabia",
  "qatar",
  "kuwait",
  "oman",
  "bahrain",
  "other"
]);
export type GCCRegion = z.infer<typeof gccRegionEnum>;

// Client Type Enum
export const clientTypeEnum = z.enum([
  "government",
  "semi_government",
  "private",
  "international"
]);
export type ClientType = z.infer<typeof clientTypeEnum>;

// Checklist Item Status Enum
export const checklistItemStatusEnum = z.enum([
  "required",
  "optional",
  "not_applicable",
  "uploaded",
  "verified",
  "failed"
]);
export type ChecklistItemStatus = z.infer<typeof checklistItemStatusEnum>;

// Checklist Category Enum
export const checklistCategoryEnum = z.enum([
  "technical",
  "commercial",
  "qualifications",
  "legal",
  "project_management",
  "drawings"
]);
export type ChecklistCategory = z.infer<typeof checklistCategoryEnum>;

// Document Validation State Enum
export const documentValidationStateEnum = z.enum([
  "pending",
  "validating",
  "passed",
  "warning",
  "failed"
]);
export type DocumentValidationState = z.infer<typeof documentValidationStateEnum>;

// Requirement Priority Enum
export const requirementPriorityEnum = z.enum([
  "critical",
  "high",
  "medium",
  "low"
]);
export type RequirementPriority = z.infer<typeof requirementPriorityEnum>;

// Requirement Category Enum
export const requirementCategoryEnum = z.enum([
  "technical",
  "commercial",
  "qualification",
  "evaluation_criteria",
  "compliance",
  "deliverable"
]);
export type RequirementCategory = z.infer<typeof requirementCategoryEnum>;

// Requirement Coverage Status Enum
export const coverageStatusEnum = z.enum([
  "not_addressed",
  "partially_addressed",
  "fully_addressed",
  "exceeds"
]);
export type CoverageStatus = z.infer<typeof coverageStatusEnum>;

// Project Intake Profiles Table
export const projectIntakeProfiles = pgTable("project_intake_profiles", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  projectId: varchar("project_id").notNull().unique().references(() => projects.id, { onDelete: "cascade" }),
  
  rfpType: text("rfp_type").notNull(),
  contractValueRange: text("contract_value_range").notNull(),
  clientRegion: text("client_region").notNull(),
  clientType: text("client_type").notNull(),
  
  submissionDeadline: timestamp("submission_deadline"),
  projectDuration: varchar("project_duration", { length: 100 }),
  specialRequirements: text("special_requirements"),
  
  isComplete: boolean("is_complete").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type ProjectIntakeProfile = typeof projectIntakeProfiles.$inferSelect;
export type InsertProjectIntakeProfile = typeof projectIntakeProfiles.$inferInsert;

export const insertProjectIntakeProfileSchema = z.object({
  projectId: z.string(),
  rfpType: rfpTypeEnum,
  contractValueRange: contractValueEnum,
  clientRegion: gccRegionEnum,
  clientType: clientTypeEnum,
  submissionDeadline: z.string().datetime().optional(),
  projectDuration: z.string().optional(),
  specialRequirements: z.string().optional(),
});

// Checklist Items Table
export const checklistItems = pgTable("checklist_items", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  projectId: varchar("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  
  name: text("name").notNull(),
  description: text("description"),
  category: text("category").notNull(),
  status: text("status").notNull().default("required"),
  isRequired: boolean("is_required").default(true).notNull(),
  
  documentId: integer("document_id").references(() => documents.id, { onDelete: "set null" }),
  matchConfidence: real("match_confidence"),
  
  sortOrder: integer("sort_order").default(0),
  aiGenerated: boolean("ai_generated").default(true).notNull(),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type ChecklistItem = typeof checklistItems.$inferSelect;
export type InsertChecklistItem = typeof checklistItems.$inferInsert;

export const insertChecklistItemSchema = z.object({
  projectId: z.string(),
  name: z.string().min(1),
  description: z.string().optional(),
  category: checklistCategoryEnum,
  status: checklistItemStatusEnum.optional(),
  isRequired: z.boolean().optional(),
  documentId: z.number().optional(),
  sortOrder: z.number().optional(),
  aiGenerated: z.boolean().optional(),
});

// Document Integrity Reports Table
export const documentIntegrityReports = pgTable("document_integrity_reports", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  documentId: integer("document_id").notNull().unique().references(() => documents.id, { onDelete: "cascade" }),
  projectId: varchar("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  
  overallScore: real("overall_score").notNull(),
  validationState: text("validation_state").notNull().default("pending"),
  
  integrityScore: real("integrity_score"),
  completenessScore: real("completeness_score"),
  metadataScore: real("metadata_score"),
  complianceScore: real("compliance_score"),
  
  isPasswordProtected: boolean("is_password_protected").default(false),
  isDuplicate: boolean("is_duplicate").default(false),
  duplicateOfDocumentId: integer("duplicate_of_document_id").references(() => documents.id),
  
  issues: jsonb("issues").$type<Array<{
    type: 'error' | 'warning' | 'info';
    code: string;
    message: string;
    details?: string;
  }>>().default(sql`'[]'::jsonb`),
  
  recommendations: jsonb("recommendations").$type<Array<{
    priority: 'critical' | 'high' | 'medium' | 'low';
    action: string;
    reason: string;
  }>>().default(sql`'[]'::jsonb`),
  
  metadata: jsonb("metadata").$type<{
    pageCount?: number;
    fileSize?: number;
    fileType?: string;
    createdDate?: string;
    modifiedDate?: string;
    author?: string;
    version?: string;
    hasDraftWatermark?: boolean;
    hasSignatures?: boolean;
  }>().default(sql`'{}'::jsonb`),
  
  verifiedAt: timestamp("verified_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type DocumentIntegrityReport = typeof documentIntegrityReports.$inferSelect;
export type InsertDocumentIntegrityReport = typeof documentIntegrityReports.$inferInsert;

// Project Requirements Table (extracted from RFP)
export const projectRequirements = pgTable("project_requirements", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  projectId: varchar("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  
  code: varchar("code", { length: 20 }).notNull(),
  title: text("title").notNull(),
  description: text("description"),
  category: text("category").notNull(),
  priority: text("priority").notNull().default("medium"),
  
  sourceDocumentId: integer("source_document_id").references(() => documents.id, { onDelete: "set null" }),
  sourceSection: varchar("source_section", { length: 100 }),
  sourcePage: integer("source_page"),
  sourceText: text("source_text"),
  
  isMandatory: boolean("is_mandatory").default(true).notNull(),
  evaluationPoints: real("evaluation_points"),
  
  coverageStatus: text("coverage_status").notNull().default("not_addressed"),
  coveragePercentage: real("coverage_percentage").default(0),
  
  extractedAt: timestamp("extracted_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type ProjectRequirement = typeof projectRequirements.$inferSelect;
export type InsertProjectRequirement = typeof projectRequirements.$inferInsert;

export const insertProjectRequirementSchema = z.object({
  projectId: z.string(),
  code: z.string().min(1).max(20),
  title: z.string().min(1),
  description: z.string().optional(),
  category: requirementCategoryEnum,
  priority: requirementPriorityEnum.optional(),
  sourceDocumentId: z.number().optional(),
  sourceSection: z.string().optional(),
  sourcePage: z.number().optional(),
  sourceText: z.string().optional(),
  isMandatory: z.boolean().optional(),
  evaluationPoints: z.number().optional(),
});

// Requirement Coverage Links Table (maps requirements to bid content)
export const requirementCoverages = pgTable("requirement_coverages", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  requirementId: integer("requirement_id").notNull().references(() => projectRequirements.id, { onDelete: "cascade" }),
  projectId: varchar("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  
  bidId: integer("bid_id").references(() => bids.id, { onDelete: "cascade" }),
  sectionTitle: varchar("section_title", { length: 255 }),
  contentExcerpt: text("content_excerpt"),
  pageNumber: integer("page_number"),
  
  coverageStatus: text("coverage_status").notNull().default("not_addressed"),
  coverageQuality: text("coverage_quality"),
  confidenceScore: real("confidence_score"),
  
  aiVerified: boolean("ai_verified").default(false).notNull(),
  userVerified: boolean("user_verified").default(false).notNull(),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type RequirementCoverage = typeof requirementCoverages.$inferSelect;
export type InsertRequirementCoverage = typeof requirementCoverages.$inferInsert;

// Verification Gates Table (tracks gate status)
export const verificationGates = pgTable("verification_gates", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  projectId: varchar("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  
  gateNumber: integer("gate_number").notNull(),
  gateName: varchar("gate_name", { length: 100 }).notNull(),
  
  status: text("status").notNull().default("pending"),
  overallScore: real("overall_score"),
  
  checkResults: jsonb("check_results").$type<Array<{
    checkName: string;
    passed: boolean;
    score?: number;
    message: string;
    details?: string;
  }>>().default(sql`'[]'::jsonb`),
  
  issuesCount: integer("issues_count").default(0),
  warningsCount: integer("warnings_count").default(0),
  
  acknowledgedBy: integer("acknowledged_by").references(() => users.id),
  acknowledgedAt: timestamp("acknowledged_at"),
  acknowledgedWithRisks: boolean("acknowledged_with_risks").default(false),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type VerificationGate = typeof verificationGates.$inferSelect;
export type InsertVerificationGate = typeof verificationGates.$inferInsert;

// Relations for new tables
export const projectIntakeProfilesRelations = relations(projectIntakeProfiles, ({ one }) => ({
  project: one(projects, {
    fields: [projectIntakeProfiles.projectId],
    references: [projects.id],
  }),
}));

export const checklistItemsRelations = relations(checklistItems, ({ one }) => ({
  project: one(projects, {
    fields: [checklistItems.projectId],
    references: [projects.id],
  }),
  document: one(documents, {
    fields: [checklistItems.documentId],
    references: [documents.id],
  }),
}));

export const documentIntegrityReportsRelations = relations(documentIntegrityReports, ({ one }) => ({
  document: one(documents, {
    fields: [documentIntegrityReports.documentId],
    references: [documents.id],
  }),
  project: one(projects, {
    fields: [documentIntegrityReports.projectId],
    references: [projects.id],
  }),
}));

export const projectRequirementsRelations = relations(projectRequirements, ({ one, many }) => ({
  project: one(projects, {
    fields: [projectRequirements.projectId],
    references: [projects.id],
  }),
  sourceDocument: one(documents, {
    fields: [projectRequirements.sourceDocumentId],
    references: [documents.id],
  }),
  coverages: many(requirementCoverages),
}));

export const requirementCoveragesRelations = relations(requirementCoverages, ({ one }) => ({
  requirement: one(projectRequirements, {
    fields: [requirementCoverages.requirementId],
    references: [projectRequirements.id],
  }),
  project: one(projects, {
    fields: [requirementCoverages.projectId],
    references: [projects.id],
  }),
  bid: one(bids, {
    fields: [requirementCoverages.bidId],
    references: [bids.id],
  }),
}));

export const verificationGatesRelations = relations(verificationGates, ({ one }) => ({
  project: one(projects, {
    fields: [verificationGates.projectId],
    references: [projects.id],
  }),
  acknowledgedByUser: one(users, {
    fields: [verificationGates.acknowledgedBy],
    references: [users.id],
  }),
}));
