#!/usr/bin/env tsx
import { db } from '../db.js';
import { documentChunks, documents, projects } from '../../shared/schema.js';
import { isNull, isNotNull, sql, count } from 'drizzle-orm';

async function showRAGStats() {
  console.log('\n' + '='.repeat(70));
  console.log('🤖 BidForge AI - RAG System Statistics');
  console.log('='.repeat(70) + '\n');

  try {
    const [totalChunksResult] = await db.select({ count: count() }).from(documentChunks);
    const totalChunks = totalChunksResult.count;

    const [withEmbeddingsResult] = await db
      .select({ count: count() })
      .from(documentChunks)
      .where(isNotNull(documentChunks.embedding));
    const withEmbeddings = withEmbeddingsResult.count;

    const [withoutEmbeddingsResult] = await db
      .select({ count: count() })
      .from(documentChunks)
      .where(isNull(documentChunks.embedding));
    const withoutEmbeddings = withoutEmbeddingsResult.count;

    const coverageNum = totalChunks > 0 ? (withEmbeddings / totalChunks) * 100 : 0;
    const coverage = coverageNum.toFixed(1);

    const [totalDocsResult] = await db.select({ count: count() }).from(documents);
    const [totalProjectsResult] = await db.select({ count: count() }).from(projects);

    console.log('📊 DOCUMENT STATISTICS');
    console.log('-'.repeat(70));
    console.log(`  Total Projects:  ${totalProjectsResult.count}`);
    console.log(`  Total Documents: ${totalDocsResult.count}`);
    console.log(`  Total Chunks:    ${totalChunks}`);
    console.log();

    console.log('🎯 EMBEDDING COVERAGE');
    console.log('-'.repeat(70));
    console.log(`  Chunks with Embeddings:    ${withEmbeddings} ✅`);
    console.log(`  Chunks without Embeddings: ${withoutEmbeddings} ${withoutEmbeddings > 0 ? '⚠️' : '✅'}`);
    console.log(`  Coverage:                  ${coverage}%`);
    console.log();

    if (coverageNum >= 100) {
      console.log('✅ RAG SYSTEM STATUS: FULLY OPERATIONAL');
    } else if (coverageNum >= 50) {
      console.log('⚠️  RAG SYSTEM STATUS: PARTIALLY OPERATIONAL');
      console.log(`   Run: npm run backfill:embeddings`);
    } else {
      console.log('❌ RAG SYSTEM STATUS: NOT OPERATIONAL');
      console.log('   Run: npm run backfill:embeddings');
    }
    console.log();

    console.log('ℹ️  SYSTEM INFO');
    console.log('-'.repeat(70));
    console.log('  Embedding Model:    text-embedding-3-small (OpenAI)');
    console.log('  Vector Dimensions:  1536');
    console.log('  Search Method:      Cosine Similarity (pgvector)');
    console.log();
    console.log('='.repeat(70) + '\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }
}

showRAGStats();
