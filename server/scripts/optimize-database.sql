-- BidForge AI Database Optimization Script
-- This script creates indexes to optimize common query patterns

-- =============================================================================
-- COMPANIES TABLE INDEXES
-- =============================================================================

-- Index for company lookups by slug (unique login/access patterns)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_companies_slug 
ON companies(slug) WHERE deleted_at IS NULL;

-- Index for active companies
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_companies_active 
ON companies(is_active, created_at) WHERE deleted_at IS NULL;

-- =============================================================================
-- USERS TABLE INDEXES
-- =============================================================================

-- Index for login operations (most critical)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email_active 
ON users(email) WHERE is_active = true AND deleted_at IS NULL;

-- Index for company user lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_company_role 
ON users(company_id, role) WHERE is_active = true AND deleted_at IS NULL;

-- Index for user sessions and last login tracking
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_last_login 
ON users(last_login_at DESC) WHERE is_active = true;

-- =============================================================================
-- SESSIONS TABLE INDEXES
-- =============================================================================

-- Index for session cleanup and token lookup
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sessions_user_expires 
ON sessions(user_id, expires_at DESC);

-- Index for session token hash lookup
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sessions_token_hash 
ON sessions(token_hash) WHERE expires_at > NOW();

-- Index for session cleanup operations
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sessions_expires 
ON sessions(expires_at) WHERE expires_at <= NOW();

-- =============================================================================
-- PROJECTS TABLE INDEXES
-- =============================================================================

-- Index for company project listings (main dashboard query)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_projects_company_status 
ON projects(company_id, status, created_at DESC) WHERE deleted_at IS NULL;

-- Index for archived projects toggle
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_projects_company_archived 
ON projects(company_id, is_archived, created_at DESC) WHERE deleted_at IS NULL;

-- Index for project search by name and client
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_projects_search 
ON projects USING gin(to_tsvector('english', name || ' ' || client_name)) 
WHERE deleted_at IS NULL;

-- =============================================================================
-- DOCUMENTS TABLE INDEXES
-- =============================================================================

-- Index for project document listings
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_documents_project_uploaded 
ON documents(project_id, uploaded_at DESC) WHERE deleted_at IS NULL;

-- Index for processed document queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_documents_project_processed 
ON documents(project_id, is_processed) WHERE deleted_at IS NULL;

-- Index for document version management
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_documents_group_version 
ON documents(project_id, group_id, version DESC) WHERE deleted_at IS NULL;

-- =============================================================================
-- DOCUMENT CHUNKS TABLE INDEXES (Critical for RAG performance)
-- =============================================================================

-- Vector similarity search index (most important for RAG)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_document_chunks_embedding 
ON document_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Index for document chunk retrieval
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_document_chunks_document 
ON document_chunks(document_id, chunk_index);

-- Index for company-wide chunk search
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_document_chunks_company 
ON document_chunks(company_id);

-- Composite index for filtered vector search
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_document_chunks_company_doc 
ON document_chunks(company_id, document_id);

-- =============================================================================
-- KNOWLEDGE BASE INDEXES
-- =============================================================================

-- Vector similarity search for knowledge base
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_knowledge_chunks_embedding 
ON knowledge_base_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 50);

-- Index for knowledge base document management
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_knowledge_docs_company_processed 
ON knowledge_base_documents(company_id, is_processed, uploaded_at DESC);

-- Index for knowledge base chunk retrieval
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_knowledge_chunks_company 
ON knowledge_base_chunks(company_id, document_id, chunk_index);

-- =============================================================================
-- BIDS TABLE INDEXES
-- =============================================================================

-- Index for project bid history (latest bid queries)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bids_project_latest 
ON bids(project_id, is_latest, created_at DESC) WHERE deleted_at IS NULL;

-- Index for company bid analytics
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bids_company_created 
ON bids(company_id, created_at DESC) WHERE deleted_at IS NULL;

-- Index for bid sharing functionality
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bids_share_token 
ON bids(share_token) WHERE share_token IS NOT NULL AND deleted_at IS NULL;

-- Index for user bid tracking
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bids_user_created 
ON bids(user_id, created_at DESC) WHERE deleted_at IS NULL;

-- =============================================================================
-- RFP ANALYSIS TABLE INDEXES
-- =============================================================================

-- Index for project analysis retrieval
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_rfp_analyses_project 
ON rfp_analyses(project_id, analyzed_at DESC);

-- Index for risk-based analysis filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_rfp_analyses_risk 
ON rfp_analyses(overall_risk_level, quality_score DESC);

-- =============================================================================
-- CONFLICT DETECTION INDEXES
-- =============================================================================

-- Index for project conflict retrieval
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_conflicts_project_status 
ON document_conflicts(project_id, status, detected_at DESC);

-- Index for conflict severity filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_conflicts_severity_type 
ON document_conflicts(severity, conflict_type, detected_at DESC);

-- Index for conflict resolution tracking
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_conflicts_resolved 
ON document_conflicts(resolved_by, resolved_at DESC) WHERE resolved_at IS NOT NULL;

-- Index for conflict detection runs
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_conflict_runs_project 
ON conflict_detection_runs(project_id, started_at DESC);

-- =============================================================================
-- AI INSTRUCTIONS TABLE INDEXES
-- =============================================================================

-- Index for company AI instructions
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ai_instructions_company 
ON ai_instructions(company_id, is_default DESC, created_at DESC);

-- =============================================================================
-- TEMPLATES TABLE INDEXES
-- =============================================================================

-- Index for company templates by category
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_templates_company_category 
ON templates(company_id, category, updated_at DESC);

-- =============================================================================
-- AUDIT AND LOGGING INDEXES
-- =============================================================================

-- Index for audit logs by user and time
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_user_time 
ON audit_logs(user_id, created_at DESC);

-- Index for audit logs by resource
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_resource 
ON audit_logs(resource_type, resource_id, created_at DESC);

-- Index for audit logs by project
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_project 
ON audit_logs(project_id, created_at DESC);

-- Index for audit logs by action type
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_action 
ON audit_logs(action, created_at DESC);

-- =============================================================================
-- AGENT EXECUTION INDEXES
-- =============================================================================

-- Index for agent execution tracking
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_agent_executions_project 
ON agent_executions(project_id, started_at DESC);

-- Index for agent performance monitoring
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_agent_executions_agent_status 
ON agent_executions(agent_name, status, started_at DESC);

-- Index for agent states
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_agent_states_project 
ON agent_states(project_id, updated_at DESC);

-- =============================================================================
-- WIN PROBABILITY INDEXES
-- =============================================================================

-- Index for project win probability tracking
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_win_predictions_project 
ON win_probability_predictions(project_id, prediction_date DESC);

-- Index for project features
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_project_features_project 
ON project_features(project_id, extracted_at DESC);

-- Index for bid outcomes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bid_outcomes_project 
ON bid_outcomes(project_id, recorded_at DESC);

-- =============================================================================
-- TEAM COLLABORATION INDEXES
-- =============================================================================

-- Index for project team members
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_project_team_project_user 
ON project_team_members(project_id, user_id, added_at DESC);

-- Index for user project access
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_project_team_user_role 
ON project_team_members(user_id, role, last_accessed_at DESC);

-- Index for team activity feed
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_team_activity_project 
ON team_activity(project_id, created_at DESC);

-- Index for user presence tracking
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_presence_project 
ON user_presence(project_id, last_active_at DESC);

-- =============================================================================
-- COMPANY INVITATIONS INDEXES
-- =============================================================================

-- Index for company invitation management
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_company_invites_company_status 
ON company_invites(company_id, status, created_at DESC);

-- Index for invitation code lookup
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_company_invites_code 
ON company_invites(invite_code) WHERE status = 'pending';

-- Index for expired invitation cleanup
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_company_invites_expired 
ON company_invites(expires_at) WHERE expires_at <= NOW() AND status = 'pending';

-- =============================================================================
-- CLEANUP INDEXES FOR MAINTENANCE
-- =============================================================================

-- Index for session cleanup
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sessions_cleanup 
ON sessions(expires_at) WHERE expires_at < NOW();

-- Index for temporary file cleanup
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_temp_files_cleanup 
ON documents(uploaded_at) WHERE deleted_at < NOW() - INTERVAL '7 days';

-- =============================================================================
-- PERFORMANCE MONITORING VIEWS
-- =============================================================================

-- Create a view for monitoring slow queries
CREATE OR REPLACE VIEW slow_query_monitor AS
SELECT 
    schemaname,
    tablename,
    attname,
    n_distinct,
    correlation,
    most_common_vals
FROM pg_stats 
WHERE schemaname = 'public' 
    AND n_distinct > 0 
ORDER BY abs(correlation) DESC;

-- Create a view for index usage statistics
CREATE OR REPLACE VIEW index_usage_stats AS
SELECT 
    t.tablename,
    indexname,
    c.reltuples::bigint AS num_rows,
    pg_size_pretty(pg_relation_size(indexrelname::regclass)) AS index_size,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch,
    CASE WHEN idx_scan = 0 THEN 'Unused'
         WHEN idx_scan < 10 THEN 'Low usage'
         ELSE 'Active'
    END AS usage_status
FROM pg_tables t
LEFT OUTER JOIN pg_class c ON c.relname = t.tablename
LEFT OUTER JOIN (
    SELECT 
        c.relname AS ctablename,
        ipg.relname AS indexname,
        x.indnatts AS number_of_columns,
        idx_scan,
        idx_tup_read,
        idx_tup_fetch
    FROM pg_index x
    JOIN pg_class c ON c.oid = x.indrelid
    JOIN pg_class ipg ON ipg.oid = x.indexrelid
    JOIN pg_stat_all_indexes psai ON x.indexrelid = psai.indexrelid
) AS foo ON t.tablename = foo.ctablename
WHERE t.schemaname = 'public'
ORDER BY t.tablename, indexname;

-- =============================================================================
-- MAINTENANCE PROCEDURES
-- =============================================================================

-- Function to analyze table statistics
CREATE OR REPLACE FUNCTION analyze_bidforge_tables()
RETURNS void AS $$
BEGIN
    -- Update table statistics for better query planning
    ANALYZE companies;
    ANALYZE users;
    ANALYZE sessions;
    ANALYZE projects;
    ANALYZE documents;
    ANALYZE document_chunks;
    ANALYZE knowledge_base_documents;
    ANALYZE knowledge_base_chunks;
    ANALYZE bids;
    ANALYZE rfp_analyses;
    ANALYZE document_conflicts;
    ANALYZE audit_logs;
    ANALYZE agent_executions;
    ANALYZE win_probability_predictions;
    ANALYZE project_features;
    ANALYZE bid_outcomes;
    
    RAISE NOTICE 'Table statistics updated successfully';
END;
$$ LANGUAGE plpgsql;

-- Function to clean up expired sessions
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS integer AS $$
DECLARE
    deleted_count integer;
BEGIN
    DELETE FROM sessions WHERE expires_at < NOW();
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    RAISE NOTICE 'Cleaned up % expired sessions', deleted_count;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- VACUUM AND MAINTENANCE RECOMMENDATIONS
-- =============================================================================

-- Note: Run these commands periodically for optimal performance:

-- VACUUM ANALYZE; -- Updates statistics and reclaims space
-- REINDEX INDEX CONCURRENTLY idx_document_chunks_embedding; -- Rebuild vector index
-- REINDEX INDEX CONCURRENTLY idx_knowledge_chunks_embedding; -- Rebuild knowledge vector index

-- Monitor index bloat:
-- SELECT schemaname, tablename, attname, n_distinct, correlation
-- FROM pg_stats 
-- WHERE schemaname = 'public' AND correlation < 0.1;

-- Check for unused indexes:
-- SELECT * FROM index_usage_stats WHERE usage_status = 'Unused';

RAISE NOTICE 'BidForge AI database optimization completed successfully';
RAISE NOTICE 'Run ANALYZE to update statistics after index creation';
RAISE NOTICE 'Monitor performance with the created views: slow_query_monitor, index_usage_stats';