import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import {
  Save,
  FileText,
  List,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Clock,
  Loader2,
  Edit3,
  Eye,
  Pencil
} from 'lucide-react';
import {
  getIndividualDocumentSummary,
  updateSummary,
  regenerateDocumentSummary
} from '@/lib/api';
import { toast } from '@/hooks/use-toast';

interface DocumentSummaryEditorProps {
  documentId: number;
  documentName: string;
  onSave?: () => void;
}

export function DocumentSummaryEditor({
  documentId,
  documentName,
  onSave
}: DocumentSummaryEditorProps) {
  const [summary, setSummary] = useState<any>(null);
  const [content, setContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    loadSummary();
  }, [documentId]);

  async function loadSummary() {
    setIsLoading(true);
    try {
      const data = await getIndividualDocumentSummary(documentId);
      setSummary(data);
      setContent(data.summaryContent);
      setHasChanges(false);
    } catch (error: any) {
      console.error('Failed to load summary:', error);
      if (error.message.includes('not found')) {
        setSummary(null);
      } else {
        toast({
          title: "Error",
          description: "Failed to load document summary",
          variant: "destructive",
        });
      }
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSave() {
    if (!summary || !hasChanges) return;

    setIsSaving(true);
    try {
      const result = await updateSummary(summary.id, {
        summaryContent: content
      });

      setSummary(result.summary);
      setHasChanges(false);

      toast({
        title: "Summary Saved",
        description: "Summary has been updated and RAG chunks regenerated.",
      });

      onSave?.();
    } catch (error: any) {
      toast({
        title: "Save Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleRegenerate() {
    if (!confirm('This will regenerate the summary from the original document. Any manual edits will be lost. Continue?')) {
      return;
    }

    setIsRegenerating(true);
    try {
      await regenerateDocumentSummary(documentId);
      await loadSummary();

      toast({
        title: "Summary Regenerated",
        description: "A new summary has been generated from the document.",
      });
    } catch (error: any) {
      toast({
        title: "Regeneration Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsRegenerating(false);
    }
  }

  function handleContentChange(newContent: string) {
    setContent(newContent);
    setHasChanges(newContent !== summary?.summaryContent);
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        <span>Loading summary...</span>
      </div>
    );
  }

  if (!summary) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          No summary available for this document. It may still be processing or generation may have failed.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              Document Summary
              {summary.isUserEdited && (
                <Badge variant="secondary">
                  <Edit3 className="h-3 w-3 mr-1" />
                  Edited
                </Badge>
              )}
            </CardTitle>
            <p className="text-sm text-muted-foreground">{documentName}</p>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRegenerate}
              disabled={isRegenerating || isSaving}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isRegenerating ? 'animate-spin' : ''}`} />
              Regenerate
            </Button>

            <Button
              onClick={handleSave}
              disabled={!hasChanges || isSaving}
              size="sm"
            >
              <Save className="h-4 w-4 mr-2" />
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>

        {/* Metadata */}
        {summary.extractionConfidence !== null && summary.extractionConfidence !== undefined && (
          <div className="flex items-center gap-4 text-xs text-muted-foreground mt-2">
            <span className="flex items-center gap-1">
              <CheckCircle className="h-3 w-3" />
              Confidence: {(summary.extractionConfidence * 100).toFixed(0)}%
            </span>
            {summary.processingTimeMs && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Generated in {(summary.processingTimeMs / 1000).toFixed(1)}s
              </span>
            )}
          </div>
        )}
      </CardHeader>

      <CardContent>
        <Tabs defaultValue="narrative" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="narrative">
              <FileText className="h-4 w-4 mr-2" />
              Narrative Summary
            </TabsTrigger>
            <TabsTrigger value="structured">
              <List className="h-4 w-4 mr-2" />
              Structured Data
            </TabsTrigger>
          </TabsList>

          <TabsContent value="narrative" className="mt-4">
            {hasChanges && (
              <Alert className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  You have unsaved changes. Click "Save Changes" to update the summary and regenerate RAG chunks.
                </AlertDescription>
              </Alert>
            )}

            <div className="flex justify-end mb-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditing(!isEditing)}
              >
                {isEditing ? (
                  <>
                    <Eye className="h-4 w-4 mr-2" />
                    Preview
                  </>
                ) : (
                  <>
                    <Pencil className="h-4 w-4 mr-2" />
                    Edit
                  </>
                )}
              </Button>
            </div>

            <div className="border rounded-lg h-[500px] overflow-hidden">
              {isEditing ? (
                <Textarea
                  value={content}
                  onChange={(e) => handleContentChange(e.target.value)}
                  className="h-full w-full resize-none font-mono text-sm p-4 border-0 focus-visible:ring-0"
                  placeholder="Enter markdown content..."
                  data-testid="textarea-summary-content"
                />
              ) : (
                <ScrollArea className="h-full p-4">
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {content}
                    </ReactMarkdown>
                  </div>
                </ScrollArea>
              )}
            </div>
          </TabsContent>

          <TabsContent value="structured" className="mt-4">
            <ScrollArea className="h-[500px] pr-4">
            <div className="space-y-6">
              {/* Requirements */}
              {summary.structuredData?.requirements && summary.structuredData.requirements.length > 0 && (
                <div>
                  <h3 className="font-semibold text-lg mb-2">Requirements</h3>
                  <div className="space-y-2">
                    {summary.structuredData.requirements.map((req: any, i: number) => (
                      <div key={i} className="p-3 border rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          {req.priority && (
                            <Badge variant={
                              req.priority === 'high' ? 'destructive' :
                              req.priority === 'medium' ? 'default' : 'secondary'
                            }>
                              {req.priority}
                            </Badge>
                          )}
                          {req.type && <Badge variant="outline">{req.type}</Badge>}
                        </div>
                        <p className="text-sm">{req.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Timeline */}
              {summary.structuredData?.timeline && (
                <div>
                  <h3 className="font-semibold text-lg mb-2">Timeline</h3>
                  <div className="p-3 border rounded-lg">
                    {summary.structuredData.timeline.duration && (
                      <p className="text-sm mb-2">
                        <strong>Duration:</strong> {summary.structuredData.timeline.duration}
                      </p>
                    )}
                    {summary.structuredData.timeline.deadlines && summary.structuredData.timeline.deadlines.length > 0 && (
                      <div>
                        <strong className="text-sm">Deadlines:</strong>
                        <ul className="list-disc pl-5 mt-1 space-y-1">
                          {summary.structuredData.timeline.deadlines.map((d: any, i: number) => (
                            <li key={i} className="text-sm">
                              <strong>{d.date}:</strong> {d.milestone}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Budget */}
              {summary.structuredData?.budgetInfo && (
                <div>
                  <h3 className="font-semibold text-lg mb-2">Budget Information</h3>
                  <div className="p-3 border rounded-lg">
                    {summary.structuredData.budgetInfo.estimated && (
                      <p className="text-sm mb-2">
                        <strong>Estimated:</strong> {summary.structuredData.budgetInfo.estimated}
                      </p>
                    )}
                    {summary.structuredData.budgetInfo.breakdown && Object.keys(summary.structuredData.budgetInfo.breakdown).length > 0 && (
                      <div className="mt-2">
                        <strong className="text-sm">Breakdown:</strong>
                        <pre className="mt-1 text-xs bg-muted p-2 rounded overflow-auto">
                          {JSON.stringify(summary.structuredData.budgetInfo.breakdown, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Materials */}
              {summary.structuredData?.materials && summary.structuredData.materials.length > 0 && (
                <div>
                  <h3 className="font-semibold text-lg mb-2">Materials</h3>
                  <div className="space-y-1">
                    {summary.structuredData.materials.map((mat: any, i: number) => (
                      <div key={i} className="p-2 border rounded text-sm">
                        <strong>{mat.name}</strong>
                        {mat.specification && <span className="text-muted-foreground"> - {mat.specification}</span>}
                        {mat.quantity && <span className="text-muted-foreground"> ({mat.quantity})</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Quantities */}
              {summary.structuredData?.quantities && summary.structuredData.quantities.length > 0 && (
                <div>
                  <h3 className="font-semibold text-lg mb-2">Quantities</h3>
                  <div className="space-y-1">
                    {summary.structuredData.quantities.map((qty: any, i: number) => (
                      <div key={i} className="p-2 border rounded text-sm flex justify-between">
                        <span>{qty.item}</span>
                        <span className="font-mono">{qty.quantity} {qty.unit || ''}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Constraints */}
              {summary.structuredData?.constraints && summary.structuredData.constraints.length > 0 && (
                <div>
                  <h3 className="font-semibold text-lg mb-2">Constraints</h3>
                  <ul className="list-disc pl-5 space-y-1">
                    {summary.structuredData.constraints.map((constraint: string, i: number) => (
                      <li key={i} className="text-sm">{constraint}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Specifications */}
              {summary.structuredData?.specifications && Object.keys(summary.structuredData.specifications).length > 0 && (
                <div>
                  <h3 className="font-semibold text-lg mb-2">Specifications</h3>
                  <div className="p-3 border rounded-lg">
                    <pre className="text-xs bg-muted p-2 rounded overflow-auto">
                      {JSON.stringify(summary.structuredData.specifications, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
