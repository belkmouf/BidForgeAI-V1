import { useQuery } from '@tanstack/react-query';
import { 
  Card, CardContent, CardHeader, CardTitle, CardDescription 
} from '../ui/card';
import { Badge } from '../ui/badge';
import { Progress } from '../ui/progress';
import { Alert, AlertDescription } from '../ui/alert';
import { Button } from '../ui/button';
import { cn } from '../../lib/utils';
import { 
  FileCheck, AlertTriangle, XCircle, CheckCircle, 
  Loader2, Shield, RefreshCw, FileWarning, Lock
} from 'lucide-react';

interface IntegrityIssue {
  type: 'error' | 'warning' | 'info';
  code: string;
  message: string;
  suggestion?: string;
}

interface IntegrityReport {
  id: number;
  documentId: number;
  projectId: string;
  overallScore: number;
  validationState: 'pending' | 'processing' | 'passed' | 'failed' | 'warning';
  integrityScore: number | null;
  completenessScore: number | null;
  metadataScore: number | null;
  complianceScore: number | null;
  isPasswordProtected: boolean;
  isDuplicate: boolean;
  duplicateOfDocumentId: number | null;
  issues: IntegrityIssue[];
}

interface DocumentWithIntegrity {
  id: number;
  filename: string;
  contentType: string;
  fileSize: number;
  integrityReport?: IntegrityReport | null;
}

interface GateStatus {
  isPassed: boolean;
  totalDocuments: number;
  passedDocuments: number;
  failedDocuments: number;
  warningDocuments: number;
  pendingDocuments: number;
  overallScore: number;
  blockers: string[];
}

function getValidationBadge(state: string, isPasswordProtected: boolean, isDuplicate: boolean) {
  if (isPasswordProtected) {
    return (
      <Badge variant="destructive" className="gap-1">
        <Lock className="w-3 h-3" />
        Password Protected
      </Badge>
    );
  }
  
  if (isDuplicate) {
    return (
      <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 gap-1">
        <FileWarning className="w-3 h-3" />
        Duplicate
      </Badge>
    );
  }
  
  switch (state) {
    case 'passed':
      return (
        <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 gap-1">
          <CheckCircle className="w-3 h-3" />
          Verified
        </Badge>
      );
    case 'warning':
      return (
        <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 gap-1">
          <AlertTriangle className="w-3 h-3" />
          Warning
        </Badge>
      );
    case 'failed':
      return (
        <Badge variant="destructive" className="gap-1">
          <XCircle className="w-3 h-3" />
          Failed
        </Badge>
      );
    case 'processing':
      return (
        <Badge variant="outline" className="gap-1">
          <Loader2 className="w-3 h-3 animate-spin" />
          Processing
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className="gap-1 text-muted-foreground">
          <Shield className="w-3 h-3" />
          Pending
        </Badge>
      );
  }
}

function calculateGateStatus(documents: DocumentWithIntegrity[]): GateStatus {
  const totalDocuments = documents.length;
  let passedDocuments = 0;
  let failedDocuments = 0;
  let warningDocuments = 0;
  let pendingDocuments = 0;
  let totalScore = 0;
  const blockers: string[] = [];

  documents.forEach(doc => {
    const report = doc.integrityReport;
    if (!report || report.validationState === 'pending' || report.validationState === 'processing') {
      pendingDocuments++;
    } else if (report.validationState === 'passed') {
      passedDocuments++;
      totalScore += report.overallScore || 0;
    } else if (report.validationState === 'warning') {
      warningDocuments++;
      totalScore += report.overallScore || 0;
    } else if (report.validationState === 'failed') {
      failedDocuments++;
      blockers.push(`${doc.filename}: Verification failed`);
    } else {
      pendingDocuments++;
    }

    if (report?.isPasswordProtected) {
      blockers.push(`${doc.filename}: Password protected - cannot verify`);
    }
  });

  const verifiedCount = passedDocuments + warningDocuments;
  const overallScore = verifiedCount > 0 ? (totalScore / verifiedCount) : 0;
  const isPassed = failedDocuments === 0 && pendingDocuments === 0 && totalDocuments > 0;

  return {
    isPassed,
    totalDocuments,
    passedDocuments,
    failedDocuments,
    warningDocuments,
    pendingDocuments,
    overallScore: Math.round(overallScore),
    blockers,
  };
}

interface DocumentIntegrityPanelProps {
  projectId: string;
  onGateStatusChange?: (isPassed: boolean) => void;
  compact?: boolean;
}

export function DocumentIntegrityPanel({ 
  projectId, 
  onGateStatusChange,
  compact = false 
}: DocumentIntegrityPanelProps) {
  const { data: documents, isLoading, refetch, isRefetching } = useQuery<DocumentWithIntegrity[]>({
    queryKey: ['projectDocumentsWithIntegrity', projectId],
    queryFn: async () => {
      const [docsRes, reportsRes] = await Promise.all([
        fetch(`/api/projects/${projectId}/documents-summary`, { credentials: 'include' }),
        fetch(`/api/projects/${projectId}/integrity-reports`, { credentials: 'include' }),
      ]);
      
      if (!docsRes.ok) throw new Error('Failed to load documents');
      const docsData = await docsRes.json();
      const reports = reportsRes.ok ? await reportsRes.json() : [];
      
      const reportsByDocId = new Map<number, IntegrityReport>();
      reports.forEach((report: IntegrityReport) => {
        reportsByDocId.set(report.documentId, report);
      });
      
      const docsWithIntegrity: DocumentWithIntegrity[] = docsData.documents.map((doc: any) => ({
        ...doc,
        integrityReport: reportsByDocId.get(doc.id) || null,
      }));
      
      return docsWithIntegrity;
    },
    enabled: !!projectId,
    refetchInterval: 30000,
  });

  const gateStatus = documents ? calculateGateStatus(documents) : null;

  if (onGateStatusChange && gateStatus) {
    onGateStatusChange(gateStatus.isPassed);
  }

  if (isLoading) {
    return (
      <Card data-testid="integrity-panel-loading">
        <CardContent className="py-6">
          <div className="flex items-center justify-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-muted-foreground">Checking document integrity...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!documents || documents.length === 0) {
    return (
      <Card data-testid="integrity-panel-empty">
        <CardContent className="py-6">
          <div className="text-center text-muted-foreground">
            <FileCheck className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No documents uploaded yet</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const completionPercentage = gateStatus 
    ? Math.round(((gateStatus.passedDocuments + gateStatus.warningDocuments) / gateStatus.totalDocuments) * 100) 
    : 0;

  if (compact) {
    return (
      <Card data-testid="integrity-panel-compact">
        <CardContent className="py-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Shield className={cn(
                "w-5 h-5",
                gateStatus?.isPassed ? "text-green-600" : "text-amber-500"
              )} />
              <span className="font-medium">Gate #1: Document Integrity</span>
            </div>
            {gateStatus?.isPassed ? (
              <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                Passed
              </Badge>
            ) : (
              <Badge variant="outline" className="text-amber-600 border-amber-300">
                {gateStatus?.pendingDocuments || 0} Pending
              </Badge>
            )}
          </div>
          <Progress value={completionPercentage} className="h-2" />
          <div className="flex justify-between mt-2 text-xs text-muted-foreground">
            <span>{gateStatus?.passedDocuments || 0} of {gateStatus?.totalDocuments || 0} verified</span>
            <span>{completionPercentage}%</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="integrity-panel">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Shield className={cn(
                "w-5 h-5",
                gateStatus?.isPassed ? "text-green-600" : gateStatus?.failedDocuments ? "text-red-500" : "text-amber-500"
              )} />
              Gate #1: Document Integrity
            </CardTitle>
            <CardDescription>
              Verify all uploaded documents before proceeding to analysis
            </CardDescription>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => refetch()}
            disabled={isRefetching}
            data-testid="button-refresh-integrity"
          >
            <RefreshCw className={cn("w-4 h-4 mr-1", isRefetching && "animate-spin")} />
            Refresh
          </Button>
        </div>
        
        <div className="mt-4 pt-4 border-t">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Verification Progress</span>
            <span className="text-lg font-bold">{completionPercentage}%</span>
          </div>
          <Progress value={completionPercentage} className="h-3" />
          <div className="flex gap-4 mt-3 text-sm">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span>Passed: {gateStatus?.passedDocuments || 0}</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-amber-500" />
              <span>Warnings: {gateStatus?.warningDocuments || 0}</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <span>Failed: {gateStatus?.failedDocuments || 0}</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-gray-300" />
              <span>Pending: {gateStatus?.pendingDocuments || 0}</span>
            </div>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        {gateStatus?.blockers && gateStatus.blockers.length > 0 && (
          <Alert variant="destructive" className="mb-4">
            <AlertTriangle className="w-4 h-4" />
            <AlertDescription>
              <strong>Blockers preventing Gate #1 passage:</strong>
              <ul className="mt-2 space-y-1 list-disc list-inside">
                {gateStatus.blockers.map((blocker, i) => (
                  <li key={i} className="text-sm">{blocker}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}
        
        <div className="space-y-2">
          {documents.map(doc => (
            <div 
              key={doc.id}
              className={cn(
                "flex items-center justify-between p-3 rounded-lg border",
                doc.integrityReport?.validationState === 'passed' && "bg-green-50/50 border-green-200 dark:bg-green-950/20",
                doc.integrityReport?.validationState === 'warning' && "bg-amber-50/50 border-amber-200 dark:bg-amber-950/20",
                doc.integrityReport?.validationState === 'failed' && "bg-red-50/50 border-red-200 dark:bg-red-950/20",
                (!doc.integrityReport || doc.integrityReport.validationState === 'pending') && "bg-gray-50/50 border-gray-200 dark:bg-gray-950/20"
              )}
              data-testid={`integrity-doc-${doc.id}`}
            >
              <div className="flex items-center gap-3">
                <FileCheck className="w-5 h-5 text-muted-foreground" />
                <div>
                  <p className="font-medium text-sm">{doc.filename}</p>
                  <p className="text-xs text-muted-foreground">
                    {doc.integrityReport?.overallScore !== undefined 
                      ? `Score: ${Math.round(doc.integrityReport.overallScore)}%` 
                      : 'Not yet verified'}
                  </p>
                </div>
              </div>
              {getValidationBadge(
                doc.integrityReport?.validationState || 'pending',
                doc.integrityReport?.isPasswordProtected || false,
                doc.integrityReport?.isDuplicate || false
              )}
            </div>
          ))}
        </div>
        
        {gateStatus?.isPassed && (
          <Alert className="mt-4 bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800">
            <CheckCircle className="w-4 h-4 text-green-600" />
            <AlertDescription className="text-green-700 dark:text-green-400">
              All documents have passed integrity verification. You can proceed to the next step.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}

export { calculateGateStatus, type GateStatus, type DocumentWithIntegrity };
