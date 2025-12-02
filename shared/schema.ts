import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, jsonb, boolean, integer, vector } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

// Project Status Enum
export const projectStatusEnum = z.enum(["Active", "Submitted", "Closed-Won", "Closed-Lost"]);
export type ProjectStatus = z.infer<typeof projectStatusEnum>;

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

// Relations
export const projectsRelations = relations(projects, ({ many }) => ({
  documents: many(documents),
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

// Insert Schemas
export const insertProjectSchema = createInsertSchema(projects, {
  name: z.string().min(1, "Project name is required"),
  clientName: z.string().min(1, "Client name is required"),
  status: projectStatusEnum.optional(),
}).omit({ id: true, createdAt: true });

export const insertDocumentSchema = createInsertSchema(documents, {
  isProcessed: z.boolean().optional(),
}).omit({ 
  id: true, 
  uploadedAt: true 
});

export const insertDocumentChunkSchema = createInsertSchema(documentChunks, {
  embedding: z.any().optional(),
}).omit({ 
  id: true 
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
