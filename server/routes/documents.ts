import { Router } from 'express';
import * as crypto from 'crypto';
import multer from 'multer';
import { storage } from '../storage';
import { ingestionService } from '../lib/ingestion';
import { pythonSketchClient } from '../lib/pythonSketchClient';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { usageTracking } from '../lib/usage-tracking.js';

const router = Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
  },
});

// Upload a document to a project with recursive file processing (requires authentication, company-scoped)
// ENHANCED: Now supports multiple files and sketch analysis
router.post("/projects/:id/upload", authenticateToken, upload.any(), async (req: AuthRequest, res) => {
  try {
    const files = req.files as Express.Multer.File[];
    const path = await import('path');

    if (!files || files.length === 0) {
      return res.status(400).json({ error: "No files uploaded" });
    }

    const projectId = req.params.id;
    const companyId = req.user?.companyId ?? null;

    // Verify project exists and belongs to this company
    const project = await storage.getProject(projectId, companyId);
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    // Update workflow status to 'summarizing' as we start processing
    await storage.updateWorkflowStatus(projectId, 'summarizing', companyId);

    // Classify files into sketches (images) and documents (text)
    const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.tiff', '.bmp', '.webp'];
    const documentExtensions = ['.pdf', '.msg', '.zip', '.txt', '.doc', '.docx'];

    const sketches: Express.Multer.File[] = [];
    const documents: Express.Multer.File[] = [];

    for (const file of files) {
      // Sanitize filename
      const originalName = file.originalname;
      const safeFilename = originalName.replace(/[^\w\s.-]/g, '_').replace(/\.{2,}/g, '.').trim();

      if (!safeFilename || safeFilename.length === 0) {
        console.warn(`Skipping file with invalid name: ${originalName}`);
        continue;
      }

      // Validate file size
      const maxSize = 50 * 1024 * 1024; // 50MB
      if (file.size > maxSize || file.size === 0) {
        console.warn(`Skipping file ${safeFilename}: invalid size`);
        continue;
      }

      // Classify by extension
      const fileExt = safeFilename.toLowerCase().match(/\.[^.]*$/)?.[0] || '';

      if (imageExtensions.includes(fileExt)) {
        sketches.push(file);
      } else if (documentExtensions.includes(fileExt)) {
        documents.push(file);
      } else {
        console.warn(`Skipping file ${safeFilename}: unsupported type`);
      }
    }

    let workflow: string;
    let sketchResults: any[] = [];
    
    // Import fs/promises for file operations (needed for sketch analysis files)
    const fs = await import('fs/promises');

    // Conditional triggering: ONLY run Python agent if sketches present
    if (sketches.length > 0) {
      workflow = 'with-sketches';
      console.log(`Processing ${sketches.length} sketches with Python vision agent...`);

      const os = await import('os');

      // Save sketches to temp files for Python processing
      const tempPaths: string[] = [];

      try {
        for (const sketch of sketches) {
          const tempPath = path.join(os.tmpdir(), `sketch_${Date.now()}_${sketch.originalname}`);
          await fs.writeFile(tempPath, sketch.buffer);
          tempPaths.push(tempPath);
        }

        // Analyze sketches using Python agent - include project description for better context
        const projectContext = project.description 
          ? `Project: ${project.name || projectId}\nDescription: ${project.description}`
          : `Project: ${project.name || projectId}`;
        const context = req.body.context || projectContext;
        const analysisResults = await pythonSketchClient.analyzeMultiple(tempPaths, context);

        // Extract successful results
        sketchResults = analysisResults
          .filter(r => r.success)
          .map(r => r.result);

        // Log failures
        analysisResults
          .filter(r => !r.success)
          .forEach((r, i) => {
            console.error(`Sketch analysis failed for ${sketches[i].originalname}: ${r.error}`);
          });

      } finally {
        // Clean up temp files
        for (const tempPath of tempPaths) {
          try {
            await fs.unlink(tempPath);
          } catch (err) {
            console.error(`Failed to delete temp file: ${tempPath}`);
          }
        }
      }
    } else {
      workflow = 'text-only';
      console.log('No sketches detected, using text-only workflow');
    }

    // Process documents with existing ingestion service
    const processedFiles: any[] = [];
    for (const doc of documents) {
      const safeFilename = doc.originalname.replace(/[^\w\s.-]/g, '_').replace(/\.{2,}/g, '.').trim();

      try {
        const processed = await ingestionService.processFile(
          doc.buffer,
          safeFilename,
          projectId
        );
        processedFiles.push(...processed);
      } catch (error: any) {
        console.error(`Failed to process document ${safeFilename}:`, error.message);
      }
    }

    // Save sketches as documents and create text files with extracted data + RAG chunks
    for (let i = 0; i < sketches.length; i++) {
      const sketch = sketches[i];
      const safeFilename = sketch.originalname.replace(/[^\w\s.-]/g, '_').replace(/\.{2,}/g, '.').trim();
      const sketchResult = sketchResults[i];
      
      // Save the full structured JSON analysis as the text file content
      let sketchContent: string;
      if (sketchResult) {
        // Save the complete structured JSON for maximum detail
        sketchContent = JSON.stringify(sketchResult, null, 2);
      } else {
        sketchContent = JSON.stringify({ error: 'Image file - analysis pending' }, null, 2);
      }
      
      try {
        // Save text file with extracted data to uploads folder
        const pathModule = await import('path');
        const baseFilename = safeFilename.replace(/\.[^.]+$/, '');
        const txtFilename = `${baseFilename}_analysis.txt`;
        const txtPath = pathModule.join(process.cwd(), 'uploads', 'analysis', txtFilename);
        
        // Ensure analysis directory exists
        const analysisDir = pathModule.join(process.cwd(), 'uploads', 'analysis');
        await fs.mkdir(analysisDir, { recursive: true });
        await fs.writeFile(txtPath, sketchContent, 'utf-8');
        console.log(`Saved analysis text file: ${txtPath}`);
        
        // Create document record for the original sketch image
        await storage.createDocument({
          projectId,
          filename: safeFilename,
          content: `[Image: ${safeFilename}] - See ${txtFilename} for extracted analysis`,
          isProcessed: true,
        });
        processedFiles.push({ filename: safeFilename, chunksCreated: 0 });
        
        // Process the analysis text through ingestion service to create RAG chunks with embeddings
        const txtBuffer = Buffer.from(sketchContent, 'utf-8');
        const ragResults = await ingestionService.processFile(
          txtBuffer,
          txtFilename,
          projectId
        );
        
        // Add the RAG-processed results (with actual chunk counts)
        processedFiles.push(...ragResults);
        console.log(`Created RAG chunks for ${txtFilename}: ${ragResults.reduce((sum, r) => sum + r.chunksCreated, 0)} chunks`);
      } catch (error: any) {
        console.error(`Failed to save sketch document ${safeFilename}:`, error.message);
      }
    }

    const totalChunks = processedFiles.reduce((sum, f) => sum + f.chunksCreated, 0);

    // Save sketch analysis results to project metadata for use in bid generation
    if (sketchResults.length > 0) {
      await storage.updateProjectMetadata(projectId, companyId, {
        sketchAnalysis: sketchResults,
        sketchAnalysisDate: new Date().toISOString(),
      });
      console.log(`Saved ${sketchResults.length} sketch analysis results to project metadata`);
    }

    // Update workflow status to 'summary_review' - user must review summaries
    await storage.updateWorkflowStatus(projectId, 'summary_review', companyId);

    // Track usage for billing
    if (companyId) {
      try {
        // Track document pages processed
        const totalPages = processedFiles.reduce((sum, f) => sum + (f.pageCount || 1), 0);
        await usageTracking.trackUsage({
          companyId,
          projectId,
          userId: req.user?.id,
          eventType: 'document_processed',
          eventCategory: 'processing',
          quantity: totalPages,
          unit: 'pages',
          metadata: {
            documentCount: processedFiles.length,
            sketchCount: sketches.length,
            totalChunks,
            workflow,
          },
        });

        // Track sketch analysis if any
        if (sketches.length > 0 && sketchResults.length > 0) {
          await usageTracking.trackUsage({
            companyId,
            projectId,
            userId: req.user?.id,
            eventType: 'blueprint_analyzed',
            eventCategory: 'analysis',
            quantity: sketchResults.length,
            unit: 'blueprints',
            metadata: {
              sketchFilenames: sketches.map(s => s.originalname),
            },
          });
        }
      } catch (usageError) {
        console.warn('Failed to track document processing usage:', usageError);
      }
    }

    res.json({
      success: true,
      workflow,
      message: workflow === 'with-sketches'
        ? `Processed ${sketches.length} sketches and ${documents.length} documents`
        : `Processed ${documents.length} documents`,
      has_sketches: sketches.length > 0,
      sketch_count: sketches.length,
      document_count: documents.length,
      sketch_results: sketchResults,
      filesProcessed: processedFiles.length,
      totalChunks,
      documents: processedFiles,
    });
  } catch (error: any) {
    console.error('Upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Upload with SSE progress streaming
router.post("/projects/:id/upload-with-progress", authenticateToken, upload.any(), async (req: AuthRequest, res) => {
  try {
    const files = req.files as Express.Multer.File[];
    const path = await import('path');

    if (!files || files.length === 0) {
      return res.status(400).json({ error: "No files uploaded" });
    }

    const projectId = req.params.id;
    const companyId = req.user?.companyId ?? null;

    // Verify project exists and belongs to this company
    const project = await storage.getProject(projectId, companyId);
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    // Set up SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    const sendProgress = (data: any) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    // Classify files
    const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.tiff', '.bmp', '.webp'];
    const documentExtensions = ['.pdf', '.msg', '.zip', '.txt', '.doc', '.docx'];

    const sketches: Express.Multer.File[] = [];
    const documents: Express.Multer.File[] = [];

    for (const file of files) {
      const originalName = file.originalname;
      const safeFilename = originalName.replace(/[^\w\s.-]/g, '_').replace(/\.{2,}/g, '.').trim();

      if (!safeFilename || safeFilename.length === 0) continue;
      if (file.size > 50 * 1024 * 1024 || file.size === 0) continue;

      const fileExt = safeFilename.toLowerCase().match(/\.[^.]*$/)?.[0] || '';

      if (documentExtensions.includes(fileExt)) {
        documents.push(file);
      } else if (imageExtensions.includes(fileExt)) {
        sketches.push(file);
      }
    }

    // Process documents with progress callback
    const processedFiles: any[] = [];
    
    // Process images/sketches first
    const fs = await import('fs/promises');
    const os = await import('os');
    let sketchResults: any[] = [];
    
    if (sketches.length > 0) {
      sendProgress({ type: 'progress', stage: 'parsing', message: `Analyzing ${sketches.length} image(s) with vision AI...`, percentage: 5 });
      
      const tempPaths: string[] = [];
      try {
        for (const sketch of sketches) {
          const tempPath = path.join(os.tmpdir(), `sketch_${Date.now()}_${sketch.originalname}`);
          await fs.writeFile(tempPath, sketch.buffer);
          tempPaths.push(tempPath);
        }

        // Include project description for better context in image analysis
        const context = project.description 
          ? `Project: ${project.name || projectId}\nDescription: ${project.description}`
          : `Project: ${project.name || projectId}`;
        const analysisResults = await pythonSketchClient.analyzeMultiple(tempPaths, context);
        // IMPORTANT: Don't filter - keep array indices aligned with sketches array
        // Map to result if success, otherwise null (preserves index mapping)
        sketchResults = analysisResults.map(r => r.success ? r.result : null);

        // Clean up temp files
        for (const tempPath of tempPaths) {
          try { await fs.unlink(tempPath); } catch {}
        }
      } catch (error: any) {
        console.error('Image analysis error:', error.message);
        sendProgress({ type: 'error', message: `Image analysis failed: ${error.message}` });
      }

      // Helper to create versioned filename
      const getVersionedFilename = (originalName: string, version: number): string => {
        if (version === 1) return originalName;
        const ext = originalName.match(/\.[^.]+$/)?.[0] || '';
        const base = originalName.replace(/\.[^.]+$/, '');
        return `${base}_v${version}${ext}`;
      };

      // Helper to create filesystem-safe filename with unique ID (preserves extension)
      const createSafeFilename = (originalName: string): string => {
        const ext = originalName.match(/\.[^.]+$/)?.[0] || '';
        const uniqueId = crypto.randomUUID().slice(0, 8);
        return `file_${uniqueId}${ext}`;
      };

      // Save each sketch as a document
      for (let i = 0; i < sketches.length; i++) {
        const sketch = sketches[i];
        const originalFilename = sketch.originalname; // Keep original with Arabic/special chars
        const safeFilename = createSafeFilename(originalFilename); // UUID-based for filesystem
        const sketchResult = sketchResults[i];

        sendProgress({ type: 'progress', filename: originalFilename, stage: 'chunking', message: `Saving image ${i + 1}/${sketches.length}...`, percentage: 10 + (i / sketches.length) * 20 });

        try {
          // Get next version based on original filename (for tracking duplicates)
          const version = await storage.getNextVersionForFilename(projectId, originalFilename);
          const versionedFilename = getVersionedFilename(safeFilename, version);
          
          // Save the actual image file to uploads/images/ for preview
          const imagesDir = path.join(process.cwd(), 'uploads', 'images');
          await fs.mkdir(imagesDir, { recursive: true });
          const imagePath = path.join(imagesDir, versionedFilename);
          await fs.writeFile(imagePath, sketch.buffer);
          console.log(`Saved image to filesystem: ${imagePath} (${sketch.buffer.length} bytes)`);
          
          // Only create records if analysis was successful
          if (sketchResult) {
            const sketchContent = JSON.stringify(sketchResult, null, 2);
            
            // Save the image document reference with image path for preview
            const sketchDoc = await storage.createDocument({
              projectId,
              filename: versionedFilename,
              originalFilename: originalFilename,
              content: `[Image: ${originalFilename}] - See analysis.txt for extracted data\n[ImagePath: /api/documents/image/${versionedFilename}]`,
              isProcessed: true,
              version,
            });

            processedFiles.push({
              filename: versionedFilename,
              originalFilename: originalFilename,
              version,
              documentId: sketchDoc.id,
              chunksCreated: 0,
              type: 'image',
            });

            // Create the analysis text file with proper RAG indexing
            const baseVersionedFilename = versionedFilename.replace(/\.[^.]+$/, '');
            const txtFilename = `${baseVersionedFilename}_analysis.txt`;
            const baseOriginalFilename = originalFilename.replace(/\.[^.]+$/, '');
            const originalTxtFilename = `${baseOriginalFilename}_analysis.txt`;
            
            // Save to filesystem first
            try {
              const pathModule = await import('path');
              const analysisDir = pathModule.join(process.cwd(), 'uploads', 'analysis');
              await fs.mkdir(analysisDir, { recursive: true });
              const txtPath = pathModule.join(analysisDir, txtFilename);
              await fs.writeFile(txtPath, sketchContent, 'utf-8');
              console.log(`Saved full analysis to filesystem: ${txtPath} (${sketchContent.length} bytes)`);
            } catch (fsError: any) {
              console.error(`Failed to save analysis to filesystem: ${fsError.message}`);
            }

            // Process through ingestion service to create proper RAG chunks with embeddings
            sendProgress({ type: 'progress', filename: originalFilename, stage: 'embedding', message: `Creating RAG embeddings for ${originalFilename}...`, percentage: 25 + (i / sketches.length) * 20 });
            
            const txtBuffer = Buffer.from(sketchContent, 'utf-8');
            const ragResults = await ingestionService.processFile(
              txtBuffer,
              txtFilename,
              projectId,
              (progress) => {
                sendProgress({ 
                  type: 'progress', 
                  filename: originalFilename, 
                  stage: progress.stage, 
                  message: progress.message, 
                  percentage: progress.percentage 
                });
              }
            );
            
            // Add RAG results with proper chunk counts
            for (const ragResult of ragResults) {
              processedFiles.push({
                filename: ragResult.filename,
                originalFilename: originalTxtFilename,
                version,
                documentId: ragResult.documentId,
                chunksCreated: ragResult.chunksCreated,
                type: 'analysis',
              });
            }
            
            const totalChunks = ragResults.reduce((sum, r) => sum + r.chunksCreated, 0);
            console.log(`Created ${totalChunks} RAG chunks with embeddings for ${txtFilename}`);
            
            sendProgress({ type: 'progress', filename: originalFilename, stage: 'complete', message: `Analysis complete for ${originalFilename}${version > 1 ? ` (version ${version})` : ''} - ${totalChunks} RAG chunks created`, percentage: 30 + (i / sketches.length) * 20 });
          } else {
            // Analysis failed - save image reference and mark as processed (no embedding needed)
            console.warn(`Sketch analysis incomplete for ${originalFilename}, skipping text file creation`);
            sendProgress({ type: 'warning', filename: originalFilename, message: `Analysis incomplete for ${originalFilename} - text file not created` });
            
            // Save just the image record - mark as processed since there's nothing more to do
            const sketchDoc = await storage.createDocument({
              projectId,
              filename: versionedFilename,
              originalFilename: originalFilename,
              content: `[Image: ${originalFilename}] - Analysis failed\n[ImagePath: /api/documents/image/${versionedFilename}]`,
              isProcessed: true, // Mark as processed to prevent stuck state
              version,
            });

            processedFiles.push({
              filename: versionedFilename,
              originalFilename: originalFilename,
              version,
              documentId: sketchDoc.id,
              chunksCreated: 0,
              type: 'image',
              status: 'failed',
            });
            
            sendProgress({ type: 'progress', filename: originalFilename, stage: 'complete', message: `Image saved (analysis failed) for ${originalFilename}`, percentage: 30 + (i / sketches.length) * 20 });
          }
        } catch (error: any) {
          console.error(`Failed to save sketch ${originalFilename}:`, error.message);
          sendProgress({ type: 'error', filename: originalFilename, message: error.message });
        }
      }

      // Save sketch analysis to project metadata
      if (sketchResults.length > 0) {
        await storage.updateProjectMetadata(projectId, companyId, {
          sketchAnalysis: sketchResults,
          sketchAnalysisDate: new Date().toISOString(),
        });
      }
    }
    
    for (const doc of documents) {
      const safeFilename = doc.originalname.replace(/[^\w\s.-]/g, '_').replace(/\.{2,}/g, '.').trim();

      try {
        const processed = await ingestionService.processFile(
          doc.buffer,
          safeFilename,
          projectId,
          (progress) => {
            sendProgress({ 
              type: 'progress', 
              filename: progress.filename,
              stage: progress.stage,
              currentChunk: progress.currentChunk,
              totalChunks: progress.totalChunks,
              percentage: progress.percentage,
              message: progress.message 
            });
          }
        );
        processedFiles.push(...processed);
      } catch (error: any) {
        console.error(`Failed to process document ${safeFilename}:`, error.message);
        sendProgress({ type: 'error', filename: safeFilename, message: error.message });
      }
    }

    const totalChunks = processedFiles.reduce((sum, f) => sum + f.chunksCreated, 0);

    // Update workflow status to 'summary_review' - user must review summaries
    await storage.updateWorkflowStatus(projectId, 'summary_review', companyId);

    // Send final result
    sendProgress({ 
      type: 'complete', 
      filesProcessed: processedFiles.length, 
      totalChunks,
      documents: processedFiles 
    });

    res.end();
  } catch (error: any) {
    console.error('Upload SSE error:', error);
    res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
    res.end();
  }
});

// List documents for a project (requires authentication)
router.get("/projects/:id/documents", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const documents = await storage.listDocumentsByProject(req.params.id);
    res.json(documents);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update document description (requires authentication, company-scoped)
router.patch("/documents/:documentId", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const documentId = parseInt(req.params.documentId, 10);
    if (isNaN(documentId)) {
      return res.status(400).json({ error: "Invalid document ID" });
    }

    const { description } = req.body;
    const companyId = req.user?.companyId ?? null;
    
    // Verify document exists and belongs to this company's project
    const document = await storage.getDocument(documentId, companyId);
    if (!document) {
      return res.status(404).json({ error: "Document not found" });
    }

    // Update the document
    const updated = await storage.updateDocument(documentId, companyId, { description });
    if (updated) {
      res.json(updated);
    } else {
      res.status(500).json({ error: "Failed to update document" });
    }
  } catch (error: any) {
    console.error('Update document error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete a document (requires authentication, company-scoped)
router.delete("/documents/:documentId", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const documentId = parseInt(req.params.documentId, 10);
    if (isNaN(documentId)) {
      return res.status(400).json({ error: "Invalid document ID" });
    }

    const companyId = req.user?.companyId ?? null;
    
    // Verify document exists and belongs to this company's project
    const document = await storage.getDocument(documentId, companyId);
    if (!document) {
      return res.status(404).json({ error: "Document not found" });
    }

    // Delete the document and its chunks
    const deleted = await storage.deleteDocument(documentId, companyId);
    
    if (deleted) {
      res.json({ message: "Document deleted successfully" });
    } else {
      res.status(500).json({ error: "Failed to delete document" });
    }
  } catch (error: any) {
    console.error('Delete document error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Download endpoint for documents by ID
router.get('/documents/:id/download', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const path = await import('path');
    const fsPromises = await import('fs/promises');
    
    const documentId = parseInt(req.params.id);
    if (isNaN(documentId)) {
      return res.status(400).json({ error: 'Invalid document ID' });
    }
    
    const companyId = req.user?.companyId ?? null;
    const document = await storage.getDocument(documentId, companyId);
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }
    
    // Check different possible file locations
    const possiblePaths = [
      path.join(process.cwd(), 'uploads', document.filename),
      path.join(process.cwd(), 'uploads', 'images', document.filename),
      path.join(process.cwd(), 'uploads', 'analysis', document.filename),
    ];
    
    let filePath: string | null = null;
    for (const p of possiblePaths) {
      try {
        await fsPromises.access(p);
        filePath = p;
        break;
      } catch {}
    }
    
    if (filePath) {
      // File exists on disk, serve it
      const ext = document.filename.toLowerCase().match(/\.[^.]*$/)?.[0] || '';
      const mimeTypes: Record<string, string> = {
        '.pdf': 'application/pdf',
        '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif',
        '.txt': 'text/plain',
        '.msg': 'application/vnd.ms-outlook',
      };
      
      res.setHeader('Content-Type', mimeTypes[ext] || 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${document.originalFilename || document.filename}"`);
      res.sendFile(filePath);
    } else if (document.content) {
      // File not on disk, but has content in database
      res.setHeader('Content-Type', 'text/plain');
      res.setHeader('Content-Disposition', `attachment; filename="${document.originalFilename || document.filename}.txt"`);
      res.send(document.content);
    } else {
      return res.status(404).json({ error: 'File content not available' });
    }
  } catch (error: any) {
    console.error('Document download error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;

