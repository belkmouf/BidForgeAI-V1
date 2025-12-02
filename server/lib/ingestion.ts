import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import AdmZip from 'adm-zip';
import { pool } from '../db';

// Dynamic PDF parsing with proper module handling
async function parsePdf(buffer: Buffer): Promise<{ text: string }> {
  try {
    const pdfModule = await import('pdf-parse');
    const pdfParse = pdfModule.default || pdfModule;
    if (typeof pdfParse === 'function') {
      return await pdfParse(buffer);
    }
    if (pdfParse && typeof pdfParse.default === 'function') {
      return await pdfParse.default(buffer);
    }
    throw new Error('Could not find pdf-parse function');
  } catch (error: any) {
    console.error('PDF parse module error:', error);
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

    try {
      const zip = new AdmZip(buffer);
      zip.extractAllTo(tempDir, true);

      const extractedFiles = this.getAllFiles(tempDir);

      for (const filePath of extractedFiles) {
        const fileBuffer = fs.readFileSync(filePath);
        const fileName = path.basename(filePath);
        
        try {
          const fileResults = await this.processFile(fileBuffer, fileName, projectId);
          results.push(...fileResults);
        } catch (error) {
          console.error(`Failed to process ${fileName} from ZIP:`, error);
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
    const chunks = this.chunkText(content);
    
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

      // Create all chunks within the same transaction (without embeddings)
      for (let i = 0; i < chunks.length; i++) {
        await client.query(
          `INSERT INTO document_chunks (document_id, content, chunk_index) 
           VALUES ($1, $2, $3)`,
          [documentId, chunks[i], i]
        );
      }

      // Mark document as processed
      await client.query(
        `UPDATE documents SET is_processed = true WHERE id = $1`,
        [documentId]
      );

      await client.query('COMMIT');
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

  private chunkText(text: string): string[] {
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
