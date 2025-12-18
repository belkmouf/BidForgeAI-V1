import { useRoute, Link, useLocation } from 'wouter';
import { useState, useEffect } from 'react';
import { ConflictDetection } from '@/components/ConflictDetection';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { getProject } from '@/lib/api';
import type { Project } from '@shared/schema';
import { toast } from '@/hooks/use-toast';
import { ProjectWorkflowLayout, getWorkflowSteps } from '@/components/workflow/ProjectWorkflowLayout';
import { useProjectProgress } from '@/hooks/useProjectProgress';

export default function ProjectConflicts() {
  const [, params] = useRoute('/projects/:id/conflicts');
  const [, navigate] = useLocation();
  const projectId = params?.id || '';
  const progress = useProjectProgress(projectId);
  
  const [project, setProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [conflictsReviewed, setConflictsReviewed] = useState(false);

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

  const workflowStatus = (project?.workflowStatus || 'conflict_check') as 'uploading' | 'summarizing' | 'summary_review' | 'analyzing' | 'analysis_review' | 'conflict_check' | 'generating' | 'review' | 'completed';
  const steps = getWorkflowSteps(projectId, workflowStatus);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
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
    <ProjectWorkflowLayout
      projectId={projectId}
      projectName={project.name}
      clientName={project.clientName}
      currentStep={3}
      steps={steps}
      backLabel="Back to Analysis"
      onBack={() => navigate(`/projects/${projectId}/analysis`)}
      nextLabel="Generate Bid"
      nextDisabled={false}
      onNext={() => {
        setConflictsReviewed(true);
        navigate(`/projects/${projectId}`);
      }}
    >
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Review Conflicts</h1>
          <p className="text-muted-foreground mt-1">
            Review any detected conflicts or inconsistencies in your RFP documents
          </p>
        </div>
        <ConflictDetection projectId={projectId} />
      </div>
    </ProjectWorkflowLayout>
  );
}
