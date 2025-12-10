# BidForge AI - Database Schema & Relationships

This document describes how the database tables are connected to each other in the BidForge AI system.

## Entity Relationship Diagram (Text)

```
                          ┌─────────────────┐
                          │    COMPANIES    │
                          │─────────────────│
                          │ id (PK)         │
                          │ name            │
                          │ createdAt       │
                          │ deletedAt       │ ← Soft delete
                          └────────┬────────┘
                                   │
          ┌────────────────────────┼────────────────────────┐
          │                        │                        │
          ▼                        ▼                        ▼
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│     USERS       │      │    PROJECTS     │      │   TEMPLATES     │
│─────────────────│      │─────────────────│      │─────────────────│
│ id (PK)         │      │ id (PK)         │      │ id (PK)         │
│ companyId (FK)  │◄─────│ companyId (FK)  │      │ companyId (FK)  │
│ email           │      │ name            │      │ name            │
│ password        │      │ clientName      │      │ category        │
│ name            │      │ status          │      │ sections        │
│ role            │      │ isArchived      │      └─────────────────┘
│ deletedAt       │      │ deletedAt       │ ← Soft delete
└────────┬────────┘      └────────┬────────┘
         │                        │
         │                        ├──────────────────────────────────┐
         │                        │                                  │
         ▼                        ▼                                  ▼
┌─────────────────┐      ┌─────────────────┐              ┌─────────────────┐
│    SESSIONS     │      │   DOCUMENTS     │              │      BIDS       │
│─────────────────│      │─────────────────│              │─────────────────│
│ id (PK)         │      │ id (PK)         │              │ id (PK)         │
│ userId (FK)     │      │ projectId (FK)  │              │ projectId (FK)  │
│ refreshToken    │      │ filename        │              │ companyId (FK)  │
│ expiresAt       │      │ content         │              │ userId (FK)     │
└─────────────────┘      │ version         │ ← Versioning │ content         │
                         │ groupId         │ ← Addendums  │ version         │
                         │ deletedAt       │ ← Soft delete│ modelProvider   │
                         └────────┬────────┘              │ deletedAt       │ ← Soft delete
                                  │                       └─────────────────┘
                                  ▼
                         ┌─────────────────┐
                         │ DOCUMENT_CHUNKS │
                         │─────────────────│
                         │ id (PK)         │
                         │ documentId (FK) │
                         │ content         │
                         │ embedding       │
                         │ chunkIndex      │
                         └─────────────────┘
```

## Table Relationships

### Core Business Entities

| Parent Table | Child Table | Relationship | Foreign Key |
|--------------|-------------|--------------|-------------|
| companies | users | One-to-Many | users.companyId |
| companies | projects | One-to-Many | projects.companyId |
| companies | templates | One-to-Many | templates.companyId |
| companies | ai_instructions | One-to-Many | ai_instructions.companyId |
| projects | documents | One-to-Many | documents.projectId |
| projects | bids | One-to-Many | bids.projectId |
| documents | document_chunks | One-to-Many | document_chunks.documentId |

### Authentication & Authorization

| Parent Table | Child Table | Relationship | Foreign Key |
|--------------|-------------|--------------|-------------|
| users | sessions | One-to-Many | sessions.userId |
| users | user_roles | One-to-Many | user_roles.userId |
| roles | user_roles | One-to-Many | user_roles.roleId |
| companies | company_invites | One-to-Many | company_invites.companyId |
| users | company_invites | One-to-Many | company_invites.invitedBy |

### Analysis & AI Features

| Parent Table | Child Table | Relationship | Foreign Key |
|--------------|-------------|--------------|-------------|
| projects | rfp_analyses | One-to-Many | rfp_analyses.projectId |
| rfp_analyses | analysis_alerts | One-to-Many | analysis_alerts.analysisId |
| projects | conflict_detection_runs | One-to-Many | conflict_detection_runs.projectId |
| conflict_detection_runs | document_conflicts | One-to-Many | document_conflicts.runId |
| projects | win_probability_predictions | One-to-Many | win_probability_predictions.projectId |
| projects | agent_executions | One-to-Many | agent_executions.projectId |
| agent_executions | agent_states | One-to-Many | agent_states.executionId |

### Audit & Enterprise Features

| Parent Table | Child Table | Relationship | Foreign Key |
|--------------|-------------|--------------|-------------|
| projects | project_team_members | One-to-Many | project_team_members.projectId |
| users | project_team_members | One-to-Many | project_team_members.userId |
| companies | audit_logs | One-to-Many | audit_logs.companyId |
| users | audit_logs | One-to-Many | audit_logs.userId |

## Detailed Table Descriptions

### Companies
The root entity for multi-tenancy. All business data is scoped to a company.
- **Primary Key:** id (serial)
- **Soft Delete:** deletedAt (timestamp, nullable)
- **Children:** users, projects, templates, ai_instructions, company_invites, audit_logs

### Users
Application users belonging to a company.
- **Primary Key:** id (serial)
- **Foreign Keys:** companyId -> companies.id
- **Soft Delete:** deletedAt (timestamp, nullable)
- **Children:** sessions, user_roles, bids, project_team_members, audit_logs

### Projects
Construction bidding projects containing RFQ documents.
- **Primary Key:** id (uuid)
- **Foreign Keys:** companyId -> companies.id
- **Soft Delete:** deletedAt (timestamp, nullable)
- **Children:** documents, bids, rfp_analyses, conflict_detection_runs, win_probability_predictions, agent_executions, project_team_members

### Documents
Uploaded RFQ/bid documents for a project.
- **Primary Key:** id (serial)
- **Foreign Keys:** projectId -> projects.id
- **Soft Delete:** deletedAt (timestamp, nullable)
- **Versioning:** version (integer, defaults to 1), groupId (varchar, nullable)
- **Children:** document_chunks

### Document Chunks
Semantically chunked document content with vector embeddings for RAG.
- **Primary Key:** id (serial)
- **Foreign Keys:** documentId -> documents.id
- **Special:** embedding column uses pgvector for similarity search

### Bids
AI-generated bid responses with version history.
- **Primary Key:** id (serial)
- **Foreign Keys:** projectId -> projects.id, companyId -> companies.id, userId -> users.id
- **Soft Delete:** deletedAt (timestamp, nullable)
- **Special:** version numbering with isLatest flag for history tracking

### Templates
Reusable bid templates with structured sections.
- **Primary Key:** id (serial)
- **Foreign Keys:** companyId -> companies.id
- **Special:** sections stored as JSONB for flexibility

## Soft Delete Pattern

The following tables support soft deletes via the `deletedAt` column:
- **companies** - Deactivate entire company without losing data
- **users** - Deactivate user accounts without losing history
- **projects** - Archive projects while preserving bid history
- **documents** - Remove documents without breaking references
- **bids** - Hide bid versions without permanent deletion

**Query Pattern:** All queries for active records should include `WHERE deleted_at IS NULL`.

**Indexes:** Partial indexes exist on each table for efficient filtering:
```sql
CREATE INDEX idx_<table>_deleted_at ON <table>(deleted_at) WHERE deleted_at IS NULL;
```

## Document Versioning

Documents support versioning for tracking addendums and revisions:
- **version** (integer) - Sequential version number, defaults to 1
- **groupId** (varchar) - Groups related document versions together

**Use Cases:**
- Track RFQ addendums as new versions
- Link related documents (e.g., original + amendments)
- Query document history by groupId

## Cascade Delete Behavior

All foreign key relationships use `ON DELETE CASCADE`, meaning:
- Deleting a **company** removes all its users, projects, templates, etc.
- Deleting a **project** removes all its documents, bids, analyses, etc.
- Deleting a **document** removes all its chunks
- Deleting a **user** removes their sessions and role assignments

**Note:** With soft deletes enabled, prefer setting `deletedAt` over hard deletes.

## Multi-Tenancy

Data isolation is enforced at the application level:
- Most queries include a `companyId` filter
- Users can only access data belonging to their company
- Role-based access control (RBAC) further restricts actions within a company

## Vector Search (pgvector)

The `document_chunks` table includes a `embedding` column of type `vector(1536)` for semantic search:
- Embeddings are generated using OpenAI's text-embedding-3-small model
- Hybrid search combines vector similarity with full-text search
- Used for RAG (Retrieval-Augmented Generation) in bid generation
