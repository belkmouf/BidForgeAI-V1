import { useCallback, useState } from 'react';
import { Upload, File, Trash2, CheckCircle2, AlertCircle, FileText, FileArchive, Mail, Image, Download, Loader2 } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

interface FileItem {
  id: string;
  name: string;
  size: number;
  uploadedAt: Date;
  isProcessed?: boolean;
}

export interface ProcessingProgress {
  stage: 'uploading' | 'parsing' | 'chunking' | 'embedding' | 'complete' | 'error';
  filename: string;
  currentChunk?: number;
  totalChunks?: number;
  percentage: number;
  message: string;
}

interface DropZoneProps {
  files?: FileItem[];
  onUpload?: (file: File) => void;
  onUploadWithProgress?: (file: File, onProgress: (progress: ProcessingProgress) => void) => Promise<void>;
  onDelete?: (documentId: number) => void;
}

export function DropZone({ onUpload, onUploadWithProgress, onDelete, files: initialFiles = [] }: DropZoneProps) {
  const [uploadingFiles, setUploadingFiles] = useState<Array<{
    id: number;
    name: string;
    size: string;
    type: string;
    status: 'uploading' | 'parsing' | 'chunking' | 'embedding' | 'completed' | 'error';
    progress: number;
    statusMessage?: string;
    currentChunk?: number;
    totalChunks?: number;
    errorMessage?: string;
  }>>([]);

  const completedFiles = initialFiles.map(f => ({
    id: parseInt(f.id),
    name: f.name,
    type: f.name.split('.').pop() || 'unknown',
    size: f.size > 0 ? (f.size / 1024 / 1024).toFixed(2) + ' MB' : 'N/A',
    status: (f.isProcessed !== false ? 'completed' : 'embedding') as 'completed' | 'embedding',
    progress: f.isProcessed !== false ? 100 : 50
  }));

  // Get names of completed files to filter out duplicates from uploadingFiles
  const completedFileNames = new Set(completedFiles.map(f => f.name));
  
  // Filter out uploadingFiles that are already in completedFiles (avoid duplicates after refresh)
  const activeUploads = uploadingFiles.filter(f => !completedFileNames.has(f.name));
  
  const allFiles = [...completedFiles, ...activeUploads];

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    for (const file of acceptedFiles) {
      const fileId = Date.now() + Math.random();
      const newFile = {
        id: fileId,
        name: file.name,
        type: file.name.split('.').pop() || 'unknown',
        size: (file.size / 1024 / 1024).toFixed(2) + ' MB',
        status: 'uploading' as const,
        progress: 0
      };

      setUploadingFiles(prev => [...prev, newFile]);
      
      // Use progress-based upload if available
      if (onUploadWithProgress) {
        try {
          await onUploadWithProgress(file, (progress) => {
            setUploadingFiles(prev => prev.map(f => f.id === fileId ? { 
              ...f, 
              progress: progress.percentage,
              status: progress.stage === 'complete' ? 'completed' : progress.stage,
              statusMessage: progress.message,
              currentChunk: progress.currentChunk,
              totalChunks: progress.totalChunks
            } : f));
          });
          
          // Remove after processing indicator
          setTimeout(() => {
            setUploadingFiles(prev => prev.filter(f => f.id !== fileId));
          }, 1500);
        } catch (error) {
          setUploadingFiles(prev => prev.map(f => f.id === fileId ? { 
            ...f, 
            status: 'error' as const,
            errorMessage: error instanceof Error ? error.message : 'Upload failed'
          } : f));
        }
      } else if (onUpload) {
        // Fallback to simple upload with simulated progress
        onUpload(file);

        let progress = 0;
        const interval = setInterval(() => {
          progress += 10;
          setUploadingFiles(prev => prev.map(f => f.id === fileId ? { 
            ...f, 
            progress: Math.min(progress, 100), 
            status: progress >= 100 ? 'embedding' as const : 'uploading' as const
          } : f));
          
          if (progress >= 100) {
            clearInterval(interval);
            setTimeout(() => {
              setUploadingFiles(prev => prev.filter(f => f.id !== fileId));
            }, 1500);
          }
        }, 300);
      }
    }
  }, [onUpload, onUploadWithProgress]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/zip': ['.zip'],
      'application/vnd.ms-outlook': ['.msg'],
      'image/png': ['.png'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/gif': ['.gif'],
      'image/webp': ['.webp']
    }
  });

  const getFileIcon = (type: string) => {
    if (type.includes('pdf')) return <FileText className="h-5 w-5 text-red-500" />;
    if (type.includes('zip')) return <FileArchive className="h-5 w-5 text-yellow-500" />;
    if (type.includes('msg')) return <Mail className="h-5 w-5 text-blue-500" />;
    if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(type.toLowerCase())) return <Image className="h-5 w-5 text-green-500" />;
    return <File className="h-5 w-5 text-gray-500" />;
  };

  return (
    <div className="flex flex-col">
      <div
        {...getRootProps()}
        className={cn(
          "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors mb-4",
          isDragActive ? "border-primary bg-primary/5" : "border-primary/30 hover:border-primary/50 hover:bg-muted/50"
        )}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <div className="bg-muted p-3 rounded-full mb-2">
            <Upload className="h-6 w-6" />
          </div>
          <p className="font-medium text-foreground">Click to upload or drag and drop</p>
          <p className="text-xs">PDF, DOCX, ZIP, MSG, PNG, JPG, GIF, WEBP (Max 50MB)</p>
        </div>
      </div>

      <div className="flex items-center justify-between mb-2">
        <h3 className="font-medium text-sm">Project Files</h3>
        <span className="text-xs text-muted-foreground">{allFiles.length} files</span>
      </div>

      <ScrollArea className="flex-1 -mx-2 px-2">
        <div className="space-y-2">
          {allFiles.map((file) => (
            <div key={file.id} className="p-2 rounded-md border-2 border-primary/30 bg-card hover:shadow-sm transition-all max-w-[160px]">
              <div className="flex items-start gap-2">
                <div className="mt-0.5 flex-shrink-0">
                  {(file.status !== 'completed' && file.status !== 'error') ? (
                    <Loader2 className="h-4 w-4 text-primary animate-spin" />
                  ) : (
                    getFileIcon(file.type)
                  )}
                </div>
                <div className="flex-1 min-w-0 overflow-hidden">
                  <div className="flex items-start gap-1 mb-1">
                    <p className="text-xs font-medium break-words leading-tight">{file.name}</p>
                    {file.status === 'completed' && <CheckCircle2 className="h-3 w-3 text-green-500 flex-shrink-0 mt-0.5" />}
                    {file.status === 'error' && <AlertCircle className="h-3 w-3 text-destructive flex-shrink-0 mt-0.5" />}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    <span>{file.size}</span>
                    {file.status === 'uploading' && <span className="text-primary font-medium ml-1">{file.statusMessage || `${file.progress}%`}</span>}
                    {file.status === 'parsing' && <span className="text-primary font-medium ml-1">Parsing...</span>}
                    {file.status === 'chunking' && <span className="text-primary font-medium ml-1">Chunking...</span>}
                    {file.status === 'embedding' && <span className="text-primary font-medium ml-1">{`${file.currentChunk || 0}/${file.totalChunks || 0}`}</span>}
                    {file.status === 'completed' && <span className="text-green-600 ml-1">Done</span>}
                    {file.status === 'error' && <span className="text-destructive ml-1">Error</span>}
                  </div>
                  {(file.status !== 'completed' && file.status !== 'error') && (
                    <Progress value={file.progress} className="h-1.5 mt-1" />
                  )}
                </div>
              </div>
              {file.status === 'completed' && (
                <div className="mt-2 pt-2 border-t border-border flex gap-2">
                  {file.name.endsWith('_analysis.txt') && (
                    <a 
                      href={`/api/downloads/analysis/${encodeURIComponent(file.name)}`}
                      download={file.name}
                      onClick={(e) => e.stopPropagation()}
                      className="flex-1"
                    >
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="w-full h-7"
                        data-testid={`button-download-document-${file.id}`}
                      >
                        <Download className="h-3 w-3 mr-1" />
                        Download
                      </Button>
                    </a>
                  )}
                  {onDelete && (
                    <Button 
                      variant="destructive" 
                      size="sm" 
                      className="w-full h-5 text-xs px-2"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(file.id);
                      }}
                      data-testid={`button-delete-document-${file.id}`}
                    >
                      <Trash2 className="h-3 w-3 mr-1" />
                      Delete
                    </Button>
                  )}
                </div>
              )}
            </div>
          ))}
          {allFiles.length === 0 && (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No files uploaded yet.
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}