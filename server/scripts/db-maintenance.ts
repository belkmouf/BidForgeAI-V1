import { db } from '../db.js';
import { sql } from 'drizzle-orm';
import { logger, logContext } from '../lib/logger.js';
import { readFileSync } from 'fs';
import { join } from 'path';

export class DatabaseMaintenance {
  
  /**
   * Run database optimization script
   */
  async optimizeDatabase(): Promise<void> {
    const startTime = Date.now();
    
    try {
      logger.info('Starting database optimization...');
      
      // Read and execute the optimization SQL script
      const scriptPath = join(process.cwd(), 'server', 'scripts', 'optimize-database.sql');
      const optimizationScript = readFileSync(scriptPath, 'utf-8');
      
      // Split script into individual statements and execute them
      const statements = optimizationScript
        .split(';\n')
        .map(stmt => stmt.trim())
        .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
      
      let successCount = 0;
      let errorCount = 0;
      
      for (const statement of statements) {
        try {
          if (statement.toLowerCase().includes('create index')) {
            logger.info('Creating index...', { statement: statement.substring(0, 100) + '...' });
          }
          
          await db.execute(sql.raw(statement));
          successCount++;
        } catch (error: any) {
          // Some errors are expected (like index already exists)
          if (error.message.includes('already exists')) {
            logger.info('Index already exists, skipping', { error: error.message });
            successCount++;
          } else {
            logger.error('Failed to execute statement', { 
              error: error.message,
              statement: statement.substring(0, 200)
            });
            errorCount++;
          }
        }
      }
      
      const duration = Date.now() - startTime;
      
      logContext.database('Database optimization completed', {
        operation: 'optimize_database',
        duration,
        success: errorCount === 0,
        metadata: { successCount, errorCount }
      });
      
      logger.info('Database optimization completed', { 
        duration: `${duration}ms`,
        successCount,
        errorCount
      });
      
    } catch (error: any) {
      const duration = Date.now() - startTime;
      
      logContext.database('Database optimization failed', {
        operation: 'optimize_database',
        duration,
        success: false,
        error: error.message
      });
      
      logger.error('Database optimization failed', { 
        error: error.message,
        duration: `${duration}ms`
      });
      
      throw error;
    }
  }

  /**
   * Analyze database tables for better query planning
   */
  async analyzeDatabase(): Promise<void> {
    const startTime = Date.now();
    
    try {
      logger.info('Starting database analysis...');
      
      await db.execute(sql`SELECT analyze_bidforge_tables()`);
      
      const duration = Date.now() - startTime;
      
      logContext.database('Database analysis completed', {
        operation: 'analyze_database',
        duration,
        success: true
      });
      
      logger.info('Database analysis completed', { duration: `${duration}ms` });
      
    } catch (error: any) {
      const duration = Date.now() - startTime;
      
      logContext.database('Database analysis failed', {
        operation: 'analyze_database',
        duration,
        success: false,
        error: error.message
      });
      
      logger.error('Database analysis failed', { 
        error: error.message,
        duration: `${duration}ms`
      });
      
      throw error;
    }
  }

  /**
   * Clean up expired sessions and temporary data
   */
  async cleanupExpiredData(): Promise<void> {
    const startTime = Date.now();
    
    try {
      logger.info('Starting expired data cleanup...');
      
      // Clean up expired sessions
      const sessionResult = await db.execute(sql`SELECT cleanup_expired_sessions()`);
      
      // Clean up old audit logs (keep last 90 days)
      const auditResult = await db.execute(sql`
        DELETE FROM audit_logs 
        WHERE created_at < NOW() - INTERVAL '90 days'
      `);
      
      // Clean up old agent executions (keep last 30 days)
      const agentResult = await db.execute(sql`
        DELETE FROM agent_executions 
        WHERE started_at < NOW() - INTERVAL '30 days'
      `);
      
      // Clean up old conflict detection runs (keep last 30 days)
      const conflictRunsResult = await db.execute(sql`
        DELETE FROM conflict_detection_runs 
        WHERE started_at < NOW() - INTERVAL '30 days'
      `);
      
      const duration = Date.now() - startTime;
      
      logContext.database('Expired data cleanup completed', {
        operation: 'cleanup_expired_data',
        duration,
        success: true,
        metadata: {
          sessionsDeleted: sessionResult.rowCount || 0,
          auditLogsDeleted: auditResult.rowCount || 0,
          agentExecutionsDeleted: agentResult.rowCount || 0,
          conflictRunsDeleted: conflictRunsResult.rowCount || 0
        }
      });
      
      logger.info('Expired data cleanup completed', { 
        duration: `${duration}ms`,
        sessionsDeleted: sessionResult.rowCount || 0,
        auditLogsDeleted: auditResult.rowCount || 0,
        agentExecutionsDeleted: agentResult.rowCount || 0,
        conflictRunsDeleted: conflictRunsResult.rowCount || 0
      });
      
    } catch (error: any) {
      const duration = Date.now() - startTime;
      
      logContext.database('Expired data cleanup failed', {
        operation: 'cleanup_expired_data',
        duration,
        success: false,
        error: error.message
      });
      
      logger.error('Expired data cleanup failed', { 
        error: error.message,
        duration: `${duration}ms`
      });
      
      throw error;
    }
  }

  /**
   * Get database performance statistics
   */
  async getDatabaseStats(): Promise<any> {
    try {
      logger.info('Fetching database statistics...');
      
      // Get index usage statistics
      const indexStats = await db.execute(sql`SELECT * FROM index_usage_stats ORDER BY tablename, indexname`);
      
      // Get table sizes
      const tableSizes = await db.execute(sql`
        SELECT 
          tablename,
          pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
          pg_total_relation_size(schemaname||'.'||tablename) AS size_bytes
        FROM pg_tables 
        WHERE schemaname = 'public'
        ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
      `);
      
      // Get slow query information
      const slowQueries = await db.execute(sql`SELECT * FROM slow_query_monitor LIMIT 20`);
      
      // Get database connections
      const connections = await db.execute(sql`
        SELECT 
          datname,
          numbackends,
          xact_commit,
          xact_rollback,
          blks_read,
          blks_hit,
          temp_files,
          temp_bytes
        FROM pg_stat_database 
        WHERE datname = current_database()
      `);
      
      // Get cache hit ratio
      const cacheHitRatio = await db.execute(sql`
        SELECT 
          round(
            (sum(blks_hit) / (sum(blks_hit) + sum(blks_read))) * 100, 2
          ) AS cache_hit_ratio
        FROM pg_stat_database 
        WHERE datname = current_database()
      `);
      
      const stats = {
        indexUsage: indexStats.rows,
        tableSizes: tableSizes.rows,
        slowQueries: slowQueries.rows,
        connections: connections.rows[0] || {},
        cacheHitRatio: cacheHitRatio.rows[0]?.cache_hit_ratio || 0,
        timestamp: new Date().toISOString()
      };
      
      logger.info('Database statistics fetched successfully', {
        indexCount: indexStats.rows?.length || 0,
        tableCount: tableSizes.rows?.length || 0,
        cacheHitRatio: stats.cacheHitRatio
      });
      
      return stats;
      
    } catch (error: any) {
      logger.error('Failed to fetch database statistics', { error: error.message });
      throw error;
    }
  }

  /**
   * Vacuum analyze specific tables for performance
   */
  async vacuumAnalyze(tables?: string[]): Promise<void> {
    const startTime = Date.now();
    const defaultTables = [
      'companies',
      'users', 
      'sessions',
      'projects',
      'documents',
      'document_chunks',
      'knowledge_base_documents',
      'knowledge_base_chunks',
      'bids',
      'rfp_analyses',
      'document_conflicts',
      'audit_logs'
    ];
    
    const tablesToVacuum = tables || defaultTables;
    
    try {
      logger.info('Starting VACUUM ANALYZE...', { tables: tablesToVacuum });
      
      for (const table of tablesToVacuum) {
        try {
          await db.execute(sql.raw(`VACUUM ANALYZE ${table}`));
          logger.info(`VACUUM ANALYZE completed for ${table}`);
        } catch (error: any) {
          logger.error(`Failed to VACUUM ANALYZE ${table}`, { error: error.message });
        }
      }
      
      const duration = Date.now() - startTime;
      
      logContext.database('VACUUM ANALYZE completed', {
        operation: 'vacuum_analyze',
        duration,
        success: true,
        metadata: { tablesProcessed: tablesToVacuum.length }
      });
      
      logger.info('VACUUM ANALYZE completed for all tables', { 
        duration: `${duration}ms`,
        tablesProcessed: tablesToVacuum.length 
      });
      
    } catch (error: any) {
      const duration = Date.now() - startTime;
      
      logContext.database('VACUUM ANALYZE failed', {
        operation: 'vacuum_analyze',
        duration,
        success: false,
        error: error.message
      });
      
      logger.error('VACUUM ANALYZE failed', { 
        error: error.message,
        duration: `${duration}ms`
      });
      
      throw error;
    }
  }

  /**
   * Check database health and performance
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'warning' | 'critical';
    checks: Array<{ name: string; status: string; message?: string; value?: any }>;
  }> {
    const checks = [];
    let overallStatus: 'healthy' | 'warning' | 'critical' = 'healthy';
    
    try {
      // Check database connection
      await db.execute(sql`SELECT 1`);
      checks.push({ name: 'database_connection', status: 'healthy' });
      
      // Check cache hit ratio
      const cacheResult = await db.execute(sql`
        SELECT round(
          (sum(blks_hit) / (sum(blks_hit) + sum(blks_read))) * 100, 2
        ) AS ratio
        FROM pg_stat_database WHERE datname = current_database()
      `);
      
      const cacheRatio = cacheResult.rows[0]?.ratio || 0;
      if (cacheRatio < 90) {
        overallStatus = 'warning';
        checks.push({ 
          name: 'cache_hit_ratio', 
          status: 'warning', 
          message: 'Cache hit ratio below 90%',
          value: `${cacheRatio}%`
        });
      } else {
        checks.push({ 
          name: 'cache_hit_ratio', 
          status: 'healthy',
          value: `${cacheRatio}%`
        });
      }
      
      // Check for unused indexes
      const unusedIndexes = await db.execute(sql`
        SELECT COUNT(*) as count FROM index_usage_stats WHERE usage_status = 'Unused'
      `);
      
      const unusedCount = unusedIndexes.rows[0]?.count || 0;
      if (unusedCount > 5) {
        overallStatus = 'warning';
        checks.push({ 
          name: 'unused_indexes', 
          status: 'warning',
          message: 'High number of unused indexes',
          value: unusedCount
        });
      } else {
        checks.push({ 
          name: 'unused_indexes', 
          status: 'healthy',
          value: unusedCount
        });
      }
      
      // Check connection count
      const connections = await db.execute(sql`
        SELECT count(*) as active_connections 
        FROM pg_stat_activity 
        WHERE datname = current_database()
      `);
      
      const activeConnections = connections.rows[0]?.active_connections || 0;
      if (activeConnections > 50) {
        overallStatus = 'warning';
        checks.push({ 
          name: 'active_connections', 
          status: 'warning',
          message: 'High number of active connections',
          value: activeConnections
        });
      } else {
        checks.push({ 
          name: 'active_connections', 
          status: 'healthy',
          value: activeConnections
        });
      }
      
      // Check table bloat (simplified check)
      const largestTables = await db.execute(sql`
        SELECT tablename, pg_total_relation_size(schemaname||'.'||tablename) as size
        FROM pg_tables 
        WHERE schemaname = 'public'
        ORDER BY size DESC
        LIMIT 5
      `);
      
      checks.push({ 
        name: 'largest_tables', 
        status: 'info',
        value: largestTables.rows?.map(r => `${r.tablename}: ${Math.round(r.size / 1024 / 1024)}MB`)
      });
      
    } catch (error: any) {
      overallStatus = 'critical';
      checks.push({ 
        name: 'health_check', 
        status: 'critical',
        message: error.message
      });
    }
    
    logger.info('Database health check completed', { 
      status: overallStatus,
      checkCount: checks.length
    });
    
    return { status: overallStatus, checks };
  }

  /**
   * Run full maintenance routine
   */
  async runFullMaintenance(): Promise<void> {
    logger.info('Starting full database maintenance...');
    
    try {
      // 1. Clean up expired data
      await this.cleanupExpiredData();
      
      // 2. Analyze tables
      await this.analyzeDatabase();
      
      // 3. Vacuum analyze critical tables
      await this.vacuumAnalyze(['document_chunks', 'knowledge_base_chunks', 'bids', 'sessions']);
      
      // 4. Get health check
      const health = await this.healthCheck();
      
      logger.info('Full database maintenance completed', { 
        healthStatus: health.status,
        checksCount: health.checks.length
      });
      
    } catch (error: any) {
      logger.error('Full database maintenance failed', { error: error.message });
      throw error;
    }
  }
}

// CLI interface for running maintenance tasks
if (require.main === module) {
  const maintenance = new DatabaseMaintenance();
  const command = process.argv[2];
  
  switch (command) {
    case 'optimize':
      maintenance.optimizeDatabase().catch(console.error);
      break;
    case 'analyze':
      maintenance.analyzeDatabase().catch(console.error);
      break;
    case 'cleanup':
      maintenance.cleanupExpiredData().catch(console.error);
      break;
    case 'vacuum':
      maintenance.vacuumAnalyze().catch(console.error);
      break;
    case 'health':
      maintenance.healthCheck().then(console.log).catch(console.error);
      break;
    case 'stats':
      maintenance.getDatabaseStats().then(console.log).catch(console.error);
      break;
    case 'full':
      maintenance.runFullMaintenance().catch(console.error);
      break;
    default:
      console.log('Usage: node db-maintenance.js [optimize|analyze|cleanup|vacuum|health|stats|full]');
      break;
  }
}

export default DatabaseMaintenance;