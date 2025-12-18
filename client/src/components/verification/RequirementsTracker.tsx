import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  CheckCircle, 
  AlertTriangle, 
  Circle, 
  RefreshCcw,
  FileText,
  Target,
  ChevronDown,
  ChevronUp,
  Loader2,
  ClipboardList,
  Filter,
  Sparkles,
  XCircle,
} from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';

interface Requirement {
  id: number;
  projectId: string;
  code: string;
  title: string;
  description: string | null;
  category: string;
  priority: string;
  sourceDocumentId: number | null;
  sourceSection: string | null;
  sourcePage: number | null;
  sourceText: string | null;
  isMandatory: boolean;
  evaluationPoints: number | null;
  coverageStatus: string;
  coveragePercentage: number | null;
  extractedAt: string;
  updatedAt: string;
  coverages?: Array<{
    id: number;
    sectionTitle: string | null;
    coverageLevel: string;
    matchConfidence: number | null;
  }>;
}

interface RequirementStats {
  total: number;
  addressed: number;
  partial: number;
  notAddressed: number;
  mandatory: number;
  mandatoryAddressed: number;
  overallCoverage: number;
}

function calculateStats(requirements: Requirement[]): RequirementStats {
  const total = requirements.length;
  const addressed = requirements.filter(r => r.coverageStatus === 'fully_addressed').length;
  const partial = requirements.filter(r => r.coverageStatus === 'partially_addressed').length;
  const notAddressed = requirements.filter(r => r.coverageStatus === 'not_addressed').length;
  const mandatory = requirements.filter(r => r.isMandatory).length;
  const mandatoryAddressed = requirements.filter(r => r.isMandatory && r.coverageStatus === 'fully_addressed').length;
  
  const totalWeight = requirements.reduce((sum, r) => sum + (r.isMandatory ? 2 : 1), 0);
  const coveredWeight = requirements.reduce((sum, r) => {
    const weight = r.isMandatory ? 2 : 1;
    if (r.coverageStatus === 'fully_addressed') return sum + weight;
    if (r.coverageStatus === 'partially_addressed') return sum + (weight * 0.5);
    return sum;
  }, 0);
  const overallCoverage = totalWeight > 0 ? (coveredWeight / totalWeight) * 100 : 0;
  
  return { total, addressed, partial, notAddressed, mandatory, mandatoryAddressed, overallCoverage };
}

function getCategoryColor(category: string): string {
  const colors: Record<string, string> = {
    technical: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    compliance: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    commercial: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    administrative: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
    documentation: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    legal: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  };
  return colors[category] || colors.administrative;
}

function getPriorityColor(priority: string): string {
  const colors: Record<string, string> = {
    critical: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    high: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    medium: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    low: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
  };
  return colors[priority] || colors.medium;
}

function getCoverageIcon(status: string) {
  switch (status) {
    case 'fully_addressed':
      return <CheckCircle className="w-4 h-4 text-green-500" />;
    case 'partially_addressed':
      return <AlertTriangle className="w-4 h-4 text-amber-500" />;
    default:
      return <Circle className="w-4 h-4 text-gray-400" />;
  }
}

function RequirementRow({ requirement, isExpanded, onToggle }: { 
  requirement: Requirement; 
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <Collapsible open={isExpanded} onOpenChange={onToggle}>
      <div className="border rounded-lg mb-2 overflow-hidden" data-testid={`requirement-row-${requirement.id}`}>
        <CollapsibleTrigger className="w-full">
          <div className="flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors">
            {getCoverageIcon(requirement.coverageStatus)}
            <div className="flex-1 text-left">
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm text-muted-foreground">{requirement.code}</span>
                <span className="font-medium">{requirement.title}</span>
                {requirement.isMandatory && (
                  <Badge variant="destructive" className="text-xs">Mandatory</Badge>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge className={getPriorityColor(requirement.priority)}>{requirement.priority}</Badge>
              <Badge className={getCategoryColor(requirement.category)}>{requirement.category}</Badge>
              {isExpanded ? (
                <ChevronUp className="w-4 h-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              )}
            </div>
          </div>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <div className="px-3 pb-3 pt-1 border-t bg-muted/20">
            {requirement.description && (
              <p className="text-sm text-muted-foreground mb-2">{requirement.description}</p>
            )}
            <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
              {requirement.sourceSection && (
                <span className="flex items-center gap-1">
                  <FileText className="w-3 h-3" />
                  {requirement.sourceSection}
                </span>
              )}
              {requirement.sourcePage && (
                <span>Page {requirement.sourcePage}</span>
              )}
              {requirement.evaluationPoints && (
                <span className="flex items-center gap-1">
                  <Target className="w-3 h-3" />
                  {requirement.evaluationPoints} points
                </span>
              )}
            </div>
            {requirement.sourceText && (
              <div className="mt-2 p-2 bg-muted rounded text-xs italic">
                "{requirement.sourceText}"
              </div>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

interface RequirementsTrackerProps {
  projectId: string;
  compact?: boolean;
  onCoverageChange?: (coverage: number) => void;
}

export function RequirementsTracker({ 
  projectId, 
  compact = false,
  onCoverageChange,
}: RequirementsTrackerProps) {
  const queryClient = useQueryClient();
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  
  const { data: requirements = [], isLoading, refetch, isRefetching } = useQuery<Requirement[]>({
    queryKey: ['projectRequirements', projectId],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/requirements`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load requirements');
      return res.json();
    },
    enabled: !!projectId,
  });
  
  const extractMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/requirements/extract`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to extract requirements');
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['projectRequirements', projectId] });
      toast.success(`Extracted ${data.requirements?.length || 0} requirements from documents`);
    },
    onError: (error: Error) => {
      toast.error(`Extraction failed: ${error.message}`);
    },
  });
  
  const stats = calculateStats(requirements);
  
  if (onCoverageChange && stats.overallCoverage !== undefined) {
    onCoverageChange(stats.overallCoverage);
  }
  
  const filteredRequirements = categoryFilter === 'all' 
    ? requirements 
    : requirements.filter(r => r.category === categoryFilter);
  
  const categories = ['all', ...new Set(requirements.map(r => r.category))];
  
  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }
  
  if (compact) {
    return (
      <Card data-testid="requirements-tracker-compact">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-primary" />
              Requirements Coverage
            </CardTitle>
            <div className="flex items-center gap-2">
              {requirements.length === 0 ? (
                <Button 
                  size="sm" 
                  onClick={() => extractMutation.mutate()}
                  disabled={extractMutation.isPending}
                  data-testid="button-extract-requirements"
                >
                  {extractMutation.isPending ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin mr-1" />
                      Extracting...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3 h-3 mr-1" />
                      Extract
                    </>
                  )}
                </Button>
              ) : (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => refetch()}
                  disabled={isRefetching}
                  data-testid="button-refresh-requirements"
                >
                  <RefreshCcw className={`w-3 h-3 ${isRefetching ? 'animate-spin' : ''}`} />
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {requirements.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground text-sm">
              No requirements extracted yet. Click Extract to scan documents.
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-4 text-sm">
                  <span className="flex items-center gap-1">
                    <CheckCircle className="w-3 h-3 text-green-500" />
                    {stats.addressed} addressed
                  </span>
                  <span className="flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3 text-amber-500" />
                    {stats.partial} partial
                  </span>
                  <span className="flex items-center gap-1">
                    <Circle className="w-3 h-3 text-gray-400" />
                    {stats.notAddressed} pending
                  </span>
                </div>
                <Badge variant={stats.overallCoverage >= 80 ? 'default' : stats.overallCoverage >= 50 ? 'secondary' : 'destructive'}>
                  {stats.overallCoverage.toFixed(0)}% coverage
                </Badge>
              </div>
              <Progress value={stats.overallCoverage} className="h-2" />
              {stats.mandatory > 0 && (
                <p className="text-xs text-muted-foreground mt-2">
                  Mandatory: {stats.mandatoryAddressed}/{stats.mandatory} addressed
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card data-testid="requirements-tracker-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-primary" />
            Requirements Tracker
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => extractMutation.mutate()}
              disabled={extractMutation.isPending}
              data-testid="button-extract-requirements-full"
            >
              {extractMutation.isPending ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin mr-1" />
                  Extracting...
                </>
              ) : (
                <>
                  <Sparkles className="w-3 h-3 mr-1" />
                  Re-extract
                </>
              )}
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => refetch()}
              disabled={isRefetching}
              data-testid="button-refresh-requirements-full"
            >
              <RefreshCcw className={`w-4 h-4 ${isRefetching ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {requirements.length === 0 ? (
          <div className="text-center py-12">
            <ClipboardList className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium mb-2">No Requirements Extracted</h3>
            <p className="text-muted-foreground mb-4">
              Extract requirements from your RFP documents to track compliance
            </p>
            <Button 
              onClick={() => extractMutation.mutate()}
              disabled={extractMutation.isPending}
              data-testid="button-extract-empty"
            >
              {extractMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Extracting Requirements...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Extract Requirements
                </>
              )}
            </Button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-4 gap-4 mb-6">
              <div className="p-3 rounded-lg bg-muted/50 text-center">
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Total Requirements</p>
              </div>
              <div className="p-3 rounded-lg bg-green-50 dark:bg-green-900/20 text-center">
                <p className="text-2xl font-bold text-green-600">{stats.addressed}</p>
                <p className="text-xs text-muted-foreground">Fully Addressed</p>
              </div>
              <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-center">
                <p className="text-2xl font-bold text-amber-600">{stats.partial}</p>
                <p className="text-xs text-muted-foreground">Partially Addressed</p>
              </div>
              <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-center">
                <p className="text-2xl font-bold text-red-600">{stats.notAddressed}</p>
                <p className="text-xs text-muted-foreground">Not Addressed</p>
              </div>
            </div>
            
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Overall Coverage</span>
                <span className="text-sm font-bold">{stats.overallCoverage.toFixed(1)}%</span>
              </div>
              <Progress value={stats.overallCoverage} className="h-3" />
            </div>
            
            {extractMutation.isError && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-2 text-red-700 dark:text-red-400" data-testid="extract-error-message">
                <XCircle className="w-4 h-4" />
                <span className="text-sm">Extraction failed: {extractMutation.error?.message}</span>
              </div>
            )}
            
            <Tabs value={categoryFilter} onValueChange={setCategoryFilter} className="mt-6" data-testid="requirements-filter-tabs">
              <div className="flex items-center gap-2 mb-4">
                <Filter className="w-4 h-4 text-muted-foreground" />
                <TabsList>
                  {categories.map(cat => (
                    <TabsTrigger key={cat} value={cat} className="capitalize" data-testid={`tab-filter-${cat}`}>
                      {cat}
                      {cat !== 'all' && (
                        <span className="ml-1 text-xs opacity-60">
                          ({requirements.filter(r => r.category === cat).length})
                        </span>
                      )}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>
              
              <TabsContent value={categoryFilter}>
                <ScrollArea className="h-[400px]">
                  {filteredRequirements.map(req => (
                    <RequirementRow
                      key={req.id}
                      requirement={req}
                      isExpanded={expandedId === req.id}
                      onToggle={() => setExpandedId(expandedId === req.id ? null : req.id)}
                    />
                  ))}
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </>
        )}
      </CardContent>
    </Card>
  );
}
