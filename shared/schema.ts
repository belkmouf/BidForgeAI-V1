import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, jsonb, boolean, integer, vector, real } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

// Project Status Enum
export const projectStatusEnum = z.enum(["Active", "Submitted", "Closed-Won", "Closed-Lost"]);
export type ProjectStatus = z.infer<typeof projectStatusEnum>;

// Risk Level Enum
export const riskLevelEnum = z.enum(["Low", "Medium", "High", "Critical"]);
export type RiskLevel = z.infer<typeof riskLevelEnum>;

// Projects Table
export const projects = pgTable("projects", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  clientName: text("client_name").notNull(),
  status: text("status").notNull().default("Active"),
  metadata: jsonb("metadata").default(sql`'{}'::jsonb`),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Documents Table
export const documents = pgTable("documents", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  projectId: varchar("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  filename: text("filename").notNull(),
  content: text("content"),
  isProcessed: boolean("is_processed").default(false).notNull(),
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
});

// Document Chunks Table (for RAG)
export const documentChunks = pgTable("document_chunks", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  documentId: integer("document_id").notNull().references(() => documents.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  embedding: vector("embedding", { dimensions: 1536 }),
  chunkIndex: integer("chunk_index").notNull(),
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
export const projectsRelations = relations(projects, ({ many, one }) => ({
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

// Insert Schemas - using z.object directly for simpler typing
export const insertProjectSchema = z.object({
  name: z.string().min(1, "Project name is required"),
  clientName: z.string().min(1, "Client name is required"),
  status: projectStatusEnum.optional(),
  metadata: z.any().optional(),
});

export const insertDocumentSchema = z.object({
  projectId: z.string(),
  filename: z.string(),
  content: z.string().optional().nullable(),
  isProcessed: z.boolean().optional(),
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
