import { useState } from 'react';
import { useRoute } from 'wouter';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { DropZone } from '@/components/upload/DropZone';
import { TiptapEditor } from '@/components/editor/TiptapEditor';
import { GeneratePanel } from '@/components/ai/GeneratePanel';
import { RefineChat } from '@/components/ai/RefineChat';
import { mockProjects, initialEditorContent, mockFiles } from '@/lib/mockData';
import { Button } from '@/components/ui/button';
import { ChevronLeft, Save, Share2, Eye } from 'lucide-react';
import { Link } from 'wouter';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { toast } from '@/hooks/use-toast';

export default function ProjectWorkspace() {
  const [, params] = useRoute('/projects/:id');
  const project = mockProjects.find(p => p.id === params?.id) || mockProjects[0];
  const [editorContent, setEditorContent] = useState(initialEditorContent);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = (instructions: string) => {
    setIsGenerating(true);
    // Simulate AI generation delay
    setTimeout(() => {
      setIsGenerating(false);
      toast({
        title: "Bid Generated",
        description: "The proposal has been updated with new content based on your instructions.",
      });
      // In a real app, we'd update the editor content here
    }, 2000);
  };

  const handleRefine = (feedback: string) => {
    toast({
      title: "Refining...",
      description: "AI is adjusting the proposal based on your feedback.",
    });
  };

  const handleSave = () => {
    toast({
      title: "Saved",
      description: "Project saved successfully.",
    });
  };

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
              <p className="text-xs text-muted-foreground">{project.client}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
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
                  <DropZone files={mockFiles} />
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