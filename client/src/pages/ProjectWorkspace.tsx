import { useState, useEffect, useCallback } from 'react';
import { useRoute } from 'wouter';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { DropZone } from '@/components/upload/DropZone';
import { TiptapEditor } from '@/components/editor/TiptapEditor';
import { GeneratePanel } from '@/components/ai/GeneratePanel';
import { RefineChat } from '@/components/ai/RefineChat';
import { BidHistory } from '@/components/bid/BidHistory';
import { Button } from '@/components/ui/button';
import { ChevronLeft, Save, Share2, Eye, Edit3, ShieldCheck, AlertTriangle, Loader2 } from 'lucide-react';
import { Link } from 'wouter';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { getProject, listDocuments, uploadDocument, deleteDocument, generateBid, refineBid, getLatestBid, wrapInTemplate, generateShareLink, updateProjectStatus, type AIModel } from '@/lib/api';
import type { Project, Document } from '@shared/schema';

const initialEditorContent = '<h1>Welcome to BidForge AI</h1><p>Use the Generate panel to create your first bid draft, or start typing to manually build your proposal.</p>';

export default function ProjectWorkspace() {
  const [, params] = useRoute('/projects/:id');
  const projectId = params?.id || '';
  
  const [project, setProject] = useState<Project | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [editorContent, setEditorContent] = useState(initialEditorContent);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [bidRefreshTrigger, setBidRefreshTrigger] = useState(0);
  const [viewMode, setViewMode] = useState<'edit' | 'preview'>('edit');
  const [previewHtml, setPreviewHtml] = useState<string>('');
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [currentBidId, setCurrentBidId] = useState<number | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  const handleStatusChange = async (newStatus: string) => {
    if (!project) return;
    setIsUpdatingStatus(true);
    try {
      const updatedProject = await updateProjectStatus(projectId, newStatus);
      setProject(updatedProject);
      toast({
        title: "Status Updated",
        description: `Project status changed to ${newStatus}`,
      });
    } catch (error) {
      console.error('Failed to update status:', error);
      toast({
        title: "Error",
        description: "Failed to update project status",
        variant: "destructive",
      });
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  useEffect(() => {
    async function loadProject() {
      if (!projectId) return;
      try {
        const [projectData, docsData, latestBid] = await Promise.all([
          getProject(projectId),
          listDocuments(projectId),
          getLatestBid(projectId)
        ]);
        setProject(projectData);
        setDocuments(docsData);
        
        // Load the latest bid content if available (use rawContent for editor)
        if (latestBid) {
          setEditorContent(latestBid.rawContent || latestBid.content);
          setCurrentBidId(latestBid.id);
        }
      } catch (error) {
        console.error('Failed to load project:', error);
        toast({
          title: "Error",
          description: "Failed to load project data",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    }
    loadProject();
  }, [projectId]);

  const [selectedModel, setSelectedModel] = useState<AIModel>('openai');

  const handleGenerate = async (instructions: string, tone?: string, model?: AIModel) => {
    setIsGenerating(true);
    const modelToUse = model || selectedModel;
    setSelectedModel(modelToUse);
    try {
      const result = await generateBid(projectId, instructions, tone, modelToUse);
      setEditorContent(result.rawContent || result.html);
      setBidRefreshTrigger(prev => prev + 1);
      if (result.bid?.id) {
        setCurrentBidId(result.bid.id);
      }
      toast({
        title: "Bid Generated",
        description: `Generated bid using ${result.chunksUsed} context chunks with ${result.model.toUpperCase()}.`,
      });
    } catch (error: any) {
      toast({
        title: "Generation Failed",
        description: error.message || "Failed to generate bid",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRefine = async (feedback: string) => {
    try {
      const result = await refineBid(projectId, editorContent, feedback, selectedModel);
      setEditorContent(result.rawContent || result.html);
      toast({
        title: "Bid Refined",
        description: `Your bid has been updated using ${result.model.toUpperCase()}.`,
      });
    } catch (error: any) {
      toast({
        title: "Refinement Failed",
        description: error.message || "Failed to refine bid",
        variant: "destructive",
      });
    }
  };

  const handleFileUpload = async (file: File) => {
    try {
      const result = await uploadDocument(projectId, file);
      // Reload documents list after successful upload
      const docsData = await listDocuments(projectId);
      setDocuments(docsData);
      toast({
        title: "Upload Successful",
        description: `${file.name} has been processed (${result.filesProcessed} file(s), ${result.totalChunks} chunks).`,
      });
    } catch (error: any) {
      toast({
        title: "Upload Failed",
        description: error.message || "Failed to upload file",
        variant: "destructive",
      });
    }
  };

  const handleDeleteDocument = async (documentId: number) => {
    try {
      await deleteDocument(documentId);
      // Reload documents list after successful deletion
      const docsData = await listDocuments(projectId);
      setDocuments(docsData);
      toast({
        title: "Document Deleted",
        description: "The document and its data have been removed.",
      });
    } catch (error: any) {
      toast({
        title: "Delete Failed",
        description: error.message || "Failed to delete document",
        variant: "destructive",
      });
    }
  };

  const handleSave = () => {
    toast({
      title: "Saved",
      description: "Project saved successfully.",
    });
  };

  const handleViewModeChange = useCallback(async (mode: 'edit' | 'preview') => {
    setViewMode(mode);
    if (mode === 'preview' && project) {
      setIsLoadingPreview(true);
      try {
        const result = await wrapInTemplate(
          editorContent,
          project.name,
          project.clientName || 'Valued Client'
        );
        setPreviewHtml(result.html);
      } catch (error: any) {
        toast({
          title: "Preview Failed",
          description: error.message || "Failed to generate preview",
          variant: "destructive",
        });
        setViewMode('edit');
      } finally {
        setIsLoadingPreview(false);
      }
    }
  }, [editorContent, project]);

  const handleShare = async () => {
    if (!currentBidId) {
      toast({
        title: "No Bid to Share",
        description: "Generate a bid first before sharing.",
        variant: "destructive",
      });
      return;
    }

    setIsSharing(true);
    
    const copyToClipboard = async (text: string): Promise<boolean> => {
      if (navigator.clipboard && window.isSecureContext) {
        try {
          await navigator.clipboard.writeText(text);
          return true;
        } catch {
          // Fall through to legacy method
        }
      }
      
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      
      try {
        const success = document.execCommand('copy');
        document.body.removeChild(textArea);
        return success;
      } catch {
        document.body.removeChild(textArea);
        return false;
      }
    };
    
    try {
      const result = await generateShareLink(currentBidId);
      const fullUrl = `${window.location.origin}${result.shareUrl}`;
      const copied = await copyToClipboard(fullUrl);
      
      if (copied) {
        toast({
          title: "Public Link Copied",
          description: "Anyone with this link can view the bid (no login required).",
        });
      } else {
        toast({
          title: "Share Link",
          description: fullUrl,
        });
      }
    } catch (error: any) {
      toast({
        title: "Share Failed",
        description: error.message || "Failed to generate share link",
        variant: "destructive",
      });
    } finally {
      setIsSharing(false);
    }
  };

  const handlePreviewPDF = async () => {
    if (!project) return;
    
    try {
      const result = await wrapInTemplate(
        editorContent,
        project.name,
        project.clientName || 'Valued Client'
      );
      
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(result.html);
        printWindow.document.close();
        toast({
          title: "Preview Opened",
          description: "Use your browser's print function to save as PDF.",
        });
      }
    } catch (error: any) {
      toast({
        title: "Preview Failed",
        description: error.message || "Failed to generate PDF preview",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="text-lg font-semibold">Loading project...</div>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="text-lg font-semibold">Project not found</div>
          <Link href="/">
            <Button className="mt-4">Back to Dashboard</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <AppSidebar />
      
      <div className="flex-1 flex flex-col ml-64 h-full">
        {/* Header */}
        <header className="h-14 border-b border-border flex items-center justify-between px-4 bg-card z-10">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h1 className="font-semibold text-sm flex items-center gap-2">
                {project.name}
                <Select 
                  value={project.status || 'Active'} 
                  onValueChange={handleStatusChange}
                  disabled={isUpdatingStatus}
                >
                  <SelectTrigger className="h-6 w-auto px-2 py-0 text-[10px] font-bold uppercase tracking-wider bg-primary/10 border-0 text-primary" data-testid="select-project-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Submitted">Submitted</SelectItem>
                    <SelectItem value="Closed-Won">Closed-Won</SelectItem>
                    <SelectItem value="Closed-Lost">Closed-Lost</SelectItem>
                  </SelectContent>
                </Select>
              </h1>
              <p className="text-xs text-muted-foreground">{project.clientName}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Link href={`/projects/${projectId}/analysis`}>
              <Button variant="outline" size="sm" className="gap-2 h-8" data-testid="button-analysis">
                <ShieldCheck className="h-3.5 w-3.5" />
                RFP Analysis
              </Button>
            </Link>
            <Link href={`/projects/${projectId}/conflicts`}>
              <Button variant="outline" size="sm" className="gap-2 h-8" data-testid="button-conflicts">
                <AlertTriangle className="h-3.5 w-3.5" />
                Conflicts
              </Button>
            </Link>
            <Button variant="outline" size="sm" className="gap-2 h-8" onClick={handlePreviewPDF} data-testid="button-preview-pdf">
              <Eye className="h-3.5 w-3.5" />
              Preview PDF
            </Button>
            <Button variant="outline" size="sm" className="gap-2 h-8" onClick={handleShare} disabled={isSharing || !currentBidId} data-testid="button-share">
              {isSharing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Share2 className="h-3.5 w-3.5" />}
              {isSharing ? 'Sharing...' : 'Share'}
            </Button>
            <Button size="sm" className="gap-2 h-8" onClick={handleSave}>
              <Save className="h-3.5 w-3.5" />
              Save
            </Button>
          </div>
        </header>

        {/* Workspace Layout */}
        <div className="flex-1 overflow-hidden">
          <ResizablePanelGroup direction="horizontal">
            
            {/* Left: Upload Zone + Bid History */}
            <ResizablePanel defaultSize={20} minSize={15} maxSize={30} className="bg-primary/20">
              <div className="h-full p-4 flex flex-col gap-4">
                <div className="flex-shrink-0">
                  <h2 className="font-semibold text-sm mb-4 flex items-center gap-2">
                    Source Documents
                  </h2>
                  <DropZone 
                    files={documents.filter(doc => doc).map(doc => ({
                      name: doc.filename,
                      size: 0,
                      uploadedAt: new Date(doc.uploadedAt),
                      id: doc.id.toString()
                    }))}
                    onUpload={handleFileUpload}
                    onDelete={handleDeleteDocument}
                  />
                </div>
                <div className="flex-1 min-h-0 overflow-hidden">
                  <BidHistory 
                    projectId={projectId} 
                    onSelectBid={(content, bidId) => {
                      setEditorContent(content);
                      if (bidId) setCurrentBidId(bidId);
                    }}
                    refreshTrigger={bidRefreshTrigger}
                  />
                </div>
              </div>
            </ResizablePanel>

            <ResizableHandle />

            {/* Center: Editor / Preview */}
            <ResizablePanel defaultSize={55} minSize={30}>
              <div className="h-full flex flex-col bg-muted/10">
                <div className="flex items-center justify-between px-6 pt-4 pb-2">
                  <Tabs value={viewMode} onValueChange={(v) => handleViewModeChange(v as 'edit' | 'preview')}>
                    <TabsList className="h-8">
                      <TabsTrigger value="edit" className="text-xs gap-1.5 px-3" data-testid="tab-edit">
                        <Edit3 className="h-3.5 w-3.5" />
                        Edit
                      </TabsTrigger>
                      <TabsTrigger value="preview" className="text-xs gap-1.5 px-3" data-testid="tab-preview">
                        <Eye className="h-3.5 w-3.5" />
                        Preview
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
                <div className="flex-1 px-6 pb-6 overflow-hidden">
                  {viewMode === 'edit' ? (
                    <TiptapEditor content={editorContent} onChange={setEditorContent} />
                  ) : isLoadingPreview ? (
                    <div className="h-full flex items-center justify-center bg-white rounded-lg border">
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <Loader2 className="h-8 w-8 animate-spin" />
                        <span className="text-sm">Generating preview...</span>
                      </div>
                    </div>
                  ) : (
                    <iframe
                      srcDoc={previewHtml}
                      className="w-full h-full border rounded-lg bg-white"
                      title="Bid Preview"
                      data-testid="iframe-bid-preview"
                    />
                  )}
                </div>
              </div>
            </ResizablePanel>

            <ResizableHandle />

            {/* Right: AI Controls */}
            <ResizablePanel defaultSize={25} minSize={20} maxSize={40} className="bg-primary/20 border-l border-border">
              <div className="h-full flex flex-col p-4">
                <div className="flex-1 flex flex-col min-h-0 gap-6">
                  <GeneratePanel onGenerate={handleGenerate} isGenerating={isGenerating} />
                  <div className="flex-1 min-h-0 flex flex-col">
                    <RefineChat onRefine={handleRefine} />
                  </div>
                </div>
              </div>
            </ResizablePanel>

          </ResizablePanelGroup>
        </div>
      </div>
    </div>
  );
}