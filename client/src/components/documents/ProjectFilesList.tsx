import { useState, useRef } from 'react';
import { Upload, FileText, CheckCircle, Download, X, Image as ImageIcon, FileSpreadsheet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface FileItem {
  id: string;
  name: string;
  size?: number;
  uploadedAt?: Date;
  isProcessed?: boolean;
}

interface ProjectFilesListProps {
  files: FileItem[];
  onUpload?: (file: File, onProgress?: (progress: any) => void) => Promise<void>;
  onDelete?: (fileId: number) => void;
  maxFileSize?: number;
}

function getFileIcon(filename: string): React.ReactNode {
  const ext = filename.toLowerCase().match(/\.[^.]*$/)?.[0] || '';
  if (['.pdf'].includes(ext)) {
    return <FileText className="w-5 h-5 text-red-500" />;
  }
  if (['.png', '.jpg', '.jpeg', '.gif', '.tiff', '.bmp', '.webp'].includes(ext)) {
    return <ImageIcon className="w-5 h-5 text-blue-500" />;
  }
  if (['.xlsx', '.xls', '.csv'].includes(ext)) {
    return <FileSpreadsheet className="w-5 h-5 text-green-600" />;
  }
  if (['.docx', '.doc'].includes(ext)) {
    return <FileText className="w-5 h-5 text-blue-600" />;
  }
  return <FileText className="w-5 h-5 text-gray-400" />;
}

function truncateFileName(filename: string, maxLength: number = 20): string {
  if (filename.length <= maxLength) return filename;
  const ext = filename.match(/\.[^.]*$/)?.[0] || '';
  const nameWithoutExt = filename.slice(0, filename.length - ext.length);
  const truncatedName = nameWithoutExt.slice(0, maxLength - ext.length - 3) + '...';
  return truncatedName + ext;
}

export function ProjectFilesList({ 
  files, 
  onUpload, 
  onDelete,
  maxFileSize = 50 * 1024 * 1024 
}: ProjectFilesListProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (selectedFiles && onUpload) {
      const filesArray = Array.from(selectedFiles);
      for (const file of filesArray) {
        await onUpload(file, () => {});
      }
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h2 className="font-semibold text-base">Project Files</h2>
          <Badge variant="secondary" className="h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs">
            {files.length}
          </Badge>
        </div>
        <Button 
          size="sm" 
          onClick={handleUploadClick}
          className="gap-2"
        >
          <Upload className="w-4 h-4" />
          Upload
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          accept=".pdf,.docx,.doc,.xlsx,.xls,.csv,.txt,.png,.jpg,.jpeg,.gif,.tiff,.bmp,.webp,.zip,.msg"
          onChange={handleFileChange}
        />
      </div>

      {/* File List */}
      {files.length > 0 ? (
        <div className="space-y-2">
          {files.map((file) => (
            <div 
              key={file.id} 
              className="flex items-center justify-between py-2 px-2 rounded-md hover:bg-muted/50 transition-colors group"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                {getFileIcon(file.name)}
                <span 
                  className="text-sm font-medium truncate max-w-[200px]" 
                  title={file.name}
                >
                  {truncateFileName(file.name, 20)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {file.isProcessed !== false && (
                  <span className="flex items-center gap-1 text-sm text-green-600">
                    <CheckCircle className="w-4 h-4" />
                    Done
                  </span>
                )}
                <a 
                  href={`/api/documents/${file.id}/download`}
                  download
                  onClick={(e) => e.stopPropagation()}
                  className="p-1.5 hover:bg-muted rounded-md text-muted-foreground hover:text-foreground transition-colors"
                  title="Download"
                >
                  <Download className="w-4 h-4" />
                </a>
                {onDelete && (
                  <button 
                    className="p-1.5 hover:bg-red-50 rounded-md text-muted-foreground hover:text-red-600 transition-colors"
                    onClick={() => onDelete(parseInt(file.id))}
                    title="Delete"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-muted-foreground text-sm">
          <FileText className="w-10 h-10 mx-auto mb-2 opacity-40" />
          <p>No files uploaded yet</p>
        </div>
      )}

      {/* Footer */}
      <div className="mt-4 text-xs text-muted-foreground text-center pt-3 border-t">
        Supports PDF, DOCX, XLSX, images, and more • Max {Math.round(maxFileSize / (1024 * 1024))}MB
      </div>
    </div>
  );
}

