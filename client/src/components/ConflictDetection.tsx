import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertTriangle, CheckCircle, XCircle, Search, FileWarning, Clock, ArrowRight, RefreshCw, EyeOff } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { useAuthStore } from '@/lib/auth';

interface Conflict {
  id: number;
  projectId: string;
  conflictType: string;
  severity: string;
  status: string;
  sourceDocumentId: number | null;
  sourceChunkId: number | null;
  sourceText: string;
  sourceLocation: { page?: number; paragraph?: number; sentence?: number } | null;
  targetDocumentId: number | null;
  targetChunkId: number | null;
  targetText: string;
  targetLocation: { page?: number; paragraph?: number; sentence?: number } | null;
  description: string;
  suggestedResolution: string | null;
  confidenceScore: number | null;
  semanticSimilarity: number | null;
  resolvedBy: number | null;
  resolvedAt: string | null;
  resolution: string | null;
  metadata: Record<string, unknown> | null;
  detectedAt: string;
  updatedAt: string;
}

interface ConflictStats {
  total: number;
  byType: Record<string, number>;
  bySeverity: Record<string, number>;
  byStatus: Record<string, number>;
  resolved: number;
  pending: number;
}

interface ConflictDetectionProps {
  projectId: string;
}

const severityColors: Record<string, string> = {
  low: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  high: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  critical: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
};

const statusColors: Record<string, string> = {
  detected: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  pending: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  reviewing: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  resolved: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  dismissed: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
  ignored: 'bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-200',
  disputed: 'bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200',
};

const typeIcons: Record<string, React.ReactNode> = {
  semantic: <FileWarning className="h-4 w-4" />,
  numeric: <AlertTriangle className="h-4 w-4" />,
  temporal: <Clock className="h-4 w-4" />,
  scope: <Search className="h-4 w-4" />,
};

export function ConflictDetection({ projectId }: ConflictDetectionProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { accessToken } = useAuthStore();
  const [selectedConflict, setSelectedConflict] = useState<Conflict | null>(null);
  const [resolveDialogOpen, setResolveDialogOpen] = useState(false);
  const [resolution, setResolution] = useState('');
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const authHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${accessToken}`,
  };

  const { data: stats, isLoading: statsLoading } = useQuery<ConflictStats>({
    queryKey: ['conflicts', projectId, 'stats'],
    queryFn: async () => {
      const response = await fetch(`/api/conflicts/${projectId}/stats`, {
        headers: authHeaders,
      });
      if (!response.ok) throw new Error('Failed to fetch conflict stats');
      return response.json();
    },
    enabled: !!accessToken,
  });

  const { data: conflictsData, isLoading: conflictsLoading, refetch } = useQuery<{ conflicts: Conflict[]; count: number }>({
    queryKey: ['conflicts', projectId, activeFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (activeFilter !== 'all') {
        if (['semantic', 'numeric', 'temporal', 'scope'].includes(activeFilter)) {
          params.set('type', activeFilter);
        } else if (['low', 'medium', 'high', 'critical'].includes(activeFilter)) {
          params.set('severity', activeFilter);
        } else if (['detected', 'reviewing', 'resolved', 'dismissed'].includes(activeFilter)) {
          params.set('status', activeFilter);
        }
      }
      const url = `/api/conflicts/${projectId}${params.toString() ? `?${params.toString()}` : ''}`;
      const response = await fetch(url, { headers: authHeaders });
      if (!response.ok) throw new Error('Failed to fetch conflicts');
      return response.json();
    },
    enabled: !!accessToken,
  });

  const runDetectionMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/conflicts/${projectId}/detect`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          detectSemantic: true,
          detectNumeric: true,
          semanticThreshold: 0.85,
        }),
      });
      if (!response.ok) throw new Error('Failed to run conflict detection');
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: 'Detection Complete',
        description: `Found ${data.totalConflicts} conflicts (${data.semanticConflicts} semantic, ${data.numericConflicts} numeric, ${data.temporalConflicts} temporal)`,
      });
      queryClient.invalidateQueries({ queryKey: ['conflicts', projectId] });
    },
    onError: () => {
      toast({
        title: 'Detection Failed',
        description: 'Failed to run conflict detection. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const resolveConflictMutation = useMutation({
    mutationFn: async ({ conflictId, resolution }: { conflictId: number; resolution: string }) => {
      const response = await fetch(`/api/conflicts/${projectId}/${conflictId}/resolve`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ resolution }),
      });
      if (!response.ok) throw new Error('Failed to resolve conflict');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Conflict Resolved',
        description: 'The conflict has been marked as resolved.',
      });
      setResolveDialogOpen(false);
      setSelectedConflict(null);
      setResolution('');
      queryClient.invalidateQueries({ queryKey: ['conflicts', projectId] });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to resolve the conflict. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const dismissConflictMutation = useMutation({
    mutationFn: async ({ conflictId, reason }: { conflictId: number; reason?: string }) => {
      const response = await fetch(`/api/conflicts/${projectId}/${conflictId}/dismiss`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ reason }),
      });
      if (!response.ok) throw new Error('Failed to dismiss conflict');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Conflict Dismissed',
        description: 'The conflict has been dismissed.',
      });
      queryClient.invalidateQueries({ queryKey: ['conflicts', projectId] });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to dismiss the conflict. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const ignoreConflictsMutation = useMutation({
    mutationFn: async (conflictIds: number[]) => {
      const response = await fetch(`/api/conflicts/${projectId}/bulk-update`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ conflictIds, status: 'ignored' }),
      });
      if (!response.ok) throw new Error('Failed to ignore conflicts');
      return response.json();
    },
    onSuccess: (_, conflictIds) => {
      toast({
        title: 'Conflicts Ignored',
        description: `${conflictIds.length} conflict(s) have been ignored.`,
      });
      setSelectedIds(new Set());
      queryClient.invalidateQueries({ queryKey: ['conflicts', projectId] });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to ignore conflicts. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const conflicts = conflictsData?.conflicts || [];
  
  const toggleSelectConflict = (id: number) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === conflicts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(conflicts.map(c => c.id)));
    }
  };

  const handleIgnoreSelected = () => {
    if (selectedIds.size > 0) {
      ignoreConflictsMutation.mutate(Array.from(selectedIds));
    }
  };

  const handleIgnoreAll = () => {
    const allIds = conflicts.filter(c => c.status !== 'ignored' && c.status !== 'resolved').map(c => c.id);
    if (allIds.length > 0) {
      ignoreConflictsMutation.mutate(allIds);
    }
  };

  return (
    <div className="space-y-6" data-testid="conflict-detection-panel">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">Conflict Detection</h2>
          <p className="text-muted-foreground">Identify and resolve inconsistencies in your bid documents</p>
        </div>
        <div className="flex items-center gap-2">
          {selectedIds.size > 0 && (
            <Button
              variant="secondary"
              onClick={handleIgnoreSelected}
              disabled={ignoreConflictsMutation.isPending}
              data-testid="button-ignore-selected"
            >
              {ignoreConflictsMutation.isPending ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Ignoring...
                </>
              ) : (
                <>
                  <EyeOff className="h-4 w-4 mr-2" />
                  Ignore Selected ({selectedIds.size})
                </>
              )}
            </Button>
          )}
          {conflicts.length > 0 && (
            <Button
              variant="secondary"
              onClick={handleIgnoreAll}
              disabled={ignoreConflictsMutation.isPending}
              data-testid="button-ignore-all"
            >
              {ignoreConflictsMutation.isPending ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Ignoring...
                </>
              ) : (
                <>
                  <EyeOff className="h-4 w-4 mr-2" />
                  Ignore All
                </>
              )}
            </Button>
          )}
          <Button
            onClick={() => runDetectionMutation.mutate()}
            disabled={runDetectionMutation.isPending}
            data-testid="button-run-detection"
          >
            {runDetectionMutation.isPending ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Scanning...
              </>
            ) : (
              <>
                <Search className="h-4 w-4 mr-2" />
                Run Detection
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card data-testid="card-total-conflicts">
          <CardHeader className="pb-2">
            <CardDescription>Total Conflicts</CardDescription>
            <CardTitle className="text-3xl">{stats?.total || 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card data-testid="card-pending-conflicts">
          <CardHeader className="pb-2">
            <CardDescription>Pending Review</CardDescription>
            <CardTitle className="text-3xl text-yellow-600">{stats?.pending || 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card data-testid="card-resolved-conflicts">
          <CardHeader className="pb-2">
            <CardDescription>Resolved</CardDescription>
            <CardTitle className="text-3xl text-green-600">{stats?.resolved || 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card data-testid="card-critical-conflicts">
          <CardHeader className="pb-2">
            <CardDescription>Critical</CardDescription>
            <CardTitle className="text-3xl text-red-600">{stats?.bySeverity?.critical || 0}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Tabs value={activeFilter} onValueChange={setActiveFilter} data-testid="tabs-conflict-filters">
        <TabsList>
          <TabsTrigger value="all" data-testid="tab-all">All</TabsTrigger>
          <TabsTrigger value="semantic" data-testid="tab-semantic">Semantic</TabsTrigger>
          <TabsTrigger value="numeric" data-testid="tab-numeric">Numeric</TabsTrigger>
          <TabsTrigger value="temporal" data-testid="tab-temporal">Temporal</TabsTrigger>
          <TabsTrigger value="critical" data-testid="tab-critical">Critical</TabsTrigger>
          <TabsTrigger value="detected" data-testid="tab-pending">Pending</TabsTrigger>
        </TabsList>

        <TabsContent value={activeFilter} className="mt-4">
          {conflictsLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : conflicts.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <CheckCircle className="h-12 w-12 text-green-500 mb-4" />
                <h3 className="text-lg font-medium">No Conflicts Found</h3>
                <p className="text-muted-foreground text-center max-w-md mt-2">
                  {activeFilter === 'all' 
                    ? 'Run conflict detection to scan your documents for inconsistencies.'
                    : 'No conflicts match the current filter.'}
                </p>
              </CardContent>
            </Card>
          ) : (
            <ScrollArea className="h-[500px]">
              <div className="space-y-3">
                {conflicts.map((conflict) => (
                  <Card 
                    key={conflict.id} 
                    className={`hover:border-primary/50 transition-colors ${selectedIds.has(conflict.id) ? 'border-primary bg-primary/5' : ''}`}
                    data-testid={`card-conflict-${conflict.id}`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3 flex-1">
                          <Checkbox
                            checked={selectedIds.has(conflict.id)}
                            onCheckedChange={() => toggleSelectConflict(conflict.id)}
                            onClick={(e) => e.stopPropagation()}
                            className="mt-1"
                            data-testid={`checkbox-conflict-${conflict.id}`}
                          />
                          <div 
                            className="mt-1 cursor-pointer"
                            onClick={() => setSelectedConflict(conflict)}
                          >
                            {typeIcons[conflict.conflictType] || <AlertTriangle className="h-4 w-4" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <Badge variant="outline" className="capitalize">
                                {conflict.conflictType}
                              </Badge>
                              <Badge className={severityColors[conflict.severity]}>
                                {conflict.severity}
                              </Badge>
                              <Badge className={statusColors[conflict.status] || 'bg-gray-100 text-gray-800'}>
                                {conflict.status.charAt(0).toUpperCase() + conflict.status.slice(1)}
                              </Badge>
                            </div>
                            <p className="text-sm font-medium line-clamp-2">{conflict.description}</p>
                            {conflict.confidenceScore && (
                              <p className="text-xs text-muted-foreground mt-1">
                                Confidence: {Math.round(conflict.confidenceScore * 100)}%
                              </p>
                            )}
                          </div>
                        </div>
                        <ArrowRight className="h-5 w-5 text-muted-foreground shrink-0" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={!!selectedConflict && !resolveDialogOpen} onOpenChange={(open) => !open && setSelectedConflict(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          {selectedConflict && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {typeIcons[selectedConflict.conflictType]}
                  <span className="capitalize">{selectedConflict.conflictType} Conflict</span>
                  <Badge className={severityColors[selectedConflict.severity]}>
                    {selectedConflict.severity}
                  </Badge>
                </DialogTitle>
                <DialogDescription>{selectedConflict.description}</DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">Source Text</CardTitle>
                      {selectedConflict.sourceLocation && (
                        <CardDescription className="text-xs">
                          Page {selectedConflict.sourceLocation.page || '-'}
                        </CardDescription>
                      )}
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                        {selectedConflict.sourceText}
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">Conflicting Text</CardTitle>
                      {selectedConflict.targetLocation && (
                        <CardDescription className="text-xs">
                          Page {selectedConflict.targetLocation.page || '-'}
                        </CardDescription>
                      )}
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                        {selectedConflict.targetText}
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {selectedConflict.suggestedResolution && (
                  <Card className="bg-primary/5 border-primary/20">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-primary" />
                        Suggested Resolution
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm">{selectedConflict.suggestedResolution}</p>
                    </CardContent>
                  </Card>
                )}

                {selectedConflict.resolution && (
                  <Card className="bg-green-50 border-green-200 dark:bg-green-900/20">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-green-700 dark:text-green-300">
                        Resolution Applied
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-green-600 dark:text-green-400">
                        {selectedConflict.resolution}
                      </p>
                    </CardContent>
                  </Card>
                )}
              </div>

              <DialogFooter className="gap-2">
                {selectedConflict.status !== 'resolved' && selectedConflict.status !== 'dismissed' && (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => dismissConflictMutation.mutate({ conflictId: selectedConflict.id })}
                      disabled={dismissConflictMutation.isPending}
                      data-testid="button-dismiss-conflict"
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Dismiss
                    </Button>
                    <Button
                      onClick={() => setResolveDialogOpen(true)}
                      data-testid="button-resolve-conflict"
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Resolve
                    </Button>
                  </>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={resolveDialogOpen} onOpenChange={setResolveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resolve Conflict</DialogTitle>
            <DialogDescription>
              Provide a resolution for this conflict. This will be recorded for future reference.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Textarea
              placeholder="Describe how you resolved this conflict..."
              value={resolution}
              onChange={(e) => setResolution(e.target.value)}
              rows={4}
              data-testid="input-resolution"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResolveDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (selectedConflict) {
                  resolveConflictMutation.mutate({
                    conflictId: selectedConflict.id,
                    resolution,
                  });
                }
              }}
              disabled={!resolution.trim() || resolveConflictMutation.isPending}
              data-testid="button-submit-resolution"
            >
              {resolveConflictMutation.isPending ? 'Resolving...' : 'Confirm Resolution'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
