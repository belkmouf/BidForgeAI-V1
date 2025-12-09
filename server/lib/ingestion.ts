import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import AdmZip from 'adm-zip';
import MsgReaderModule from '@kenjiuno/msgreader';
const MsgReader = (MsgReaderModule as any).default || MsgReaderModule;
import mammoth from 'mammoth';
import { pool } from '../db';
import { generateEmbedding } from './openai.js';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';

// PDF parsing - use pdf-parse with PDFParse class
async function parsePdf(buffer: Buffer): Promise<{ text: string }> {
  try {
    const { PDFParse } = await import('pdf-parse');
    const parser = new PDFParse({ data: buffer });
    const textResult = await parser.getText();
    // getText returns a TextResult object, extract the text property
    const text = typeof textResult === 'string' ? textResult : (textResult as any).text || String(textResult);
    return { text: text || '' };
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
      } else if (ext === '.docx') {
        const result = await this.processDocx(buffer, filename, projectId);
        results.push(result);
      } else if (ext === '.txt' || ext === '.doc') {
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
      const msgReader = new MsgReader(buffer);
      const msgData = msgReader.getFileData();
      
      // Build email content from parsed MSG data
      const emailParts: string[] = [];
      
      if (msgData.subject) {
        emailParts.push(`Subject: ${msgData.subject}`);
      }
      if (msgData.senderName || msgData.senderEmail) {
        emailParts.push(`From: ${msgData.senderName || ''} <${msgData.senderEmail || ''}>`);
      }
      if (msgData.recipients && msgData.recipients.length > 0) {
        const recipientList = msgData.recipients.map((r: any) => 
          `${r.name || ''} <${r.email || ''}>`
        ).join(', ');
        emailParts.push(`To: ${recipientList}`);
      }
      if (msgData.messageDeliveryTime) {
        emailParts.push(`Date: ${msgData.messageDeliveryTime}`);
      }
      
      emailParts.push(''); // Empty line before body
      
      // Get email body - prefer plain text, fall back to HTML
      if (msgData.body) {
        emailParts.push(msgData.body);
      } else if (msgData.bodyHtml) {
        // Strip HTML tags for plain text extraction
        const plainText = msgData.bodyHtml.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
        emailParts.push(plainText);
      }
      
      const textContent = emailParts.join('\n');
      
      if (textContent.trim()) {
        const result = await this.createDocumentWithChunks(projectId, filename, textContent);
        results.push(result);
        console.log(`MSG parsed: "${msgData.subject || filename}" - ${textContent.length} chars`);
      }
      
      // Process attachments
      if (msgData.attachments && msgData.attachments.length > 0) {
        console.log(`MSG has ${msgData.attachments.length} attachment(s)`);
        
        for (const att of msgData.attachments) {
          try {
            const attachmentData = msgReader.getAttachment(att);
            if (attachmentData && attachmentData.content) {
              const attachmentBuffer = Buffer.from(attachmentData.content);
              const attachmentFilename = att.fileName || att.name || `attachment_${results.length}.bin`;
              
              console.log(`Processing MSG attachment: ${attachmentFilename}`);
              
              const attachmentResults = await this.processFile(
                attachmentBuffer,
                attachmentFilename,
                projectId
              );
              results.push(...attachmentResults);
            }
          } catch (error) {
            console.error(`Failed to process MSG attachment ${att.fileName || att.name}:`, error);
          }
        }
      }
    } catch (error) {
      console.error(`MSG processing error for ${filename}:`, error);
      // Fallback to basic text extraction
      const result = await this.processText(buffer, filename, projectId);
      results.push(result);
    }

    return results;
  }

  private async processText(
    buffer: Buffer,
    filename: string,
    projectId: string
  ): Promise<ProcessedFile> {
    const text = buffer.toString('utf-8', 0, Math.min(buffer.length, 50000));
    return this.createDocumentWithChunks(projectId, filename, text);
  }

  private async processDocx(
    buffer: Buffer,
    filename: string,
    projectId: string
  ): Promise<ProcessedFile> {
    let text = '';
    
    try {
      const result = await mammoth.extractRawText({ buffer });
      text = result.value || '';
      
      // Remove null bytes and other problematic characters for PostgreSQL
      text = text.replace(/\x00/g, '');
      
      if (result.messages && result.messages.length > 0) {
        console.log(`DOCX parsing messages for ${filename}:`, result.messages);
      }
      
      console.log(`DOCX parsed: ${filename} - ${text.length} characters extracted`);
    } catch (error: any) {
      console.error(`DOCX parsing error for ${filename}:`, error);
      text = `[DOCX content could not be extracted: ${error.message}]`;
    }
    
    return this.createDocumentWithChunks(projectId, filename, text);
  }

  private async createDocumentWithChunks(
    projectId: string,
    filename: string,
    content: string
  ): Promise<ProcessedFile> {
    // Sanitize content: remove null bytes that PostgreSQL cannot store in text columns
    const sanitizedContent = content.replace(/\x00/g, '');
    const chunks = await this.chunkTextSemantic(sanitizedContent);
    
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
        [projectId, filename, sanitizedContent.substring(0, 10000), false]
      );
      documentId = docResult.rows[0].id;

      // Create chunks with embeddings
      console.log(`Generating embeddings for ${chunks.length} chunks from ${filename}...`);
      
      for (let i = 0; i < chunks.length; i++) {
        // Ensure each chunk is also sanitized (remove any null bytes)
        const sanitizedChunk = chunks[i].replace(/\x00/g, '');
        
        try {
          // Generate embedding for this chunk
          const embedding = await generateEmbedding(sanitizedChunk);
          
          // Convert embedding array to PostgreSQL vector format
          const embeddingStr = `[${embedding.join(',')}]`;
          
          await client.query(
            `INSERT INTO document_chunks (document_id, content, chunk_index, embedding) 
             VALUES ($1, $2, $3, $4::vector)`,
            [documentId, sanitizedChunk, i, embeddingStr]
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
            [documentId, sanitizedChunk, i]
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
