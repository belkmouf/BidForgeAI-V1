import { ReactNode } from 'react';
import { Link, useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, FileText, ShieldCheck, AlertTriangle, Sparkles, Check, Lock } from 'lucide-react';
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
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Link href="/">
                <Button variant="ghost" size="icon" className="h-8 w-8" data-testid="button-home">
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
          </div>

          <nav className="flex items-center justify-between">
            <ol className="flex items-center gap-2 overflow-x-auto pb-2">
              {steps.map((step, index) => {
                const isActive = index === currentStep;
                const isPast = index < currentStep;
                const canNavigate = step.isAccessible || isPast;

                return (
                  <li key={step.id} className="flex items-center">
                    {index > 0 && (
                      <div
                        className={cn(
                          "w-8 h-0.5 mx-1",
                          isPast || isActive ? "bg-primary" : "bg-muted"
                        )}
                      />
                    )}
                    <Link
                      href={canNavigate ? step.path : '#'}
                      onClick={(e) => !canNavigate && e.preventDefault()}
                    >
                      <div
                        className={cn(
                          "flex items-center gap-2 px-3 py-2 rounded-lg transition-colors",
                          isActive && "bg-primary text-primary-foreground",
                          !isActive && canNavigate && "hover:bg-muted cursor-pointer",
                          !isActive && !canNavigate && "opacity-50 cursor-not-allowed"
                        )}
                        data-testid={`step-${step.id}`}
                      >
                        <div
                          className={cn(
                            "w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium",
                            isActive && "bg-primary-foreground text-primary",
                            isPast && step.isCompleted && "bg-green-500 text-white",
                            !isActive && !isPast && "bg-muted text-muted-foreground"
                          )}
                        >
                          {step.isCompleted && isPast ? (
                            <Check className="w-4 h-4" />
                          ) : !step.isAccessible && !isPast && !isActive ? (
                            <Lock className="w-3 h-3" />
                          ) : (
                            index + 1
                          )}
                        </div>
                        <span className={cn(
                          "text-sm font-medium whitespace-nowrap hidden sm:inline",
                          isActive && "text-primary-foreground",
                          !isActive && "text-muted-foreground"
                        )}>
                          {step.title}
                        </span>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ol>
          </nav>
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

export function getWorkflowSteps(projectId: string, progress: {
  documentsProcessed: boolean;
  analysisComplete: boolean;
  conflictsReviewed: boolean;
}): WorkflowStep[] {
  return [
    {
      id: 'documents',
      title: 'Documents',
      path: `/projects/${projectId}/documents`,
      icon: <FileText className="w-4 h-4" />,
      isCompleted: progress.documentsProcessed,
      isAccessible: true,
    },
    {
      id: 'analysis',
      title: 'RFP Analysis',
      path: `/projects/${projectId}/analysis`,
      icon: <ShieldCheck className="w-4 h-4" />,
      isCompleted: progress.analysisComplete,
      isAccessible: progress.documentsProcessed,
    },
    {
      id: 'conflicts',
      title: 'Conflicts',
      path: `/projects/${projectId}/conflicts`,
      icon: <AlertTriangle className="w-4 h-4" />,
      isCompleted: progress.conflictsReviewed,
      isAccessible: progress.analysisComplete,
    },
    {
      id: 'generation',
      title: 'Bid Generation',
      path: `/projects/${projectId}`,
      icon: <Sparkles className="w-4 h-4" />,
      isCompleted: false,
      isAccessible: progress.conflictsReviewed,
    },
  ];
}
