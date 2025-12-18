import { useParams, useLocation, Link } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import {
  getDocumentSummary,
  generateProjectSummary,
  updateProjectSummary,
  exportProjectSummary,
  uploadDocument,
  deleteDocument,
  getProject,
  type DocumentSummaryResponse,
} from '../lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Progress } from '../components/ui/progress';
import { Separator } from '../components/ui/separator';
import { ScrollArea } from '../components/ui/scroll-area';
import { Loader2, FileText, CheckCircle, AlertCircle, Clock, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, FileCheck, AlertTriangle, TrendingUp, Download, RefreshCw, Edit2, Save, X, Upload, Image as ImageIcon, FileSpreadsheet } from 'lucide-react';
import { Textarea } from '../components/ui/textarea';
import { Alert, AlertDescription } from '../components/ui/alert';
import { ProjectWorkflowLayout, getWorkflowSteps } from '../components/workflow/ProjectWorkflowLayout';
import { useProjectProgress } from '../hooks/useProjectProgress';
import { DropZone, type ProcessingProgress } from '../components/upload/DropZone';

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
  return date.toLocaleDateString();
}

function isImageFile(filename: string): boolean {
  const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.tiff', '.bmp', '.webp'];
  const ext = filename.toLowerCase().match(/\.[^.]*$/)?.[0] || '';
  return imageExtensions.includes(ext);
}

function getImageUrl(filename: string): string {
  return `/api/documents/image/${encodeURIComponent(filename)}`;
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
  if (['.txt'].includes(ext)) {
    return <FileText className="w-5 h-5 text-gray-500" />;
  }
  return <FileText className="w-5 h-5 text-gray-400" />;
}

function DocumentCard({ 
  document, 
  isSelected, 
  onClick 
}: { 
  document: DocumentSummaryResponse['documents'][0];
  isSelected?: boolean;
  onClick?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card 
      className={`mb-4 cursor-pointer transition-all ${isSelected ? 'ring-2 ring-primary border-primary' : 'hover:border-primary/50'}`}
      onClick={onClick}
      data-testid={`card-document-${document.id}`}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            {isImageFile(document.filename) ? (
              <ImageIcon className={`w-5 h-5 ${isSelected ? 'text-primary' : 'text-emerald-500'}`} />
            ) : (
              <FileText className={`w-5 h-5 ${isSelected ? 'text-primary' : 'text-blue-500'}`} />
            )}
            <div>
              <CardTitle className="text-base">{document.filename}</CardTitle>
              <div className="flex items-center gap-2 mt-1 text-sm text-gray-500">
                <span>{document.fileSize ? formatFileSize(document.fileSize) : 'Unknown size'}</span>
                {document.pageCount && <span>• {document.pageCount} pages</span>}
                <span>• {formatDate(document.uploadedAt)}</span>
              </div>
            </div>
          </div>
          <Badge variant={document.isProcessed ? 'default' : 'secondary'}>
            {document.isProcessed ? (
              <>
                <CheckCircle className="w-3 h-3 mr-1" />
                Processed
              </>
            ) : (
              <>
                <Clock className="w-3 h-3 mr-1" />
                Processing
              </>
            )}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {document.isProcessed && (
          <div className="text-sm text-gray-600">
            <CheckCircle className="w-4 h-4 inline mr-1 text-green-500" />
            {document.chunkCount} chunks extracted
          </div>
        )}

        {document.keyInformation && Object.keys(document.keyInformation).length > 0 && (
          <div className="bg-blue-50 p-3 rounded-lg">
            <h4 className="text-sm font-semibold text-blue-900 mb-2 flex items-center">
              <FileCheck className="w-4 h-4 mr-1" />
              Key Information Detected
            </h4>
            <div className="space-y-1 text-sm">
              {document.keyInformation.projectType && (
                <div>• <span className="font-medium">Project Type:</span> {document.keyInformation.projectType}</div>
              )}
              {document.keyInformation.location && (
                <div>• <span className="font-medium">Location:</span> {document.keyInformation.location}</div>
              )}
              {document.keyInformation.deadline && (
                <div>• <span className="font-medium">Deadline:</span> {document.keyInformation.deadline}</div>
              )}
              {document.keyInformation.budget && (
                <div>• <span className="font-medium">Budget:</span> {document.keyInformation.budget}</div>
              )}
              {document.keyInformation.requirements && document.keyInformation.requirements.length > 0 && (
                <div>• <span className="font-medium">Requirements:</span> {document.keyInformation.requirements.join(', ')}</div>
              )}
            </div>
          </div>
        )}

        {expanded && document.extractedEntities && document.extractedEntities.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold">Extracted Entities</h4>
            <div className="grid gap-2">
              {document.extractedEntities.slice(0, 5).map((entity, idx) => (
                <div key={idx} className="text-sm p-2 bg-gray-50 rounded">
                  <Badge variant="outline" className="text-xs mr-2">{entity.type}</Badge>
                  {entity.value}
                  {entity.confidence && (
                    <span className="text-xs text-gray-500 ml-2">
                      ({Math.round(entity.confidence * 100)}% confident)
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setExpanded(!expanded)}
          className="w-full"
        >
          {expanded ? (
            <>
              <ChevronUp className="w-4 h-4 mr-1" />
              Show Less
            </>
          ) : (
            <>
              <ChevronDown className="w-4 h-4 mr-1" />
              Show More
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

function ProjectSummaryCard({ summary, projectId }: { summary: DocumentSummaryResponse['projectSummary']; projectId: string }) {
  const [editing, setEditing] = useState(false);
  const [editedOverview, setEditedOverview] = useState(summary?.overview || '');
  const queryClient = useQueryClient();

  const updateMutation = useMutation({
    mutationFn: (updates: Partial<DocumentSummaryResponse['projectSummary']>) =>
      updateProjectSummary(projectId, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['document-summary', projectId] });
      setEditing(false);
    },
  });

  const regenerateMutation = useMutation({
    mutationFn: () => generateProjectSummary(projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['document-summary', projectId] });
    },
  });

  if (!summary) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <AlertCircle className="w-5 h-5 mr-2 text-yellow-500" />
            Project Summary Not Generated
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600 mb-4">
            Generate an AI-powered summary of your project documents to get insights and identify any missing information.
          </p>
          <Button onClick={() => regenerateMutation.mutate()} disabled={regenerateMutation.isPending}>
            {regenerateMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>Generate Summary</>
            )}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center">
            <FileCheck className="w-5 h-5 mr-2 text-blue-500" />
            AI-Generated Project Summary
          </CardTitle>
          <div className="flex gap-2">
            {editing ? (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setEditing(false);
                    setEditedOverview(summary.overview || '');
                  }}
                >
                  <X className="w-4 h-4 mr-1" />
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={() => updateMutation.mutate({ overview: editedOverview })}
                  disabled={updateMutation.isPending}
                >
                  {updateMutation.isPending ? (
                    <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4 mr-1" />
                  )}
                  Save
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditing(true)}
                >
                  <Edit2 className="w-4 h-4 mr-1" />
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => regenerateMutation.mutate()}
                  disabled={regenerateMutation.isPending}
                >
                  {regenerateMutation.isPending ? (
                    <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4 mr-1" />
                  )}
                  Regenerate
                </Button>
              </>
            )}
          </div>
        </div>
        {summary.isUserEdited && (
          <Badge variant="secondary" className="w-fit mt-2">User Edited</Badge>
        )}
      </CardHeader>

      <ScrollArea className="max-h-[500px]">
        <CardContent className="space-y-6 pr-4">
          <div className="bg-gradient-to-r from-slate-50 to-white p-4 rounded-lg border-l-4 border-blue-500">
            <h3 className="font-semibold text-lg mb-3 flex items-center gap-2 text-slate-800">
              <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
              Project Overview
            </h3>
            {editing ? (
              <Textarea
                value={editedOverview}
                onChange={(e) => setEditedOverview(e.target.value)}
                rows={4}
                className="w-full"
              />
            ) : (
              <p className="text-gray-700 leading-relaxed">{summary.overview || 'No overview available'}</p>
            )}
          </div>

          {summary.scopeOfWork && summary.scopeOfWork.length > 0 && (
            <div className="bg-white p-4 rounded-lg border border-slate-200">
              <h3 className="font-semibold text-lg mb-3 flex items-center gap-2 text-slate-800">
                <span className="w-2 h-2 bg-teal-500 rounded-full"></span>
                Scope of Work
                <span className="text-xs text-slate-500 font-normal">({summary.scopeOfWork.length} items)</span>
              </h3>
              <ScrollArea className={summary.scopeOfWork.length > 5 ? "max-h-[250px]" : ""}>
                <div className="space-y-2 pr-2">
                  {summary.scopeOfWork.map((item, idx) => (
                    <div key={idx} className="flex items-start gap-3 p-2 hover:bg-slate-50 rounded transition-colors">
                      <span className="flex-shrink-0 w-6 h-6 bg-teal-100 text-teal-700 rounded-full flex items-center justify-center text-sm font-medium">
                        {idx + 1}
                      </span>
                      <span className="text-gray-700">{item}</span>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {summary.keyRequirements && (
            <div className="bg-white p-4 rounded-lg border border-slate-200">
              <h3 className="font-semibold text-lg mb-3 flex items-center gap-2 text-slate-800">
                <span className="w-2 h-2 bg-amber-500 rounded-full"></span>
                Key Requirements
              </h3>
              <table className="w-full border-collapse">
                <tbody>
                  {summary.keyRequirements.budget && (
                    <tr className="border-b border-slate-100">
                      <td className="py-3 px-4 font-medium text-slate-600 bg-slate-50 w-1/3">Budget</td>
                      <td className="py-3 px-4 text-slate-800">{summary.keyRequirements.budget}</td>
                    </tr>
                  )}
                  {summary.keyRequirements.timeline && (
                    <tr className="border-b border-slate-100">
                      <td className="py-3 px-4 font-medium text-slate-600 bg-slate-50 w-1/3">Timeline</td>
                      <td className="py-3 px-4 text-slate-800">{summary.keyRequirements.timeline}</td>
                    </tr>
                  )}
                  {summary.keyRequirements.certifications && summary.keyRequirements.certifications.length > 0 && (
                    <tr>
                      <td className="py-3 px-4 font-medium text-slate-600 bg-slate-50 w-1/3 align-top">Certifications</td>
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-2">
                          {summary.keyRequirements.certifications.map((cert, idx) => (
                            <Badge key={idx} variant="outline" className="bg-amber-50 border-amber-200 text-amber-800">
                              {cert}
                            </Badge>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {summary.riskFactors && summary.riskFactors.length > 0 && (
            <div className="bg-red-50 p-4 rounded-lg border border-red-200">
              <h3 className="font-semibold text-lg mb-3 flex items-center gap-2 text-red-800">
                <AlertTriangle className="h-5 w-5 text-red-600" />
                Risk Factors
              </h3>
              <div className="space-y-2">
                {summary.riskFactors.map((risk, idx) => (
                  <div key={idx} className="flex items-start gap-3 p-2 bg-white/50 rounded">
                    <span className="flex-shrink-0 text-red-500 mt-0.5">•</span>
                    <span className="text-red-800">{risk}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {summary.opportunities && summary.opportunities.length > 0 && (
            <div className="bg-green-50 p-4 rounded-lg border border-green-200">
              <h3 className="font-semibold text-lg mb-3 flex items-center gap-2 text-green-800">
                <TrendingUp className="h-5 w-5 text-green-600" />
                Opportunities
              </h3>
              <div className="space-y-2">
                {summary.opportunities.map((opp, idx) => (
                  <div key={idx} className="flex items-start gap-3 p-2 bg-white/50 rounded">
                    <CheckCircle className="flex-shrink-0 h-4 w-4 text-green-500 mt-0.5" />
                    <span className="text-green-800">{opp}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {summary.missingInformation && summary.missingInformation.length > 0 && (
            <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
              <h3 className="font-semibold text-lg mb-3 flex items-center gap-2 text-orange-800">
                <AlertCircle className="h-5 w-5 text-orange-600" />
                Missing Information
              </h3>
              <div className="space-y-2">
                {summary.missingInformation.map((item, idx) => (
                  <div key={idx} className="flex items-start gap-3 p-2 bg-white/50 rounded">
                    <span className="flex-shrink-0 text-orange-500 mt-0.5">◦</span>
                    <span className="text-orange-800">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </ScrollArea>

      <CardFooter>
        <Button
          variant="outline"
          onClick={() => exportProjectSummary(projectId)}
          className="w-full"
        >
          <Download className="w-4 h-4 mr-2" />
          Export Summary
        </Button>
      </CardFooter>
    </Card>
  );
}

export default function DocumentSummary() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const progress = useProjectProgress(id);
  const [selectedDocumentId, setSelectedDocumentId] = useState<number | null>(null);

  const { data: project } = useQuery({
    queryKey: ['project', id],
    queryFn: () => getProject(id!),
    enabled: !!id,
  });

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['document-summary', id],
    queryFn: () => getDocumentSummary(id!),
    enabled: !!id,
    refetchInterval: (query) => {
      const queryData = query.state?.data;
      if (queryData && queryData.stats && !queryData.stats.allProcessed) {
        return 3000;
      }
      return false;
    },
  });

  const handleFileUpload = async (file: File, onProgress: (progress: ProcessingProgress) => void) => {
    if (!id) return;
    
    onProgress({ stage: 'uploading', filename: file.name, percentage: 10, message: 'Uploading...' });
    
    try {
      await uploadDocument(id, file);
      onProgress({ stage: 'parsing', filename: file.name, percentage: 40, message: 'Processing document...' });
      
      // Poll for completion
      let attempts = 0;
      while (attempts < 30) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        await refetch();
        onProgress({ 
          stage: 'embedding', 
          filename: file.name, 
          percentage: 50 + Math.min(attempts * 5, 45), 
          message: 'Extracting content...' 
        });
        attempts++;
        
        const latestData = queryClient.getQueryData(['document-summary', id]) as DocumentSummaryResponse | undefined;
        const uploadedDoc = latestData?.documents?.find(d => d.filename === file.name);
        if (uploadedDoc?.isProcessed) {
          onProgress({ stage: 'complete', filename: file.name, percentage: 100, message: 'Complete!' });
          return;
        }
      }
      onProgress({ stage: 'complete', filename: file.name, percentage: 100, message: 'Processing in background' });
    } catch (err) {
      onProgress({ stage: 'error', filename: file.name, percentage: 0, message: 'Upload failed' });
      throw err;
    }
  };

  const handleDeleteDocument = async (documentId: number) => {
    await deleteDocument(documentId);
    refetch();
  };

  const workflowStatus = (project?.workflowStatus || 'uploading') as 'uploading' | 'summarizing' | 'summary_review' | 'analyzing' | 'analysis_review' | 'conflict_check' | 'generating' | 'review' | 'completed';
  const steps = getWorkflowSteps(id || '', workflowStatus);

  const canProceed = data?.stats?.allProcessed && data?.stats?.documentCount > 0;

  useEffect(() => {
    if (data?.documents && data.documents.length > 0 && selectedDocumentId === null) {
      setSelectedDocumentId(data.documents[0].id);
    }
  }, [data?.documents, selectedDocumentId]);

  const selectedDocument = data?.documents?.find(d => d.id === selectedDocumentId);

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-blue-500" />
          <p className="text-gray-600">Loading document summary...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Failed to load document summary. Please try again.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!data) return null;

  const readinessPercentage = data.readinessScore.score;

  return (
    <ProjectWorkflowLayout
      projectId={id || ''}
      projectName={project?.name || 'Project'}
      clientName={project?.clientName}
      currentStep={0}
      steps={steps}
      nextLabel="Review Summaries"
      nextDisabled={!canProceed}
      onNext={() => navigate(`/projects/${id}/summary`)}
    >
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Upload & Verify Documents</h1>
          <p className="text-muted-foreground mt-1">
            Upload your RFP documents and verify they've been processed correctly
          </p>
        </div>

        {/* Project Files Section - Clean Design */}
        <Card className="mb-6">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Upload className="w-5 h-5 text-muted-foreground" />
                <CardTitle className="text-lg">Project Files</CardTitle>
                <Badge variant="secondary" className="ml-1">{data.documents.length}</Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {/* Upload Zone */}
            <DropZone
              files={data.documents.map(doc => ({
                id: doc.id.toString(),
                name: doc.filename,
                size: doc.fileSize || 0,
                uploadedAt: new Date(doc.uploadedAt),
                isProcessed: doc.isProcessed,
              }))}
              onUploadWithProgress={handleFileUpload}
              onDelete={handleDeleteDocument}
            />
          </CardContent>
        </Card>

        {/* Document Preview Panel */}
        {data.documents.length > 0 && (
          <Card className="mb-6">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  {selectedDocument && isImageFile(selectedDocument.filename) ? (
                    <ImageIcon className="w-5 h-5 text-primary" />
                  ) : (
                    <FileCheck className="w-5 h-5 text-primary" />
                  )}
                  {selectedDocument && isImageFile(selectedDocument.filename) ? 'Image Preview' : 'Document Preview'}
                </CardTitle>
                {/* File selector buttons */}
                <div className="flex flex-wrap gap-2">
                  {data.documents.map((doc) => (
                    <Button
                      key={doc.id}
                      variant={selectedDocumentId === doc.id ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedDocumentId(doc.id)}
                      className="gap-1 text-xs"
                    >
                      {getFileIcon(doc.filename)}
                      <span className="truncate max-w-[100px]">{doc.filename}</span>
                    </Button>
                  ))}
                </div>
              </div>
              {selectedDocument && (
                <CardDescription className="truncate mt-2">
                  {selectedDocument.filename}
                </CardDescription>
              )}
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]" data-testid="summary-scroll-area">
                {selectedDocument ? (
                  isImageFile(selectedDocument.filename) ? (
                    <div className="flex flex-col items-center space-y-4">
                      <div className="relative w-full h-[300px] bg-muted/50 rounded-lg overflow-hidden flex items-center justify-center">
                        <img
                          src={getImageUrl(selectedDocument.filename)}
                          alt={selectedDocument.filename}
                          className="max-w-full max-h-full object-contain"
                          data-testid="image-preview"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                            target.parentElement!.innerHTML = '<div class="text-center text-muted-foreground"><p>Image preview not available</p><p class="text-xs mt-1">The image may still be processing</p></div>';
                          }}
                        />
                      </div>
                      {selectedDocument.summary && (
                        <div className="w-full p-3 bg-muted/30 rounded-lg">
                          <h4 className="text-sm font-medium mb-2">AI Analysis</h4>
                          <div 
                            className="prose prose-sm max-w-none text-xs text-muted-foreground"
                            dangerouslySetInnerHTML={{ __html: selectedDocument.summary.summaryContent }}
                          />
                        </div>
                      )}
                    </div>
                  ) : selectedDocument.summary ? (
                    <div className="space-y-4">
                      <div 
                        className="prose prose-sm max-w-none text-sm text-foreground leading-relaxed [&_h2]:text-base [&_h2]:font-semibold [&_h2]:mt-4 [&_h2]:mb-2 [&_ul]:list-disc [&_ul]:pl-4 [&_li]:mb-1 [&_table]:w-full [&_table]:text-xs [&_th]:bg-muted [&_th]:p-2 [&_td]:p-2 [&_td]:border"
                        dangerouslySetInnerHTML={{ __html: selectedDocument.summary.summaryContent }}
                      />
                      {selectedDocument.keyInformation && Object.keys(selectedDocument.keyInformation).length > 0 && (
                        <div className="pt-4 border-t">
                          <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 text-blue-500" />
                            Key Information
                          </h4>
                          <div className="space-y-2 text-sm">
                            {selectedDocument.keyInformation.projectType && (
                              <div className="flex gap-2">
                                <span className="font-medium text-muted-foreground">Type:</span>
                                <span>{selectedDocument.keyInformation.projectType}</span>
                              </div>
                            )}
                            {selectedDocument.keyInformation.location && (
                              <div className="flex gap-2">
                                <span className="font-medium text-muted-foreground">Location:</span>
                                <span>{selectedDocument.keyInformation.location}</span>
                              </div>
                            )}
                            {selectedDocument.keyInformation.deadline && (
                              <div className="flex gap-2">
                                <span className="font-medium text-muted-foreground">Deadline:</span>
                                <span>{selectedDocument.keyInformation.deadline}</span>
                              </div>
                            )}
                            {selectedDocument.keyInformation.budget && (
                              <div className="flex gap-2">
                                <span className="font-medium text-muted-foreground">Budget:</span>
                                <span>{selectedDocument.keyInformation.budget}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full py-12 text-center">
                      <Clock className="w-12 h-12 text-muted-foreground/50 mb-4" />
                      <h3 className="font-medium text-muted-foreground mb-2">Summary Pending</h3>
                      <p className="text-sm text-muted-foreground/70">
                        Summary will appear here once the document is processed.
                      </p>
                    </div>
                  )
                ) : (
                  <div className="flex flex-col items-center justify-center h-full py-12 text-center">
                    <FileText className="w-12 h-12 text-muted-foreground/50 mb-4" />
                    <h3 className="font-medium text-muted-foreground mb-2">No Document Selected</h3>
                    <p className="text-sm text-muted-foreground/70">
                      Click on a document above to view its summary.
                    </p>
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        )}

      {/* Quick Stats and Readiness Score */}
      <div className="grid md:grid-cols-2 gap-6 mb-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <FileText className="w-5 h-5 mr-2 text-blue-500" />
              Quick Stats
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Documents</span>
              <span className="font-semibold">{data.stats.documentCount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Total Size</span>
              <span className="font-semibold">{formatFileSize(data.stats.totalSize)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Chunks Extracted</span>
              <span className="font-semibold">{data.stats.totalChunks}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Status</span>
              <Badge variant={data.stats.allProcessed ? 'default' : 'secondary'}>
                {data.stats.allProcessed ? 'All Processed' : 'Processing...'}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <CheckCircle className="w-5 h-5 mr-2 text-green-500" />
              Readiness Score
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex justify-between mb-2">
                <span className="font-semibold">Overall</span>
                <span className="text-2xl font-bold">{readinessPercentage}%</span>
              </div>
              <Progress value={readinessPercentage} className="h-2" />
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                {data.readinessScore.checks.documentsUploaded ? (
                  <CheckCircle className="w-4 h-4 text-green-500" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-500" />
                )}
                <span>Documents Uploaded</span>
              </div>
              <div className="flex items-center gap-2">
                {data.readinessScore.checks.documentsProcessed ? (
                  <CheckCircle className="w-4 h-4 text-green-500" />
                ) : (
                  <Clock className="w-4 h-4 text-yellow-500" />
                )}
                <span>Documents Processed</span>
              </div>
              <div className="flex items-center gap-2">
                {data.readinessScore.checks.analysisComplete ? (
                  <CheckCircle className="w-4 h-4 text-green-500" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-yellow-500" />
                )}
                <span>Analysis Complete</span>
              </div>
              {data.readinessScore.checks.missingInfo.length > 0 && (
                <div className="flex items-start gap-2 text-yellow-600">
                  <AlertTriangle className="w-4 h-4 mt-0.5" />
                  <div>
                    <div className="font-medium">Missing Information</div>
                    <ul className="list-disc list-inside text-xs mt-1">
                      {data.readinessScore.checks.missingInfo.slice(0, 3).map((item, idx) => (
                        <li key={idx}>{item}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>


      {/* Project Summary */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-4">Project Summary</h2>
        <ProjectSummaryCard summary={data.projectSummary} projectId={id!} />
      </div>

      {/* Analysis Dashboard */}
      {data.projectSummary && (
        <div className="mb-6">
          <h2 className="text-2xl font-bold mb-4">Analysis Dashboard</h2>
          <div className="grid md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm text-gray-600">Coverage</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{data.analysis.coverageScore}%</div>
                <Progress value={data.analysis.coverageScore} className="mt-2" />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm text-gray-600">Conflicts</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{data.analysis.conflictCount}</div>
                <p className="text-sm text-gray-500 mt-2">Issues detected</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm text-gray-600">Win Probability</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{data.analysis.winProbability}%</div>
                <Progress value={data.analysis.winProbability} className="mt-2" />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm text-gray-600">Risk Level</CardTitle>
              </CardHeader>
              <CardContent>
                <Badge
                  variant={
                    data.analysis.riskLevel === 'Low' ? 'default' :
                    data.analysis.riskLevel === 'Medium' ? 'secondary' :
                    'destructive'
                  }
                  className="text-base px-3 py-1"
                >
                  {data.analysis.riskLevel}
                </Badge>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      </div>
    </ProjectWorkflowLayout>
  );
}
