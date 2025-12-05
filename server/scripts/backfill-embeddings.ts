#!/usr/bin/env tsx
import { db } from '../db.js';
import { documentChunks } from '../../shared/schema.js';
import { isNull, sql, count } from 'drizzle-orm';
import { generateEmbedding } from '../lib/openai.js';

async function backfillEmbeddings() {
  console.log('🔍 Starting embedding backfill process...\n');

  try {
    const [countResult] = await db
      .select({ count: count() })
      .from(documentChunks)
      .where(isNull(documentChunks.embedding));

    const totalChunks = countResult.count;

    if (totalChunks === 0) {
      console.log('✅ All chunks already have embeddings!');
      process.exit(0);
    }

    console.log(`📊 Found ${totalChunks} chunks without embeddings\n`);

    const batchSize = 50;
    let processed = 0;
    let succeeded = 0;
    let failed = 0;

    while (processed < totalChunks) {
      const chunks = await db
        .select({ id: documentChunks.id, content: documentChunks.content })
        .from(documentChunks)
        .where(isNull(documentChunks.embedding))
        .limit(batchSize);

      if (chunks.length === 0) break;

      console.log(`\n🔄 Processing batch: ${processed + 1}-${processed + chunks.length} of ${totalChunks}`);

      for (const chunk of chunks) {
        try {
          const embedding = await generateEmbedding(chunk.content);
          const embeddingStr = `[${embedding.join(',')}]`;

          await db.execute(sql`
            UPDATE document_chunks 
            SET embedding = ${embeddingStr}::vector 
            WHERE id = ${chunk.id}
          `);

          succeeded++;
          processed++;

          if (processed % 10 === 0) {
            const progress = ((processed / totalChunks) * 100).toFixed(1);
            console.log(`  ✓ ${processed}/${totalChunks} (${progress}%)`);
          }

          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error: any) {
          failed++;
          processed++;
          console.error(`  ✗ Failed chunk ${chunk.id}:`, error.message);
        }
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log(`✅ Successfully processed: ${succeeded} chunks`);
    console.log(`❌ Failed: ${failed} chunks`);
    console.log('='.repeat(60));

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  }
}

backfillEmbeddings();
