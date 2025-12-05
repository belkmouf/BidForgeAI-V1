import { useRoute, Link } from 'wouter';
import { useState, useEffect } from 'react';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { ConflictDetection } from '@/components/ConflictDetection';
import { Button } from '@/components/ui/button';
import { ChevronLeft, AlertTriangle } from 'lucide-react';
import { getProject } from '@/lib/api';
import type { Project } from '@shared/schema';
import { toast } from '@/hooks/use-toast';

export default function ProjectConflicts() {
  const [, params] = useRoute('/projects/:id/conflicts');
  const projectId = params?.id || '';
  
  const [project, setProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadProject() {
      if (!projectId) return;
      try {
        const projectData = await getProject(projectId);
        setProject(projectData);
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

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="text-lg font-semibold">Loading...</div>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="text-lg font-semibold">Project not found</div>
          <Link href="/dashboard">
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
        <header className="h-14 border-b border-border flex items-center justify-between px-6 bg-card z-10">
          <div className="flex items-center gap-4">
            <Link href={`/projects/${projectId}`}>
              <Button variant="ghost" size="icon" className="h-8 w-8" data-testid="button-back">
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-500/10">
                <AlertTriangle className="h-5 w-5 text-orange-500" />
              </div>
              <div>
                <h1 className="font-semibold text-sm flex items-center gap-2">
                  Conflict Detection
                  <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-wider">
                    {project.status}
                  </span>
                </h1>
                <p className="text-xs text-muted-foreground">{project.name} • {project.clientName}</p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Link href={`/projects/${projectId}`}>
              <Button variant="outline" size="sm" className="gap-2 h-8" data-testid="button-workspace">
                Back to Workspace
              </Button>
            </Link>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-6">
          <ConflictDetection projectId={projectId} />
        </main>
      </div>
    </div>
  );
}
