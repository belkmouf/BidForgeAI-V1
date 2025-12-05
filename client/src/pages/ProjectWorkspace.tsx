import { useState, useEffect } from 'react';
import { useRoute } from 'wouter';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { DropZone } from '@/components/upload/DropZone';
import { TiptapEditor } from '@/components/editor/TiptapEditor';
import { GeneratePanel } from '@/components/ai/GeneratePanel';
import { RefineChat } from '@/components/ai/RefineChat';
import { Button } from '@/components/ui/button';
import { ChevronLeft, Save, Share2, Eye, ShieldCheck, AlertTriangle } from 'lucide-react';
import { Link } from 'wouter';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { toast } from '@/hooks/use-toast';
import { getProject, listDocuments, uploadDocument, generateBid, refineBid, type AIModel } from '@/lib/api';
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

  useEffect(() => {
    async function loadProject() {
      if (!projectId) return;
      try {
        const [projectData, docsData] = await Promise.all([
          getProject(projectId),
          listDocuments(projectId)
        ]);
        setProject(projectData);
        setDocuments(docsData);
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
      setEditorContent(result.html);
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
      setEditorContent(result.html);
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

  const handleSave = () => {
    toast({
      title: "Saved",
      description: "Project saved successfully.",
    });
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
                <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-wider">
                  {project.status}
                </span>
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
            <Button variant="outline" size="sm" className="gap-2 h-8">
              <Eye className="h-3.5 w-3.5" />
              Preview PDF
            </Button>
            <Button variant="outline" size="sm" className="gap-2 h-8">
              <Share2 className="h-3.5 w-3.5" />
              Share
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
            
            {/* Left: Upload Zone */}
            <ResizablePanel defaultSize={20} minSize={15} maxSize={30} className="bg-muted/20">
              <div className="h-full p-4 flex flex-col">
                <h2 className="font-semibold text-sm mb-4 flex items-center gap-2">
                  Source Documents
                </h2>
                <div className="flex-1 overflow-hidden">
                  <DropZone 
                    files={documents.filter(doc => doc).map(doc => ({
                      name: doc.filename,
                      size: 0,
                      uploadedAt: new Date(doc.uploadedAt),
                      id: doc.id.toString()
                    }))}
                    onUpload={handleFileUpload}
                  />
                </div>
              </div>
            </ResizablePanel>

            <ResizableHandle />

            {/* Center: Editor */}
            <ResizablePanel defaultSize={55} minSize={30}>
              <div className="h-full flex flex-col bg-muted/10">
                 <div className="flex-1 p-6 overflow-hidden">
                   <TiptapEditor content={editorContent} onChange={setEditorContent} />
                 </div>
              </div>
            </ResizablePanel>

            <ResizableHandle />

            {/* Right: AI Controls */}
            <ResizablePanel defaultSize={25} minSize={20} maxSize={40} className="bg-card border-l border-border">
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