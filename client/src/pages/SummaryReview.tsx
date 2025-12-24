import { useParams, useLocation } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
  getDocumentSummary,
  updateSummary,
  acceptSummaries,
  getProject,
  regenerateDocumentSummary,
  type DocumentSummaryResponse,
} from '../lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { ScrollArea } from '../components/ui/scroll-area';
import { Loader2, FileText, CheckCircle, Edit2, Save, X, RefreshCw, ArrowRight } from 'lucide-react';
import { Textarea } from '../components/ui/textarea';
import { Alert, AlertDescription } from '../components/ui/alert';
import { ProjectWorkflowLayout, getWorkflowSteps, type WorkflowStatus } from '../components/workflow/ProjectWorkflowLayout';
import { Separator } from '../components/ui/separator';

function DocumentSummaryCard({ 
  document, 
  onSave,
  onRegenerate,
  isRegenerating,
}: { 
  document: DocumentSummaryResponse['documents'][0];
  onSave: (documentId: number, summaryId: number, content: string) => Promise<void>;
  onRegenerate: (documentId: number) => Promise<void>;
  isRegenerating: boolean;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(document.summary?.summaryContent || '');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!document.summary?.id) return;
    setIsSaving(true);
    try {
      await onSave(document.id, document.summary.id, editContent);
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card className="mb-4" data-testid={`card-document-${document.id}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <FileText className="w-5 h-5 text-blue-500" />
            <div>
              <CardTitle className="text-base">{document.filename}</CardTitle>
              <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                {document.pageCount && <span>{document.pageCount} pages</span>}
                {document.summary && (
                  <Badge variant="outline" className="text-xs">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Summarized
                  </Badge>
                )}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onRegenerate(document.id)}
              disabled={isRegenerating}
              data-testid={`button-regenerate-${document.id}`}
            >
              <RefreshCw className={`w-4 h-4 mr-1 ${isRegenerating ? 'animate-spin' : ''}`} />
              Regenerate
            </Button>
            {document.summary && !isEditing && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setEditContent(document.summary?.summaryContent || '');
                  setIsEditing(true);
                }}
                data-testid={`button-edit-${document.id}`}
              >
                <Edit2 className="w-4 h-4 mr-1" />
                Edit
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {document.summary ? (
          isEditing ? (
            <div className="space-y-3">
              <Textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="min-h-[200px] font-mono text-sm"
                data-testid={`textarea-edit-${document.id}`}
              />
              <div className="flex justify-end gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsEditing(false)}
                  disabled={isSaving}
                  data-testid={`button-cancel-${document.id}`}
                >
                  <X className="w-4 h-4 mr-1" />
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={isSaving}
                  data-testid={`button-save-${document.id}`}
                >
                  {isSaving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
                  Save
                </Button>
              </div>
            </div>
          ) : (
            <ScrollArea className="max-h-[300px]">
              <div 
                className="prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: document.summary.summaryContent }}
              />
            </ScrollArea>
          )
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No summary available yet</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={() => onRegenerate(document.id)}
              disabled={isRegenerating}
            >
              Generate Summary
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function SummaryReview() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const [regeneratingId, setRegeneratingId] = useState<number | null>(null);

  const { data: project, isLoading: projectLoading } = useQuery({
    queryKey: ['project', id],
    queryFn: () => getProject(id!),
    enabled: !!id,
  });

  const { data: summaryData, isLoading: summaryLoading } = useQuery({
    queryKey: ['document-summary', id],
    queryFn: () => getDocumentSummary(id!),
    enabled: !!id,
  });

  const acceptMutation = useMutation({
    mutationFn: () => acceptSummaries(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', id] });
      navigate(`/projects/${id}/analysis`);
    },
  });

  const handleSaveSummary = async (documentId: number, summaryId: number, content: string) => {
    await updateSummary(summaryId, { summaryContent: content });
    queryClient.invalidateQueries({ queryKey: ['document-summary', id] });
  };

  const handleRegenerate = async (documentId: number) => {
    setRegeneratingId(documentId);
    try {
      await regenerateDocumentSummary(documentId);
      queryClient.invalidateQueries({ queryKey: ['document-summary', id] });
    } finally {
      setRegeneratingId(null);
    }
  };

  if (projectLoading || summaryLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (!project || !id) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Project not found</p>
      </div>
    );
  }

  const workflowStatus = (project.workflowStatus || 'uploading') as WorkflowStatus;
  const steps = getWorkflowSteps(id, workflowStatus);

  const documents = summaryData?.documents || [];
  const hasSummaries = documents.some(d => d.summary);
  const allHaveSummaries = documents.length > 0 && documents.every(d => d.summary);

  return (
    <ProjectWorkflowLayout
      projectId={id}
      projectName={project.name}
      clientName={project.clientName}
      currentStep={1}
      steps={steps}
      backLabel="Back to Documents"
      onBack={() => navigate(`/projects/${id}/documents`)}
      nextLabel="Accept & Continue to Analysis"
      nextDisabled={!allHaveSummaries || acceptMutation.isPending}
      onNext={() => acceptMutation.mutate()}
    >
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h2 className="text-2xl font-bold" data-testid="text-page-title">Review Document Summaries</h2>
          <p className="text-muted-foreground mt-1">
            Review and edit the AI-generated summaries before proceeding to RFP analysis.
          </p>
        </div>

        {!hasSummaries && (
          <Alert className="mb-6">
            <AlertDescription>
              No summaries have been generated yet. Please wait for document processing to complete or upload documents first.
            </AlertDescription>
          </Alert>
        )}

        {documents.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <FileText className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="font-medium mb-2">No Documents Found</h3>
              <p className="text-muted-foreground mb-4">
                Upload documents to start the summarization process.
              </p>
              <Button onClick={() => navigate(`/projects/${id}/documents`)}>
                Go to Documents
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="flex items-center justify-between mb-4">
              <Badge variant="outline" className="text-sm">
                {documents.filter(d => d.summary).length} / {documents.length} documents summarized
              </Badge>
            </div>

            <div className="space-y-4">
              {documents.map((doc) => (
                <DocumentSummaryCard
                  key={doc.id}
                  document={doc}
                  onSave={handleSaveSummary}
                  onRegenerate={handleRegenerate}
                  isRegenerating={regeneratingId === doc.id}
                />
              ))}
            </div>

            <Separator className="my-6" />

            <div className="flex justify-end">
              <Button
                size="lg"
                onClick={() => acceptMutation.mutate()}
                disabled={!allHaveSummaries || acceptMutation.isPending}
                data-testid="button-accept-summaries"
              >
                {acceptMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <ArrowRight className="w-4 h-4 mr-2" />
                )}
                Accept Summaries & Proceed to Analysis
              </Button>
            </div>
          </>
        )}
      </div>
    </ProjectWorkflowLayout>
  );
}
