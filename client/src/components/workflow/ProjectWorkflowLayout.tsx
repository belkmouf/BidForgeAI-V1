import { ReactNode } from 'react';
import { Link, useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, FileText, ShieldCheck, AlertTriangle, Sparkles, ClipboardList } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface WorkflowStep {
  id: string;
  title: string;
  path: string;
  icon: ReactNode;
  isCompleted: boolean;
  isAccessible: boolean;
}

interface ProjectWorkflowLayoutProps {
  projectId: string;
  projectName: string;
  clientName?: string;
  currentStep: number;
  steps: WorkflowStep[];
  children: ReactNode;
  onNext?: () => void;
  onBack?: () => void;
  nextLabel?: string;
  backLabel?: string;
  nextDisabled?: boolean;
  showNavigation?: boolean;
}

export function ProjectWorkflowLayout({
  projectId,
  projectName,
  clientName,
  currentStep,
  steps,
  children,
  onNext,
  onBack,
  nextLabel = 'Continue',
  backLabel = 'Back',
  nextDisabled = false,
  showNavigation = true,
}: ProjectWorkflowLayoutProps) {
  const [, navigate] = useLocation();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else if (currentStep > 0) {
      navigate(steps[currentStep - 1].path);
    }
  };

  const handleNext = () => {
    if (onNext) {
      onNext();
    } else if (currentStep < steps.length - 1) {
      navigate(steps[currentStep + 1].path);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/projects">
                <Button variant="ghost" size="icon" className="h-8 w-8" data-testid="button-back">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              </Link>
              <div>
                <h1 className="font-semibold text-lg" data-testid="text-project-name">{projectName}</h1>
                {clientName && (
                  <p className="text-sm text-muted-foreground">{clientName}</p>
                )}
              </div>
            </div>
            <div className="text-sm text-muted-foreground">
              Step {currentStep + 1} of {steps.length}
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-6">
        {children}
      </main>

      {showNavigation && (
        <footer className="border-t bg-card sticky bottom-0">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <Button
              variant="outline"
              onClick={handleBack}
              disabled={currentStep === 0}
              data-testid="button-back"
            >
              <ChevronLeft className="w-4 h-4 mr-2" />
              {backLabel}
            </Button>

            <div className="text-sm text-muted-foreground">
              Step {currentStep + 1} of {steps.length}
            </div>

            <Button
              onClick={handleNext}
              disabled={nextDisabled || currentStep === steps.length - 1}
              data-testid="button-next"
            >
              {nextLabel}
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </footer>
      )}
    </div>
  );
}

// Workflow status progression
const workflowOrder = [
  'uploading',
  'summarizing', 
  'summary_review',
  'analyzing',
  'analysis_review',
  'conflict_check',
  'generating',
  'review',
  'completed'
] as const;

export type WorkflowStatus = typeof workflowOrder[number];

// Check if we've reached or passed a given workflow status
export function hasReachedStatus(current: WorkflowStatus | undefined, target: WorkflowStatus): boolean {
  if (!current) return false;
  return workflowOrder.indexOf(current) >= workflowOrder.indexOf(target);
}

export interface WorkflowStepsOptions {
  checklistComplete?: boolean;
}

export function getWorkflowSteps(projectId: string, workflowStatus: WorkflowStatus = 'uploading', options: WorkflowStepsOptions = {}): WorkflowStep[] {
  const { checklistComplete = true } = options;
  const hasSummaryReview = hasReachedStatus(workflowStatus, 'summary_review');
  const hasAnalysis = hasReachedStatus(workflowStatus, 'analyzing');
  const hasConflicts = hasReachedStatus(workflowStatus, 'conflict_check');
  const hasGeneration = hasReachedStatus(workflowStatus, 'generating');

  return [
    {
      id: 'checklist',
      title: 'Checklist',
      path: `/projects/${projectId}/checklist`,
      icon: <ClipboardList className="w-4 h-4" />,
      isCompleted: checklistComplete,
      isAccessible: true,
    },
    {
      id: 'documents',
      title: 'Documents',
      path: `/projects/${projectId}/documents`,
      icon: <FileText className="w-4 h-4" />,
      isCompleted: hasSummaryReview,
      isAccessible: checklistComplete,
    },
    {
      id: 'summary',
      title: 'Summary Review',
      path: `/projects/${projectId}/summary`,
      icon: <FileText className="w-4 h-4" />,
      isCompleted: hasAnalysis,
      isAccessible: hasSummaryReview || workflowStatus === 'summarizing',
    },
    {
      id: 'analysis',
      title: 'RFP Analysis',
      path: `/projects/${projectId}/analysis`,
      icon: <ShieldCheck className="w-4 h-4" />,
      isCompleted: hasConflicts,
      isAccessible: hasAnalysis,
    },
    {
      id: 'conflicts',
      title: 'Conflicts',
      path: `/projects/${projectId}/conflicts`,
      icon: <AlertTriangle className="w-4 h-4" />,
      isCompleted: hasGeneration,
      isAccessible: hasConflicts,
    },
    {
      id: 'generation',
      title: 'Bid Generation',
      path: `/projects/${projectId}`,
      icon: <Sparkles className="w-4 h-4" />,
      isCompleted: workflowStatus === 'completed',
      isAccessible: hasGeneration,
    },
  ];
}
