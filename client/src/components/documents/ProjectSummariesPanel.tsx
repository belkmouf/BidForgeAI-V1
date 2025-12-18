import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FileText, Edit3, ChevronRight, Loader2, Sparkles } from 'lucide-react';
import { getProjectSummaries, generateAllProjectSummaries } from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface ProjectSummariesPanelProps {
  projectId: string;
  onSelectDocument?: (documentId: number, documentName: string) => void;
}

export function ProjectSummariesPanel({
  projectId,
  onSelectDocument
}: ProjectSummariesPanelProps) {
  const [summaries, setSummaries] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    loadSummaries();
  }, [projectId]);

  async function loadSummaries() {
    setIsLoading(true);
    try {
      const data = await getProjectSummaries(projectId);
      setSummaries(data);
    } catch (error) {
      console.error('Failed to load summaries:', error);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleGenerateSummaries() {
    setIsGenerating(true);
    try {
      const result = await generateAllProjectSummaries(projectId);
      toast({
        title: "Summaries Generated",
        description: result.message,
      });
      loadSummaries();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to generate summaries",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        <span>Loading summaries...</span>
      </div>
    );
  }

  if (summaries.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">
          <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p>No document summaries available yet.</p>
          <p className="text-sm mt-1">Summaries are automatically generated when documents are uploaded.</p>
          <Button 
            onClick={handleGenerateSummaries} 
            disabled={isGenerating}
            className="mt-4"
            size="sm"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Generate Summaries
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <ScrollArea className="h-[calc(100vh-200px)]">
      <div className="space-y-3 pr-4">
        {summaries.map(({ summary, document }) => (
          <Card
            key={summary.id}
            className="cursor-pointer hover:border-primary transition-colors"
            onClick={() => onSelectDocument?.(document.id, document.filename)}
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span className="font-medium text-sm truncate">{document.filename}</span>
                    {summary.isUserEdited && (
                      <Badge variant="secondary" className="text-xs flex-shrink-0">
                        <Edit3 className="h-2 w-2 mr-1" />
                        Edited
                      </Badge>
                    )}
                  </div>

                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {summary.summaryContent.substring(0, 150)}...
                  </p>

                  <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                    {summary.extractionConfidence !== null && summary.extractionConfidence !== undefined && (
                      <span>
                        Confidence: {(summary.extractionConfidence * 100).toFixed(0)}%
                      </span>
                    )}
                    {summary.createdAt && (
                      <>
                        <span>•</span>
                        <span>
                          {format(new Date(summary.createdAt), 'MMM d, yyyy')}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0 ml-2" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </ScrollArea>
  );
}
