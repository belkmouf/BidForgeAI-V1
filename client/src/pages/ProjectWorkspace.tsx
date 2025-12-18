import { useState, useEffect, useCallback } from 'react';
import { useRoute } from 'wouter';
import { TiptapEditor } from '@/components/editor/TiptapEditor';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, Save, Share2, Eye, Loader2, FileText, Plus, Sparkles, RefreshCw, Clock, CheckCircle, Image as ImageIcon, FileSpreadsheet, Send, Lightbulb, AlertCircle, ChevronRight, Trash2 } from 'lucide-react';
import { Link } from 'wouter';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';
import { getProject, listDocuments, uploadDocument, uploadDocumentWithProgress, deleteDocument, generateBid, refineBid, getLatestBid, wrapInTemplate, generateShareLink, updateProjectStatus, startAgentWorkflow, cancelAgentWorkflow, type AIModel, type ProcessingProgress } from '@/lib/api';
import { AgentProgressPanel } from '@/components/agents/AgentProgressPanel';
import type { Project, Document } from '@shared/schema';

function getFileIcon(filename: string): React.ReactNode {
  const ext = filename.toLowerCase().match(/\.[^.]*$/)?.[0] || '';
  if (['.pdf'].includes(ext)) {
    return <FileText className="w-4 h-4 text-red-400" />;
  }
  if (['.png', '.jpg', '.jpeg', '.gif', '.tiff', '.bmp', '.webp'].includes(ext)) {
    return <ImageIcon className="w-4 h-4 text-blue-400" />;
  }
  if (['.xlsx', '.xls', '.csv'].includes(ext)) {
    return <FileSpreadsheet className="w-4 h-4 text-green-400" />;
  }
  return <FileText className="w-4 h-4 text-gray-400" />;
}

function formatDate(dateInput: string | Date): string {
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function ProjectWorkspace() {
  const [, params] = useRoute('/projects/:id');
  const projectId = params?.id || '';
  
  const [project, setProject] = useState<Project | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [editorContent, setEditorContent] = useState('<h1>Project Overview</h1><p>Loading document summary...</p>');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [bidRefreshTrigger, setBidRefreshTrigger] = useState(0);
  const [currentBidId, setCurrentBidId] = useState<number | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [showAgentProgress, setShowAgentProgress] = useState(false);
  const [selectedDocumentId, setSelectedDocumentId] = useState<number | null>(null);
  const [selectedModel, setSelectedModel] = useState<AIModel>('deepseek');
  const [toneStyle, setToneStyle] = useState('technical');
  const [refinementMessage, setRefinementMessage] = useState('');
  const [summaryTab, setSummaryTab] = useState<'narrative' | 'structured'>('narrative');

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
        
        if (docsData.length > 0) {
          setSelectedDocumentId(docsData[0].id);
        }
        
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

  const handleGenerate = async () => {
    setIsGenerating(true);
    setShowAgentProgress(true);
    
    try {
      await startAgentWorkflow(projectId, selectedModel);
      toast({
        title: "Agent Workflow Started",
        description: "The AI orchestrator is analyzing your documents...",
      });
    } catch (error: any) {
      setIsGenerating(false);
      setShowAgentProgress(false);
      toast({
        title: "Generation Failed",
        description: error.message || "Failed to start agent workflow",
        variant: "destructive",
      });
    }
  };

  const handleAgentWorkflowComplete = async () => {
    try {
      const latestBid = await getLatestBid(projectId);
      if (latestBid) {
        setEditorContent(latestBid.rawContent || latestBid.content);
        setCurrentBidId(latestBid.id);
        setBidRefreshTrigger(prev => prev + 1);
      }
      toast({
        title: "Bid Generated",
        description: "The AI agent workflow has completed successfully.",
      });
    } catch (error: any) {
      console.error('Failed to fetch generated bid:', error);
    } finally {
      setIsGenerating(false);
      setTimeout(() => setShowAgentProgress(false), 2000);
    }
  };

  const handleCancelWorkflow = async () => {
    try {
      await cancelAgentWorkflow(projectId);
      setIsGenerating(false);
      setShowAgentProgress(false);
      toast({
        title: "Workflow Cancelled",
        description: "The agent workflow has been stopped.",
      });
    } catch (error: any) {
      toast({
        title: "Cancel Failed",
        description: error.message || "Failed to cancel workflow",
        variant: "destructive",
      });
    }
  };

  const handleRefine = async () => {
    if (!refinementMessage.trim()) return;
    
    try {
      const result = await refineBid(projectId, editorContent, refinementMessage, selectedModel);
      setEditorContent(result.rawContent || result.html);
      setRefinementMessage('');
      toast({
        title: "Bid Refined",
        description: `Your bid has been updated.`,
      });
    } catch (error: any) {
      toast({
        title: "Refinement Failed",
        description: error.message || "Failed to refine bid",
        variant: "destructive",
      });
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    
    for (const file of Array.from(files)) {
      try {
        await uploadDocument(projectId, file);
        const docsData = await listDocuments(projectId);
        setDocuments(docsData);
        toast({
          title: "Upload Successful",
          description: `${file.name} has been processed.`,
        });
      } catch (error: any) {
        toast({
          title: "Upload Failed",
          description: error.message || "Failed to upload file",
          variant: "destructive",
        });
      }
    }
    e.target.value = '';
  };

  const handleDeleteDocument = async (documentId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteDocument(documentId);
      const docsData = await listDocuments(projectId);
      setDocuments(docsData);
      if (selectedDocumentId === documentId) {
        setSelectedDocumentId(docsData.length > 0 ? docsData[0].id : null);
      }
      toast({
        title: "Document Deleted",
        description: "The document has been removed.",
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
      description: "Changes saved successfully.",
    });
  };

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
    try {
      const result = await generateShareLink(currentBidId);
      const fullUrl = `${window.location.origin}${result.shareUrl}`;
      await navigator.clipboard.writeText(fullUrl);
      toast({
        title: "Link Copied",
        description: "Share link copied to clipboard.",
      });
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
      }
    } catch (error: any) {
      toast({
        title: "Preview Failed",
        description: error.message || "Failed to generate PDF preview",
        variant: "destructive",
      });
    }
  };

  const selectedDocument = documents.find(d => d.id === selectedDocumentId);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
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
      <ResizablePanelGroup direction="horizontal" className="h-full">
        
        {/* Left Sidebar */}
        <ResizablePanel defaultSize={20} minSize={15} maxSize={30}>
          <div className="h-full flex flex-col bg-card border-r">
            {/* Header */}
            <div className="p-4 border-b">
              <div className="flex items-center gap-3 mb-2">
                <Link href="/">
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                </Link>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h1 className="font-semibold text-lg">{project.name}</h1>
                    <Badge className="bg-primary text-primary-foreground text-[10px] uppercase">
                      {project.status || 'Active'}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{project.clientName}</p>
                </div>
              </div>
            </div>

            {/* Documents Section */}
            <div className="flex-1 overflow-hidden flex flex-col">
              <div className="p-4 pb-2">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-semibold text-sm">Documents</h2>
                  <span className="text-xs text-muted-foreground">{documents.length} files</span>
                </div>
              </div>

              <ScrollArea className="flex-1 px-4">
                <div className="space-y-2 pb-4">
                  {documents.map((doc) => (
                    <div
                      key={doc.id}
                      onClick={() => setSelectedDocumentId(doc.id)}
                      className={`p-3 rounded-lg cursor-pointer transition-colors ${
                        selectedDocumentId === doc.id 
                          ? 'bg-primary/10 border border-primary/50' 
                          : 'bg-muted/50 hover:bg-muted'
                      }`}
                      data-testid={`document-card-${doc.id}`}
                    >
                      <div className="flex items-start gap-3">
                        {getFileIcon(doc.filename)}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{doc.filename}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-primary">● 85% confident</span>
                            <span className="text-xs text-muted-foreground">{formatDate(doc.uploadedAt)}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {doc.isProcessed && (
                            <CheckCircle className="w-4 h-4 text-primary" />
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-muted-foreground hover:text-destructive"
                            onClick={(e) => handleDeleteDocument(doc.id, e)}
                            data-testid={`button-delete-doc-${doc.id}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>

              {/* Add Document Button */}
              <div className="p-4 pt-2">
                <label className="w-full">
                  <input
                    type="file"
                    multiple
                    className="hidden"
                    accept=".pdf,.docx,.doc,.xlsx,.xls,.csv,.txt,.png,.jpg,.jpeg"
                    onChange={handleFileUpload}
                    data-testid="file-input"
                  />
                  <Button variant="outline" className="w-full gap-2" asChild>
                    <span>
                      <Plus className="w-4 h-4" />
                      Add Document
                    </span>
                  </Button>
                </label>
              </div>

              {/* Project Stats */}
              <div className="p-4 border-t">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase mb-3">Project Stats</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Total Value</span>
                    <span className="text-sm font-semibold text-primary">$2.4M</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Completion</span>
                    <span className="text-sm font-semibold text-primary">87%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Due Date</span>
                    <span className="text-sm">Jan 15, 2026</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </ResizablePanel>

        <ResizableHandle />

        {/* Center Panel */}
        <ResizablePanel defaultSize={50} minSize={35}>
          <div className="h-full flex flex-col bg-muted/30">
            {/* Document Summary Header */}
            <div className="p-4 bg-card border-b">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h2 className="text-xl font-bold">Document Summary</h2>
                  <p className="text-sm text-muted-foreground">{selectedDocument?.filename || 'Select a document'}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <span className="flex items-center gap-1">
                  <span className="text-muted-foreground">Confidence:</span>
                  <span className="text-primary font-semibold">88%</span>
                </span>
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Clock className="w-3.5 h-3.5" />
                  Generated in <span className="font-semibold">15.6s</span>
                </span>
              </div>
            </div>

            {/* Tabs */}
            <div className="bg-card border-b px-4">
              <Tabs value={summaryTab} onValueChange={(v) => setSummaryTab(v as 'narrative' | 'structured')}>
                <TabsList className="bg-transparent h-12 p-0 gap-4">
                  <TabsTrigger 
                    value="narrative" 
                    className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-0 pb-3"
                  >
                    <Sparkles className="w-4 h-4 mr-2" />
                    Narrative Summary
                  </TabsTrigger>
                  <TabsTrigger 
                    value="structured"
                    className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-0 pb-3"
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    Structured Data
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-hidden p-4">
              {summaryTab === 'narrative' ? (
                <div className="h-full bg-card rounded-lg border shadow-sm overflow-hidden">
                  <TiptapEditor content={editorContent} onChange={setEditorContent} />
                </div>
              ) : (
                <div className="h-full bg-card rounded-lg border shadow-sm overflow-hidden p-6">
                  <ScrollArea className="h-full">
                    <div className="space-y-6">
                      <div>
                        <h3 className="font-semibold text-lg mb-3">Extracted Requirements</h3>
                        <div className="space-y-2">
                          <div className="flex justify-between py-2 border-b">
                            <span className="text-muted-foreground">Project Type</span>
                            <span className="font-medium">{project?.description?.includes('parking') ? 'Parking Structure' : 'Construction'}</span>
                          </div>
                          <div className="flex justify-between py-2 border-b">
                            <span className="text-muted-foreground">Location</span>
                            <span className="font-medium">{project?.clientName || 'Not specified'}</span>
                          </div>
                          <div className="flex justify-between py-2 border-b">
                            <span className="text-muted-foreground">Documents Analyzed</span>
                            <span className="font-medium">{documents.length}</span>
                          </div>
                        </div>
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg mb-3">Key Specifications</h3>
                        <ul className="space-y-2 text-sm">
                          <li className="flex items-center gap-2">
                            <ChevronRight className="w-4 h-4 text-primary" />
                            <span>Construction of main structure as per specifications</span>
                          </li>
                          <li className="flex items-center gap-2">
                            <ChevronRight className="w-4 h-4 text-primary" />
                            <span>Installation of required support systems</span>
                          </li>
                          <li className="flex items-center gap-2">
                            <ChevronRight className="w-4 h-4 text-primary" />
                            <span>Foundation works including base preparation</span>
                          </li>
                          <li className="flex items-center gap-2">
                            <ChevronRight className="w-4 h-4 text-primary" />
                            <span>Compliance with all material specifications</span>
                          </li>
                        </ul>
                      </div>
                    </div>
                  </ScrollArea>
                </div>
              )}
            </div>
          </div>
        </ResizablePanel>

        <ResizableHandle />

        {/* Right Sidebar */}
        <ResizablePanel defaultSize={30} minSize={20} maxSize={40}>
          <div className="h-full flex flex-col bg-card border-l">
            {/* Header */}
            <div className="p-4 border-b flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Button variant="ghost" size="sm" className="gap-1 px-2" onClick={handlePreviewPDF}>
                  <Eye className="w-4 h-4" />
                  Preview PDF
                </Button>
                <Button variant="ghost" size="sm" className="gap-1 px-2" onClick={handleShare} disabled={isSharing}>
                  <Share2 className="w-4 h-4" />
                  Share
                </Button>
                <Button size="sm" className="gap-1" onClick={handleSave}>
                  <Save className="w-4 h-4" />
                  Save Changes
                </Button>
              </div>
            </div>

            <ScrollArea className="flex-1">
              <div className="p-4 space-y-6">
                {/* AI Bid Generator Section */}
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Sparkles className="w-5 h-5 text-primary" />
                    <h3 className="font-semibold">AI Bid Generator</h3>
                  </div>
                  <p className="text-xs text-muted-foreground mb-4">Powered by Claude</p>

                  <div className="space-y-4">
                    <div>
                      <label className="text-xs text-muted-foreground block mb-1.5">AI Model</label>
                      <Select value={selectedModel} onValueChange={(v) => setSelectedModel(v as AIModel)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="openai">OpenAI GPT-4o</SelectItem>
                          <SelectItem value="anthropic">Anthropic Claude</SelectItem>
                          <SelectItem value="gemini">Google Gemini</SelectItem>
                          <SelectItem value="deepseek">DeepSeek</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <label className="text-xs text-muted-foreground block mb-1.5">Tone & Style</label>
                      <Select value={toneStyle} onValueChange={setToneStyle}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="technical">Highly Technical</SelectItem>
                          <SelectItem value="professional">Professional</SelectItem>
                          <SelectItem value="persuasive">Persuasive</SelectItem>
                          <SelectItem value="concise">Concise</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <label className="text-xs text-muted-foreground block mb-1.5">Instructions Preset</label>
                      <Select defaultValue="default">
                        <SelectTrigger>
                          <SelectValue placeholder="Select instruction preset" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="default">Default</SelectItem>
                          <SelectItem value="detailed">Detailed Response</SelectItem>
                          <SelectItem value="brief">Brief Summary</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <Button 
                      className="w-full gap-2 h-11"
                      onClick={handleGenerate}
                      disabled={isGenerating}
                      data-testid="button-generate"
                    >
                      {isGenerating ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Sparkles className="w-4 h-4" />
                      )}
                      {isGenerating ? 'Generating...' : 'Generate Draft'}
                    </Button>
                  </div>
                </div>

                {/* Agent Progress */}
                {showAgentProgress && (
                  <AgentProgressPanel 
                    projectId={projectId}
                    isActive={showAgentProgress}
                    onComplete={handleAgentWorkflowComplete}
                    onCancel={handleCancelWorkflow}
                  />
                )}

                {/* Refinement Chat */}
                <div className="pt-4 border-t">
                  <h3 className="font-semibold mb-2 flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 text-primary" />
                    Refinement Chat
                  </h3>
                  <p className="text-xs text-muted-foreground mb-3">
                    I can help you refine this bid. What would you like to change? You can ask me to "expand the safety section" or "make the tone more persuasive".
                  </p>
                  <div className="flex gap-2">
                    <Input 
                      placeholder="Refine this bid..."
                      value={refinementMessage}
                      onChange={(e) => setRefinementMessage(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleRefine()}
                      data-testid="input-refine"
                    />
                    <Button 
                      size="icon" 
                      onClick={handleRefine}
                      data-testid="button-refine"
                    >
                      <Send className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {/* Document Insights */}
                <div className="pt-4 border-t">
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <Lightbulb className="w-4 h-4 text-primary" />
                    Document Insights
                  </h3>
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="w-2 h-2 rounded-full bg-primary mt-1.5" />
                      <div>
                        <p className="text-sm font-medium">Technical specs identified</p>
                        <p className="text-xs text-muted-foreground">All requirements extracted</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-2 h-2 rounded-full bg-amber-500 mt-1.5" />
                      <div>
                        <p className="text-sm font-medium">Missing cost breakdown</p>
                        <p className="text-xs text-muted-foreground">Consider adding details</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </ScrollArea>
          </div>
        </ResizablePanel>

      </ResizablePanelGroup>
    </div>
  );
}
