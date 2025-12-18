import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Shield, 
  RefreshCcw,
  Loader2,
  ChevronDown,
  ChevronUp,
  FileCheck,
  ClipboardCheck,
  FileText,
  Lock,
} from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { toast } from 'sonner';

interface ComplianceCheck {
  checkName: string;
  passed: boolean;
  score?: number;
  message: string;
  details?: string;
  isMandatory?: boolean;
}

interface ComplianceGate {
  id: number;
  projectId: string;
  gateNumber: number;
  gateName: string;
  status: string;
  overallScore: number | null;
  checkResults: ComplianceCheck[];
  issuesCount: number;
  warningsCount: number;
  acknowledgedBy: number | null;
  acknowledgedAt: string | null;
  acknowledgedWithRisks: boolean;
}

interface IntegrityReport {
  validationState: string;
}

interface Requirement {
  id: number;
  coverageStatus: string;
  isMandatory: boolean;
}

interface ComplianceGatePanelProps {
  projectId: string;
  onGateStatusChange?: (isPassed: boolean) => void;
  compact?: boolean;
}

function CheckResultRow({ check, isExpanded, onToggle }: { 
  check: ComplianceCheck; 
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <Collapsible open={isExpanded} onOpenChange={onToggle}>
      <div className="border rounded-lg mb-2 overflow-hidden" data-testid={`check-result-${check.checkName.toLowerCase().replace(/\s+/g, '-')}`}>
        <CollapsibleTrigger className="w-full">
          <div className="flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors">
            {check.passed ? (
              <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
            ) : check.isMandatory ? (
              <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
            )}
            <div className="flex-1 text-left">
              <span className="font-medium">{check.checkName}</span>
              {check.isMandatory && (
                <Badge variant="destructive" className="ml-2 text-xs">Required</Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              {check.score !== undefined && (
                <Badge variant="outline">{check.score}%</Badge>
              )}
              {check.details ? (
                isExpanded ? (
                  <ChevronUp className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                )
              ) : null}
            </div>
          </div>
        </CollapsibleTrigger>
        
        {check.details && (
          <CollapsibleContent>
            <div className="px-3 pb-3 pt-1 border-t bg-muted/20">
              <p className="text-sm text-muted-foreground">{check.message}</p>
              <p className="text-xs text-muted-foreground mt-1 opacity-75">{check.details}</p>
            </div>
          </CollapsibleContent>
        )}
      </div>
    </Collapsible>
  );
}

export function ComplianceGatePanel({ 
  projectId, 
  onGateStatusChange,
  compact = false 
}: ComplianceGatePanelProps) {
  const queryClient = useQueryClient();
  const [expandedCheck, setExpandedCheck] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(!compact);
  
  const { data: gateData, isLoading, refetch, isRefetching } = useQuery<ComplianceGate | null>({
    queryKey: ['complianceGate', projectId],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/verification-gates`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load gate status');
      const gates = await res.json();
      return gates.find((g: ComplianceGate) => g.gateNumber === 2) || null;
    },
    enabled: !!projectId,
  });
  
  const runComplianceCheck = useMutation({
    mutationFn: async () => {
      const [integrityRes, requirementsRes, bidRes] = await Promise.all([
        fetch(`/api/projects/${projectId}/integrity-reports`, { credentials: 'include' }),
        fetch(`/api/projects/${projectId}/requirements`, { credentials: 'include' }),
        fetch(`/api/projects/${projectId}/bids`, { credentials: 'include' }),
      ]);
      
      const integrityReports: IntegrityReport[] = integrityRes.ok ? await integrityRes.json() : [];
      const requirements: Requirement[] = requirementsRes.ok ? await requirementsRes.json() : [];
      const bids = bidRes.ok ? await bidRes.json() : [];
      
      const checks: ComplianceCheck[] = [];
      
      const hasDocuments = integrityReports.length > 0;
      const passedDocs = integrityReports.filter(r => r.validationState === 'passed' || r.validationState === 'warning').length;
      const totalDocs = integrityReports.length;
      const docsPassed = hasDocuments && integrityReports.every(r => r.validationState !== 'failed');
      checks.push({
        checkName: 'Document Verification',
        passed: docsPassed,
        score: hasDocuments ? Math.round((passedDocs / totalDocs) * 100) : 0,
        message: !hasDocuments 
          ? 'No documents uploaded yet'
          : docsPassed 
            ? `All ${totalDocs} documents passed verification`
            : `${passedDocs}/${totalDocs} documents verified`,
        details: !hasDocuments 
          ? 'Upload at least one RFP document before submission'
          : !docsPassed 
            ? 'Some documents failed verification and may contain issues' 
            : undefined,
        isMandatory: true,
      });
      
      const mandatoryReqs = requirements.filter(r => r.isMandatory);
      const addressedMandatory = mandatoryReqs.filter(r => r.coverageStatus === 'fully_addressed').length;
      const mandatoryPassed = mandatoryReqs.length === 0 || addressedMandatory === mandatoryReqs.length;
      checks.push({
        checkName: 'Mandatory Requirements',
        passed: mandatoryPassed,
        score: mandatoryReqs.length > 0 ? Math.round((addressedMandatory / mandatoryReqs.length) * 100) : 100,
        message: mandatoryPassed
          ? mandatoryReqs.length > 0 
            ? `All ${mandatoryReqs.length} mandatory requirements addressed`
            : 'No mandatory requirements defined'
          : `${addressedMandatory}/${mandatoryReqs.length} mandatory requirements addressed`,
        details: !mandatoryPassed ? 'Unaddressed mandatory requirements may cause disqualification' : undefined,
        isMandatory: true,
      });
      
      const allReqs = requirements.length;
      const addressedReqs = requirements.filter(r => r.coverageStatus === 'fully_addressed').length;
      const partialReqs = requirements.filter(r => r.coverageStatus === 'partially_addressed').length;
      const coverageScore = allReqs > 0 ? Math.round(((addressedReqs + partialReqs * 0.5) / allReqs) * 100) : 0;
      checks.push({
        checkName: 'Overall Requirements Coverage',
        passed: allReqs > 0 && coverageScore >= 70,
        score: coverageScore,
        message: allReqs === 0 
          ? 'No requirements extracted - run extraction first'
          : `${coverageScore}% requirements coverage`,
        details: allReqs === 0 
          ? 'Extract requirements from documents to track compliance'
          : coverageScore < 70 
            ? 'Consider addressing more requirements to improve win chances' 
            : undefined,
        isMandatory: false,
      });
      
      const hasBid = bids.length > 0 && bids.some((b: any) => b.content && b.content.length > 100);
      checks.push({
        checkName: 'Bid Content Generated',
        passed: hasBid,
        score: hasBid ? 100 : 0,
        message: hasBid ? 'Bid response has been generated' : 'No bid content generated yet',
        details: !hasBid ? 'Generate bid content before submission' : undefined,
        isMandatory: true,
      });
      
      const issuesCount = checks.filter(c => !c.passed && c.isMandatory).length;
      const warningsCount = checks.filter(c => !c.passed && !c.isMandatory).length;
      const overallScore = Math.round(checks.reduce((sum, c) => sum + (c.score || (c.passed ? 100 : 0)), 0) / checks.length);
      const allMandatoryPassed = checks.filter(c => c.isMandatory).every(c => c.passed);
      
      const gateRes = await fetch(`/api/projects/${projectId}/verification-gates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          gateNumber: 2,
          gateName: 'Pre-Submission Compliance',
          status: allMandatoryPassed ? 'passed' : 'blocked',
          overallScore,
          checkResults: checks,
          issuesCount,
          warningsCount,
        }),
      });
      
      if (!gateRes.ok) {
        throw new Error('Failed to save compliance gate');
      }
      
      return await gateRes.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['complianceGate', projectId] });
      toast.success('Compliance check completed');
    },
    onError: (error: Error) => {
      toast.error(`Check failed: ${error.message}`);
    },
  });
  
  const acknowledgeMutation = useMutation({
    mutationFn: async (withRisks: boolean) => {
      const res = await fetch(`/api/projects/${projectId}/verification-gates/2/acknowledge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ acknowledgeWithRisks: withRisks }),
      });
      if (!res.ok) throw new Error('Failed to acknowledge gate');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['complianceGate', projectId] });
      toast.success('Gate acknowledged - you can proceed with export');
    },
  });
  
  const isPassed = gateData?.status === 'passed';
  const isBlocked = gateData?.status === 'blocked';
  const checkResults = gateData?.checkResults || [];
  
  if (onGateStatusChange) {
    onGateStatusChange(isPassed);
  }
  
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
      <Card data-testid="compliance-gate-compact">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <ClipboardCheck className="w-4 h-4 text-primary" />
              Gate #2: Pre-Submission
            </CardTitle>
            <div className="flex items-center gap-2">
              {isPassed ? (
                <Badge className="bg-green-100 text-green-700">Passed</Badge>
              ) : isBlocked ? (
                <Badge variant="destructive">Blocked</Badge>
              ) : (
                <Badge variant="outline">Not Run</Badge>
              )}
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => runComplianceCheck.mutate()}
                disabled={runComplianceCheck.isPending}
                data-testid="button-run-compliance-check"
              >
                {runComplianceCheck.isPending ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <RefreshCcw className={`w-3 h-3 ${isRefetching ? 'animate-spin' : ''}`} />
                )}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {gateData ? (
            <>
              <div className="flex items-center justify-between mb-2 text-sm">
                <span className="text-muted-foreground">Compliance Score</span>
                <span className="font-bold">{gateData.overallScore || 0}%</span>
              </div>
              <Progress value={gateData.overallScore || 0} className="h-2 mb-2" />
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                {gateData.issuesCount > 0 && (
                  <span className="flex items-center gap-1 text-red-500">
                    <XCircle className="w-3 h-3" />
                    {gateData.issuesCount} issues
                  </span>
                )}
                {gateData.warningsCount > 0 && (
                  <span className="flex items-center gap-1 text-amber-500">
                    <AlertTriangle className="w-3 h-3" />
                    {gateData.warningsCount} warnings
                  </span>
                )}
                {gateData.issuesCount === 0 && gateData.warningsCount === 0 && (
                  <span className="flex items-center gap-1 text-green-500">
                    <CheckCircle className="w-3 h-3" />
                    All checks passed
                  </span>
                )}
              </div>
            </>
          ) : (
            <div className="text-center py-2 text-muted-foreground text-sm">
              Run compliance check to verify submission readiness
            </div>
          )}
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card data-testid="compliance-gate-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            Gate #2: Pre-Submission Compliance
          </CardTitle>
          <div className="flex items-center gap-2">
            {isPassed ? (
              <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                <CheckCircle className="w-3 h-3 mr-1" />
                Passed
              </Badge>
            ) : isBlocked ? (
              <Badge variant="destructive">
                <Lock className="w-3 h-3 mr-1" />
                Blocked
              </Badge>
            ) : (
              <Badge variant="outline">Not Verified</Badge>
            )}
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => runComplianceCheck.mutate()}
              disabled={runComplianceCheck.isPending}
              data-testid="button-run-compliance-full"
            >
              {runComplianceCheck.isPending ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin mr-1" />
                  Checking...
                </>
              ) : (
                <>
                  <RefreshCcw className="w-3 h-3 mr-1" />
                  Run Check
                </>
              )}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {!gateData ? (
          <div className="text-center py-12">
            <Shield className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium mb-2">Compliance Check Required</h3>
            <p className="text-muted-foreground mb-4">
              Run a compliance check to verify your submission meets all requirements
            </p>
            <Button 
              onClick={() => runComplianceCheck.mutate()}
              disabled={runComplianceCheck.isPending}
              data-testid="button-run-compliance-empty"
            >
              {runComplianceCheck.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Running Check...
                </>
              ) : (
                <>
                  <ClipboardCheck className="w-4 h-4 mr-2" />
                  Run Compliance Check
                </>
              )}
            </Button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-4 gap-4 mb-6">
              <div className="p-3 rounded-lg bg-muted/50 text-center">
                <p className="text-2xl font-bold">{gateData.overallScore || 0}%</p>
                <p className="text-xs text-muted-foreground">Overall Score</p>
              </div>
              <div className="p-3 rounded-lg bg-green-50 dark:bg-green-900/20 text-center">
                <p className="text-2xl font-bold text-green-600">
                  {checkResults.filter(c => c.passed).length}
                </p>
                <p className="text-xs text-muted-foreground">Passed</p>
              </div>
              <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-center">
                <p className="text-2xl font-bold text-red-600">{gateData.issuesCount}</p>
                <p className="text-xs text-muted-foreground">Blocking Issues</p>
              </div>
              <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-center">
                <p className="text-2xl font-bold text-amber-600">{gateData.warningsCount}</p>
                <p className="text-xs text-muted-foreground">Warnings</p>
              </div>
            </div>
            
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Compliance Progress</span>
                <span className="text-sm font-bold">{gateData.overallScore || 0}%</span>
              </div>
              <Progress value={gateData.overallScore || 0} className="h-3" />
            </div>
            
            <Collapsible open={showDetails} onOpenChange={setShowDetails}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-between mb-4" data-testid="toggle-check-details">
                  <span className="flex items-center gap-2">
                    <FileCheck className="w-4 h-4" />
                    Check Details ({checkResults.length} checks)
                  </span>
                  {showDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="space-y-2">
                  {checkResults.map(check => (
                    <CheckResultRow
                      key={check.checkName}
                      check={check}
                      isExpanded={expandedCheck === check.checkName}
                      onToggle={() => setExpandedCheck(expandedCheck === check.checkName ? null : check.checkName)}
                    />
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
            
            {isBlocked && !gateData.acknowledgedBy && (
              <div className="mt-4 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-amber-700 dark:text-amber-400">
                      Submission Not Recommended
                    </h4>
                    <p className="text-sm text-amber-600 dark:text-amber-500 mt-1">
                      Your submission has {gateData.issuesCount} blocking issues that may cause disqualification.
                      You can proceed with risks acknowledged.
                    </p>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="mt-3 border-amber-300 text-amber-700 hover:bg-amber-100"
                      onClick={() => acknowledgeMutation.mutate(true)}
                      disabled={acknowledgeMutation.isPending}
                      data-testid="button-acknowledge-risks"
                    >
                      {acknowledgeMutation.isPending ? (
                        <Loader2 className="w-3 h-3 animate-spin mr-1" />
                      ) : (
                        <Lock className="w-3 h-3 mr-1" />
                      )}
                      Proceed with Risks
                    </Button>
                  </div>
                </div>
              </div>
            )}
            
            {gateData.acknowledgedBy && (
              <div className="mt-4 p-3 bg-muted rounded-lg text-sm text-muted-foreground">
                <FileText className="w-4 h-4 inline mr-2" />
                Gate acknowledged{gateData.acknowledgedWithRisks ? ' with risks' : ''} on{' '}
                {new Date(gateData.acknowledgedAt || '').toLocaleString()}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
