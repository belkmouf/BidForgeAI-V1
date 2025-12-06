import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import AdmZip from 'adm-zip';
import { pool } from '../db';
import { generateEmbedding } from './openai.js';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';

// PDF parsing - use dynamic import to avoid ESM/CJS issues
async function parsePdf(buffer: Buffer): Promise<{ text: string }> {
  try {
    const pdfParse = (await import('pdf-parse')).default;
    const result = await pdfParse(buffer);
    return { text: result.text || '' };
  } catch (error: any) {
    console.error('PDF parse error:', error);
    return { text: `[PDF content could not be extracted: ${error.message}]` };
  }
}

const CHUNK_SIZE = 2000;
const CHUNK_OVERLAP = 200;

interface ProcessedFile {
  documentId: number;
  filename: string;
  chunksCreated: number;
}

export class IngestionService {
  private tempDirs: string[] = [];

  async processFile(
    buffer: Buffer,
    filename: string,
    projectId: string
  ): Promise<ProcessedFile[]> {
    const results: ProcessedFile[] = [];
    const ext = path.extname(filename).toLowerCase();

    try {
      if (ext === '.pdf') {
        const result = await this.processPdf(buffer, filename, projectId);
        results.push(result);
      } else if (ext === '.zip') {
        const zipResults = await this.processZip(buffer, filename, projectId);
        results.push(...zipResults);
      } else if (ext === '.msg') {
        const msgResults = await this.processMsg(buffer, filename, projectId);
        results.push(...msgResults);
      } else if (ext === '.txt' || ext === '.doc' || ext === '.docx') {
        const result = await this.processText(buffer, filename, projectId);
        results.push(result);
      } else {
        const result = await this.processText(buffer, filename, projectId);
        results.push(result);
      }
    } finally {
      this.cleanupTempDirs();
    }

    return results;
  }

  private async processPdf(
    buffer: Buffer,
    filename: string,
    projectId: string
  ): Promise<ProcessedFile> {
    let text = '';
    
    try {
      const data = await parsePdf(buffer);
      text = data.text || '';
    } catch (error) {
      console.error(`PDF parsing error for ${filename}:`, error);
      text = buffer.toString('utf-8', 0, Math.min(buffer.length, 10000));
    }

    return this.createDocumentWithChunks(projectId, filename, text);
  }

  private async processZip(
    buffer: Buffer,
    filename: string,
    projectId: string
  ): Promise<ProcessedFile[]> {
    const results: ProcessedFile[] = [];
    const tempDir = this.createTempDir();
    const resolvedTempDir = path.resolve(tempDir);

    try {
      const zip = new AdmZip(buffer);
      const entries = zip.getEntries();
      
      // SECURITY FIX (CWE-22): Extract ONLY validated entries one by one
      // This prevents path traversal attacks by validating before any disk writes
      for (const entry of entries) {
        const entryName = entry.entryName;
        
        // Skip directories
        if (entry.isDirectory) {
          continue;
        }
        
        // Block entries with path traversal patterns
        if (entryName.includes('..') || 
            entryName.startsWith('/') || 
            entryName.startsWith('\\') ||
            /^[a-zA-Z]:/.test(entryName)) {
          console.warn(`SECURITY: Blocked malicious ZIP entry: ${entryName}`);
          continue;
        }
        
        // Resolve the target path and verify it's within tempDir
        const targetPath = path.resolve(tempDir, entryName);
        
        if (!targetPath.startsWith(resolvedTempDir + path.sep)) {
          console.warn(`SECURITY: Blocked path traversal attempt: ${entryName} -> ${targetPath}`);
          continue;
        }
        
        // Only extract validated entries - get file data directly from ZIP
        try {
          const fileBuffer = entry.getData();
          const fileName = path.basename(entryName);
          
          // Process directly from memory without writing to disk first
          const fileResults = await this.processFile(fileBuffer, fileName, projectId);
          results.push(...fileResults);
        } catch (error) {
          console.error(`Failed to process ${entryName} from ZIP:`, error);
        }
      }
    } catch (error) {
      console.error(`ZIP processing error for ${filename}:`, error);
    }

    return results;
  }

  private async processMsg(
    buffer: Buffer,
    filename: string,
    projectId: string
  ): Promise<ProcessedFile[]> {
    const results: ProcessedFile[] = [];
    
    try {
      const textContent = this.extractMsgText(buffer);
      
      if (textContent.trim()) {
        const result = await this.createDocumentWithChunks(projectId, filename, textContent);
        results.push(result);
      }
      
      const attachments = this.extractMsgAttachments(buffer);
      for (const attachment of attachments) {
        try {
          const attachmentResults = await this.processFile(
            attachment.data,
            attachment.filename,
            projectId
          );
          results.push(...attachmentResults);
        } catch (error) {
          console.error(`Failed to process MSG attachment ${attachment.filename}:`, error);
        }
      }
    } catch (error) {
      console.error(`MSG processing error for ${filename}:`, error);
      const result = await this.processText(buffer, filename, projectId);
      results.push(result);
    }

    return results;
  }

  private extractMsgText(buffer: Buffer): string {
    try {
      const content = buffer.toString('utf-8');
      const textMatch = content.match(/[\x20-\x7E\n\r\t]{50,}/g);
      if (textMatch) {
        return textMatch.join('\n').substring(0, 50000);
      }
      return content.substring(0, 10000);
    } catch {
      return '';
    }
  }

  private extractMsgAttachments(buffer: Buffer): Array<{ filename: string; data: Buffer }> {
    const attachments: Array<{ filename: string; data: Buffer }> = [];
    
    try {
      const content = buffer.toString('binary');
      
      const pdfStartPattern = '%PDF-';
      let pdfStart = content.indexOf(pdfStartPattern);
      
      while (pdfStart !== -1) {
        const pdfEnd = content.indexOf('%%EOF', pdfStart);
        if (pdfEnd !== -1) {
          const pdfData = Buffer.from(content.substring(pdfStart, pdfEnd + 5), 'binary');
          attachments.push({
            filename: `attachment_${attachments.length + 1}.pdf`,
            data: pdfData
          });
        }
        pdfStart = content.indexOf(pdfStartPattern, pdfStart + 1);
      }
    } catch (error) {
      console.error('Error extracting MSG attachments:', error);
    }
    
    return attachments;
  }

  private async processText(
    buffer: Buffer,
    filename: string,
    projectId: string
  ): Promise<ProcessedFile> {
    const text = buffer.toString('utf-8', 0, Math.min(buffer.length, 50000));
    return this.createDocumentWithChunks(projectId, filename, text);
  }

  private async createDocumentWithChunks(
    projectId: string,
    filename: string,
    content: string
  ): Promise<ProcessedFile> {
    const chunks = await this.chunkTextSemantic(content);
    
    // Use a transaction to ensure atomic document + chunk creation
    const client = await pool.connect();
    let documentId: number;
    
    try {
      await client.query('BEGIN');
      
      // Create the document
      const docResult = await client.query(
        `INSERT INTO documents (project_id, filename, content, is_processed) 
         VALUES ($1, $2, $3, $4) 
         RETURNING id`,
        [projectId, filename, content.substring(0, 10000), false]
      );
      documentId = docResult.rows[0].id;

      // Create chunks with embeddings
      console.log(`Generating embeddings for ${chunks.length} chunks from ${filename}...`);
      
      for (let i = 0; i < chunks.length; i++) {
        try {
          // Generate embedding for this chunk
          const embedding = await generateEmbedding(chunks[i]);
          
          // Convert embedding array to PostgreSQL vector format
          const embeddingStr = `[${embedding.join(',')}]`;
          
          await client.query(
            `INSERT INTO document_chunks (document_id, content, chunk_index, embedding) 
             VALUES ($1, $2, $3, $4::vector)`,
            [documentId, chunks[i], i, embeddingStr]
          );
          
          // Log progress for large documents
          if ((i + 1) % 10 === 0 || i === chunks.length - 1) {
            console.log(`  Generated ${i + 1}/${chunks.length} embeddings for ${filename}`);
          }
        } catch (embeddingError) {
          console.error(`Failed to generate embedding for chunk ${i} of ${filename}:`, embeddingError);
          // Insert chunk without embedding as fallback
          await client.query(
            `INSERT INTO document_chunks (document_id, content, chunk_index) 
             VALUES ($1, $2, $3)`,
            [documentId, chunks[i], i]
          );
        }
      }

      // Mark document as processed
      await client.query(
        `UPDATE documents SET is_processed = true WHERE id = $1`,
        [documentId]
      );

      await client.query('COMMIT');
      console.log(`✅ Successfully processed ${filename} with ${chunks.length} chunks`);
    } catch (error) {
      await client.query('ROLLBACK');
      console.error(`Transaction failed for ${filename}, rolling back:`, error);
      throw new Error(`Document ingestion failed for ${filename}: ${error}`);
    } finally {
      client.release();
    }

    return {
      documentId,
      filename,
      chunksCreated: chunks.length,
    };
  }

  private async chunkTextSemantic(text: string): Promise<string[]> {
    const cleanText = text.replace(/\s+/g, ' ').trim();
    
    if (!cleanText || cleanText.length < 50) return [];

    try {
      const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: CHUNK_SIZE,
        chunkOverlap: CHUNK_OVERLAP,
        separators: ['\n\n', '\n', '. ', '! ', '? ', '; ', ', ', ' ', ''],
      });
      
      const chunks = await splitter.splitText(cleanText);
      return chunks.filter(chunk => chunk.trim().length > 50);
    } catch (error) {
      console.warn('Semantic chunking failed, falling back to simple chunking:', error);
      return this.chunkTextSimple(cleanText);
    }
  }

  private chunkTextSimple(text: string): string[] {
    const chunks: string[] = [];
    const cleanText = text.replace(/\s+/g, ' ').trim();
    
    if (!cleanText) return chunks;

    for (let i = 0; i < cleanText.length; i += CHUNK_SIZE - CHUNK_OVERLAP) {
      const chunk = cleanText.substring(i, i + CHUNK_SIZE).trim();
      if (chunk.length > 50) {
        chunks.push(chunk);
      }
    }

    return chunks;
  }

  private chunkText(text: string): string[] {
    return this.chunkTextSimple(text);
  }

  private createTempDir(): string {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bidforge-'));
    this.tempDirs.push(tempDir);
    return tempDir;
  }

  private getAllFiles(dir: string): string[] {
    const files: string[] = [];
    
    const items = fs.readdirSync(dir, { withFileTypes: true });
    for (const item of items) {
      const fullPath = path.join(dir, item.name);
      if (item.isDirectory()) {
        files.push(...this.getAllFiles(fullPath));
      } else {
        files.push(fullPath);
      }
    }
    
    return files;
  }

  private cleanupTempDirs(): void {
    for (const dir of this.tempDirs) {
      try {
        fs.rmSync(dir, { recursive: true, force: true });
      } catch (error) {
        console.error(`Failed to cleanup temp dir ${dir}:`, error);
      }
    }
    this.tempDirs = [];
  }
}

export const ingestionService = new IngestionService();
