import { useCallback, useState } from 'react';
import { Upload, FileText, CheckCircle, X, Loader2, Image as ImageIcon, FileSpreadsheet, Download } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';

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

function getFileIcon(filename: string): React.ReactNode {
  const ext = filename.toLowerCase().match(/\.[^.]*$/)?.[0] || '';
  if (['.pdf'].includes(ext)) {
    return <FileText className="w-4 h-4 text-red-500" />;
  }
  if (['.png', '.jpg', '.jpeg', '.gif', '.tiff', '.bmp', '.webp'].includes(ext)) {
    return <ImageIcon className="w-4 h-4 text-blue-500" />;
  }
  if (['.xlsx', '.xls', '.csv'].includes(ext)) {
    return <FileSpreadsheet className="w-4 h-4 text-green-600" />;
  }
  if (['.docx', '.doc'].includes(ext)) {
    return <FileText className="w-4 h-4 text-blue-600" />;
  }
  return <FileText className="w-4 h-4 text-gray-400" />;
}

export function DropZone({ onUpload, onUploadWithProgress, onDelete, files: initialFiles = [] }: DropZoneProps) {
  const [uploadingFiles, setUploadingFiles] = useState<Array<{
    id: number;
    name: string;
    status: 'uploading' | 'parsing' | 'chunking' | 'embedding' | 'completed' | 'error';
    progress: number;
    statusMessage?: string;
  }>>([]);

  const completedFiles = initialFiles.map(f => ({
    id: parseInt(f.id),
    name: f.name,
    status: (f.isProcessed !== false ? 'completed' : 'processing') as 'completed' | 'processing',
    progress: f.isProcessed !== false ? 100 : 50
  }));

  const completedFileNames = new Set(completedFiles.map(f => f.name));
  const activeUploads = uploadingFiles.filter(f => !completedFileNames.has(f.name));
  const allFiles = [...completedFiles, ...activeUploads];

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    for (const file of acceptedFiles) {
      const fileId = Date.now() + Math.random();
      const newFile = {
        id: fileId,
        name: file.name,
        status: 'uploading' as const,
        progress: 0
      };

      setUploadingFiles(prev => [...prev, newFile]);
      
      if (onUploadWithProgress) {
        try {
          await onUploadWithProgress(file, (progress) => {
            setUploadingFiles(prev => prev.map(f => f.id === fileId ? { 
              ...f, 
              progress: progress.percentage,
              status: progress.stage === 'complete' ? 'completed' : progress.stage,
              statusMessage: progress.message,
            } : f));
          });
          
          setTimeout(() => {
            setUploadingFiles(prev => prev.filter(f => f.id !== fileId));
          }, 1500);
        } catch (error) {
          setUploadingFiles(prev => prev.map(f => f.id === fileId ? { 
            ...f, 
            status: 'error' as const,
          } : f));
        }
      } else if (onUpload) {
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
      'image/webp': ['.webp'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'text/csv': ['.csv'],
    }
  });

  return (
    <div className="w-full">
      <div
        {...getRootProps()}
        className={cn(
          "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors mb-4",
          isDragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30"
        )}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <Upload className="h-8 w-8 opacity-50" />
          <p className="font-medium text-foreground">
            {isDragActive ? "Drop files here..." : "Click to upload or drag and drop"}
          </p>
          <p className="text-xs">PDF, DOCX, XLSX, PNG, JPG, and more (Max 50MB)</p>
        </div>
      </div>

      {allFiles.length > 0 && (
        <div className="divide-y">
          {allFiles.map((file) => (
            <div 
              key={file.id} 
              className="flex items-center justify-between py-3 group"
              data-testid={`file-row-${file.id}`}
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                {getFileIcon(file.name)}
                <span className="truncate text-sm font-medium">{file.name}</span>
              </div>
              <div className="flex items-center gap-3">
                {file.status === 'completed' ? (
                  <span className="flex items-center gap-1 text-sm text-green-600">
                    <CheckCircle className="w-4 h-4" />
                    Done
                  </span>
                ) : file.status === 'error' ? (
                  <span className="text-sm text-red-500">Error</span>
                ) : (
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                    <span className="text-sm text-muted-foreground">
                      {file.status === 'uploading' ? 'Uploading...' : 
                       file.status === 'parsing' ? 'Parsing...' :
                       file.status === 'chunking' ? 'Processing...' :
                       file.status === 'embedding' ? 'Analyzing...' : 'Processing...'}
                    </span>
                  </div>
                )}
                {file.name.endsWith('_analysis.txt') && file.status === 'completed' && (
                  <a 
                    href={`/api/downloads/analysis/${encodeURIComponent(file.name)}`}
                    download={file.name}
                    onClick={(e) => e.stopPropagation()}
                    className="p-1.5 hover:bg-muted rounded-md text-muted-foreground hover:text-foreground transition-colors"
                    title="Download"
                  >
                    <Download className="w-4 h-4" />
                  </a>
                )}
                {onDelete && (
                  <button 
                    className="p-1.5 hover:bg-red-50 rounded-md text-muted-foreground hover:text-red-600 transition-colors"
                    onClick={() => onDelete(file.id)}
                    title="Delete"
                    data-testid={`delete-${file.id}`}
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {allFiles.length === 0 && (
        <div className="text-center py-6 text-muted-foreground text-sm">
          <FileText className="w-10 h-10 mx-auto mb-2 opacity-40" />
          <p>No files uploaded yet</p>
        </div>
      )}
    </div>
  );
}
