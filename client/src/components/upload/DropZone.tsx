import { useCallback, useState } from 'react';
import { Upload, File, X, CheckCircle2, AlertCircle, FileText, FileArchive, Mail } from 'lucide-react';
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
}

interface DropZoneProps {
  files?: FileItem[];
  onUpload?: (file: File) => void;
  onDelete?: (documentId: number) => void;
}

export function DropZone({ onUpload, onDelete, files: initialFiles = [] }: DropZoneProps) {
  const [uploadingFiles, setUploadingFiles] = useState<Array<{
    id: number;
    name: string;
    size: string;
    type: string;
    status: 'uploading' | 'processing' | 'completed' | 'error';
    progress: number;
  }>>([]);

  const completedFiles = initialFiles.map(f => ({
    id: parseInt(f.id),
    name: f.name,
    type: f.name.split('.').pop() || 'unknown',
    size: f.size > 0 ? (f.size / 1024 / 1024).toFixed(2) + ' MB' : 'N/A',
    status: 'completed' as const,
    progress: 100
  }));

  const allFiles = [...completedFiles, ...uploadingFiles];

  const onDrop = useCallback((acceptedFiles: File[]) => {
    acceptedFiles.forEach(file => {
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
      
      // Call upload handler
      onUpload?.(file);

      // Simulate progress
      let progress = 0;
      const interval = setInterval(() => {
        progress += 10;
        setUploadingFiles(prev => prev.map(f => f.id === fileId ? { 
          ...f, 
          progress: Math.min(progress, 100), 
          status: progress >= 100 ? 'processing' : 'uploading' 
        } : f));
        
        if (progress >= 100) {
          clearInterval(interval);
          setTimeout(() => {
            setUploadingFiles(prev => prev.filter(f => f.id !== fileId));
          }, 1500);
        }
      }, 300);
    });
  }, [onUpload]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/zip': ['.zip'],
      'application/vnd.ms-outlook': ['.msg']
    }
  });

  const getFileIcon = (type: string) => {
    if (type.includes('pdf')) return <FileText className="h-5 w-5 text-red-500" />;
    if (type.includes('zip')) return <FileArchive className="h-5 w-5 text-yellow-500" />;
    if (type.includes('msg')) return <Mail className="h-5 w-5 text-blue-500" />;
    return <File className="h-5 w-5 text-gray-500" />;
  };

  return (
    <div className="flex flex-col h-full">
      <div
        {...getRootProps()}
        className={cn(
          "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors mb-4",
          isDragActive ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/50"
        )}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <div className="bg-muted p-3 rounded-full mb-2">
            <Upload className="h-6 w-6" />
          </div>
          <p className="font-medium text-foreground">Click to upload or drag and drop</p>
          <p className="text-xs">PDF, DOCX, ZIP, MSG (Max 50MB)</p>
        </div>
      </div>

      <div className="flex items-center justify-between mb-2">
        <h3 className="font-medium text-sm">Project Files</h3>
        <span className="text-xs text-muted-foreground">{allFiles.length} files</span>
      </div>

      <ScrollArea className="flex-1 -mx-2 px-2">
        <div className="space-y-2">
          {allFiles.map((file) => (
            <div key={file.id} className="group flex items-start gap-3 p-3 rounded-md border border-border bg-card hover:shadow-sm transition-all">
              <div className="mt-1">
                {getFileIcon(file.type)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-medium truncate pr-2" title={file.name}>{file.name}</p>
                  {file.status === 'completed' && <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />}
                  {file.status === 'error' && <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0" />}
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
                  <span>{file.size}</span>
                  <span className="capitalize">{file.status === 'processing' ? 'Ingesting...' : file.status}</span>
                </div>
                {file.status !== 'completed' && file.status !== 'error' && (
                  <Progress value={file.progress} className="h-1" />
                )}
              </div>
              {file.status === 'completed' && onDelete && (
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity -mr-1 hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => onDelete(file.id)}
                  data-testid={`button-delete-document-${file.id}`}
                >
                  <X className="h-3 w-3" />
                </Button>
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