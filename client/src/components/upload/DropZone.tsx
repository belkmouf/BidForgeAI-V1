import { useCallback, useState } from 'react';
import { Upload, FileText, CheckCircle, X, Loader2, Image as ImageIcon, FileSpreadsheet, Download, AlertTriangle, AlertCircle, Lock, Copy, FileWarning } from 'lucide-react';
import { useDropzone, FileRejection } from 'react-dropzone';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';

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

export interface ValidationIssue {
  type: 'error' | 'warning';
  code: 'format' | 'size' | 'name' | 'duplicate' | 'password' | 'corrupt';
  message: string;
  filename: string;
}

interface DropZoneProps {
  files?: FileItem[];
  onUpload?: (file: File) => void;
  onUploadWithProgress?: (file: File, onProgress: (progress: ProcessingProgress) => void) => Promise<void>;
  onDelete?: (documentId: number) => void;
  maxFileSize?: number;
  maxTotalSize?: number;
  showValidation?: boolean;
}

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB default
const MAX_TOTAL_SIZE = 200 * 1024 * 1024; // 200MB total default

const ACCEPTED_FORMATS = {
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
};

const SUPPORTED_EXTENSIONS = ['.pdf', '.docx', '.doc', '.xlsx', '.xls', '.csv', '.zip', '.msg', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.tiff', '.bmp'];

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

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function validateFileName(filename: string): ValidationIssue | null {
  const problematicChars = /[<>:"/\\|?*\x00-\x1F]/;
  if (problematicChars.test(filename)) {
    return {
      type: 'warning',
      code: 'name',
      message: 'Filename contains special characters that may cause issues',
      filename,
    };
  }
  
  if (filename.length > 200) {
    return {
      type: 'warning',
      code: 'name',
      message: 'Filename is very long, consider shortening it',
      filename,
    };
  }
  
  if (filename.startsWith('.') || filename.startsWith(' ')) {
    return {
      type: 'warning',
      code: 'name',
      message: 'Filename starts with a dot or space',
      filename,
    };
  }
  
  return null;
}

function validateFileExtension(filename: string): ValidationIssue | null {
  const ext = filename.toLowerCase().match(/\.[^.]*$/)?.[0] || '';
  if (!SUPPORTED_EXTENSIONS.includes(ext)) {
    return {
      type: 'error',
      code: 'format',
      message: `Unsupported file format: ${ext || 'unknown'}. Supported: PDF, DOCX, XLSX, PNG, JPG`,
      filename,
    };
  }
  return null;
}

function validateFileSize(file: File, maxSize: number): ValidationIssue | null {
  if (file.size > maxSize) {
    return {
      type: 'error',
      code: 'size',
      message: `File too large: ${formatFileSize(file.size)}. Maximum: ${formatFileSize(maxSize)}`,
      filename: file.name,
    };
  }
  return null;
}

function checkDuplicate(filename: string, existingFiles: string[]): ValidationIssue | null {
  const normalizedNew = filename.toLowerCase().trim();
  const duplicate = existingFiles.find(f => f.toLowerCase().trim() === normalizedNew);
  if (duplicate) {
    return {
      type: 'warning',
      code: 'duplicate',
      message: 'A file with this name already exists. The new version will be uploaded.',
      filename,
    };
  }
  return null;
}

async function checkPasswordProtectedPDF(file: File): Promise<ValidationIssue | null> {
  if (!file.name.toLowerCase().endsWith('.pdf')) {
    return null;
  }
  
  try {
    const arrayBuffer = await file.slice(0, 8192).arrayBuffer();
    const uint8 = new Uint8Array(arrayBuffer);
    const text = new TextDecoder('latin1').decode(uint8);
    
    if (text.includes('/Encrypt')) {
      return {
        type: 'error',
        code: 'password',
        message: 'PDF appears to be password-protected. Please provide an unlocked version.',
        filename: file.name,
      };
    }
  } catch (e) {
    console.warn('Could not check PDF encryption:', e);
  }
  
  return null;
}

function getValidationIcon(code: ValidationIssue['code']) {
  switch (code) {
    case 'password':
      return <Lock className="w-4 h-4" />;
    case 'duplicate':
      return <Copy className="w-4 h-4" />;
    case 'format':
    case 'corrupt':
      return <FileWarning className="w-4 h-4" />;
    default:
      return <AlertTriangle className="w-4 h-4" />;
  }
}

export function DropZone({ 
  onUpload, 
  onUploadWithProgress, 
  onDelete, 
  files: initialFiles = [],
  maxFileSize = MAX_FILE_SIZE,
  maxTotalSize = MAX_TOTAL_SIZE,
  showValidation = true,
}: DropZoneProps) {
  const [uploadingFiles, setUploadingFiles] = useState<Array<{
    id: number;
    name: string;
    status: 'uploading' | 'parsing' | 'chunking' | 'embedding' | 'completed' | 'error';
    progress: number;
    statusMessage?: string;
  }>>([]);
  
  const [validationIssues, setValidationIssues] = useState<ValidationIssue[]>([]);
  const [isValidating, setIsValidating] = useState(false);

  const completedFiles = initialFiles.map(f => ({
    id: parseInt(f.id),
    name: f.name,
    status: (f.isProcessed !== false ? 'completed' : 'processing') as 'completed' | 'processing',
    progress: f.isProcessed !== false ? 100 : 50
  }));

  const existingFileNames = completedFiles.map(f => f.name);
  const completedFileNames = new Set(existingFileNames);
  const activeUploads = uploadingFiles.filter(f => !completedFileNames.has(f.name));
  const allFiles = [...completedFiles, ...activeUploads];
  
  const currentTotalSize = initialFiles.reduce((sum, f) => sum + f.size, 0);

  const validateFiles = useCallback(async (files: File[]): Promise<{ validFiles: File[], issues: ValidationIssue[] }> => {
    const issues: ValidationIssue[] = [];
    const validFiles: File[] = [];
    let newFilesSize = 0;
    
    for (const file of files) {
      const fileIssues: ValidationIssue[] = [];
      
      const extIssue = validateFileExtension(file.name);
      if (extIssue) {
        fileIssues.push(extIssue);
      }
      
      const sizeIssue = validateFileSize(file, maxFileSize);
      if (sizeIssue) {
        fileIssues.push(sizeIssue);
      }
      
      const nameIssue = validateFileName(file.name);
      if (nameIssue) {
        fileIssues.push(nameIssue);
      }
      
      const dupIssue = checkDuplicate(file.name, existingFileNames);
      if (dupIssue) {
        fileIssues.push(dupIssue);
      }
      
      const pdfIssue = await checkPasswordProtectedPDF(file);
      if (pdfIssue) {
        fileIssues.push(pdfIssue);
      }
      
      newFilesSize += file.size;
      if (currentTotalSize + newFilesSize > maxTotalSize) {
        fileIssues.push({
          type: 'error',
          code: 'size',
          message: `Adding this file would exceed total upload limit of ${formatFileSize(maxTotalSize)}`,
          filename: file.name,
        });
      }
      
      issues.push(...fileIssues);
      
      const hasErrors = fileIssues.some(i => i.type === 'error');
      if (!hasErrors) {
        validFiles.push(file);
      }
    }
    
    return { validFiles, issues };
  }, [existingFileNames, maxFileSize, maxTotalSize, currentTotalSize]);

  const onDrop = useCallback(async (acceptedFiles: File[], rejectedFiles: FileRejection[]) => {
    setIsValidating(true);
    
    const rejectionIssues: ValidationIssue[] = rejectedFiles.map(({ file, errors }) => ({
      type: 'error' as const,
      code: 'format' as const,
      message: errors.map(e => e.message).join(', '),
      filename: file.name,
    }));
    
    const { validFiles, issues } = await validateFiles(acceptedFiles);
    
    const allIssues = [...rejectionIssues, ...issues];
    setValidationIssues(prev => [...prev.slice(-10), ...allIssues].slice(-15));
    setIsValidating(false);
    
    for (const file of validFiles) {
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
  }, [onUpload, onUploadWithProgress, validateFiles]);

  const dismissIssue = (index: number) => {
    setValidationIssues(prev => prev.filter((_, i) => i !== index));
  };

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop,
    accept: ACCEPTED_FORMATS,
    maxSize: maxFileSize,
  });

  const errorIssues = validationIssues.filter(i => i.type === 'error');
  const warningIssues = validationIssues.filter(i => i.type === 'warning');

  return (
    <div className="w-full" data-testid="dropzone-container">
      {showValidation && validationIssues.length > 0 && (
        <div className="space-y-2 mb-4" data-testid="validation-issues">
          {errorIssues.map((issue, idx) => (
            <Alert key={`error-${idx}`} variant="destructive" className="py-2">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  {getValidationIcon(issue.code)}
                  <span className="font-medium">{issue.filename}:</span> {issue.message}
                </span>
                <button
                  onClick={() => dismissIssue(validationIssues.indexOf(issue))}
                  className="ml-2 hover:opacity-70"
                  data-testid={`dismiss-error-${idx}`}
                >
                  <X className="w-4 h-4" />
                </button>
              </AlertDescription>
            </Alert>
          ))}
          {warningIssues.map((issue, idx) => (
            <Alert key={`warning-${idx}`} className="py-2 border-yellow-400/50 bg-yellow-50/50 dark:bg-yellow-950/20">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              <AlertDescription className="flex items-center justify-between text-yellow-800 dark:text-yellow-200">
                <span className="flex items-center gap-2">
                  {getValidationIcon(issue.code)}
                  <span className="font-medium">{issue.filename}:</span> {issue.message}
                </span>
                <button
                  onClick={() => dismissIssue(validationIssues.indexOf(issue))}
                  className="ml-2 hover:opacity-70"
                  data-testid={`dismiss-warning-${idx}`}
                >
                  <X className="w-4 h-4" />
                </button>
              </AlertDescription>
            </Alert>
          ))}
        </div>
      )}

      <div
        {...getRootProps()}
        className={cn(
          "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors mb-4",
          isDragActive && !isDragReject && "border-primary bg-primary/5",
          isDragReject && "border-red-500 bg-red-50/50 dark:bg-red-950/20",
          !isDragActive && "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30",
          isValidating && "opacity-50 pointer-events-none"
        )}
        data-testid="dropzone-area"
      >
        <input {...getInputProps()} data-testid="dropzone-input" />
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          {isValidating ? (
            <>
              <Loader2 className="h-8 w-8 animate-spin opacity-50" />
              <p className="font-medium text-foreground">Validating files...</p>
            </>
          ) : isDragReject ? (
            <>
              <AlertTriangle className="h-8 w-8 text-red-500" />
              <p className="font-medium text-red-600">Some files are not supported</p>
            </>
          ) : (
            <>
              <Upload className="h-8 w-8 opacity-50" />
              <p className="font-medium text-foreground">
                {isDragActive ? "Drop files here..." : "Click to upload or drag and drop"}
              </p>
              <p className="text-xs">PDF, DOCX, XLSX, PNG, JPG, and more (Max {formatFileSize(maxFileSize)} per file)</p>
              <div className="flex flex-wrap gap-1.5 mt-2 justify-center">
                <Badge variant="outline" className="text-xs">Auto-validation</Badge>
                <Badge variant="outline" className="text-xs">Duplicate detection</Badge>
                <Badge variant="outline" className="text-xs">Format check</Badge>
              </div>
            </>
          )}
        </div>
      </div>

      {allFiles.length > 0 && (
        <div className="divide-y" data-testid="files-list">
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
                  <span className="flex items-center gap-1 text-sm text-green-600" data-testid={`status-complete-${file.id}`}>
                    <CheckCircle className="w-4 h-4" />
                    Done
                  </span>
                ) : file.status === 'error' ? (
                  <span className="text-sm text-red-500" data-testid={`status-error-${file.id}`}>Error</span>
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
                {file.status === 'completed' && (
                  <a 
                    href={`/api/documents/${file.id}/download`}
                    download
                    onClick={(e) => e.stopPropagation()}
                    className="p-1.5 hover:bg-muted rounded-md text-muted-foreground hover:text-foreground transition-colors"
                    title="Download"
                    data-testid={`download-${file.id}`}
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
        <div className="text-center py-6 text-muted-foreground text-sm" data-testid="empty-state">
          <FileText className="w-10 h-10 mx-auto mb-2 opacity-40" />
          <p>No files uploaded yet</p>
        </div>
      )}
      
      {initialFiles.length > 0 && (
        <div className="mt-3 text-xs text-muted-foreground text-center" data-testid="upload-stats">
          {initialFiles.length} file{initialFiles.length !== 1 ? 's' : ''} • {formatFileSize(currentTotalSize)} total
        </div>
      )}
    </div>
  );
}
