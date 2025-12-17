import { useParams, useLocation, Link } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
  getDocumentSummary,
  generateProjectSummary,
  updateProjectSummary,
  exportProjectSummary,
  type DocumentSummaryResponse,
} from '../lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Progress } from '../components/ui/progress';
import { Separator } from '../components/ui/separator';
import {  Loader2, FileText, CheckCircle, AlertCircle, Clock, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, FileCheck, AlertTriangle, TrendingUp, Download, RefreshCw, Edit2, Save, X } from 'lucide-react';
import { Textarea } from '../components/ui/textarea';
import { Alert, AlertDescription } from '../components/ui/alert';

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
  return date.toLocaleDateString();
}

function DocumentCard({ document }: { document: DocumentSummaryResponse['documents'][0] }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className="mb-4">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <FileText className="w-5 h-5 text-blue-500" />
            <div>
              <CardTitle className="text-base">{document.filename}</CardTitle>
              <div className="flex items-center gap-2 mt-1 text-sm text-gray-500">
                <span>{document.fileSize ? formatFileSize(document.fileSize) : 'Unknown size'}</span>
                {document.pageCount && <span>• {document.pageCount} pages</span>}
                <span>• {formatDate(document.uploadedAt)}</span>
              </div>
            </div>
          </div>
          <Badge variant={document.isProcessed ? 'default' : 'secondary'}>
            {document.isProcessed ? (
              <>
                <CheckCircle className="w-3 h-3 mr-1" />
                Processed
              </>
            ) : (
              <>
                <Clock className="w-3 h-3 mr-1" />
                Processing
              </>
            )}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {document.isProcessed && (
          <div className="text-sm text-gray-600">
            <CheckCircle className="w-4 h-4 inline mr-1 text-green-500" />
            {document.chunkCount} chunks extracted
          </div>
        )}

        {document.keyInformation && Object.keys(document.keyInformation).length > 0 && (
          <div className="bg-blue-50 p-3 rounded-lg">
            <h4 className="text-sm font-semibold text-blue-900 mb-2 flex items-center">
              <FileCheck className="w-4 h-4 mr-1" />
              Key Information Detected
            </h4>
            <div className="space-y-1 text-sm">
              {document.keyInformation.projectType && (
                <div>• <span className="font-medium">Project Type:</span> {document.keyInformation.projectType}</div>
              )}
              {document.keyInformation.location && (
                <div>• <span className="font-medium">Location:</span> {document.keyInformation.location}</div>
              )}
              {document.keyInformation.deadline && (
                <div>• <span className="font-medium">Deadline:</span> {document.keyInformation.deadline}</div>
              )}
              {document.keyInformation.budget && (
                <div>• <span className="font-medium">Budget:</span> {document.keyInformation.budget}</div>
              )}
              {document.keyInformation.requirements && document.keyInformation.requirements.length > 0 && (
                <div>• <span className="font-medium">Requirements:</span> {document.keyInformation.requirements.join(', ')}</div>
              )}
            </div>
          </div>
        )}

        {expanded && document.extractedEntities && document.extractedEntities.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold">Extracted Entities</h4>
            <div className="grid gap-2">
              {document.extractedEntities.slice(0, 5).map((entity, idx) => (
                <div key={idx} className="text-sm p-2 bg-gray-50 rounded">
                  <Badge variant="outline" className="text-xs mr-2">{entity.type}</Badge>
                  {entity.value}
                  {entity.confidence && (
                    <span className="text-xs text-gray-500 ml-2">
                      ({Math.round(entity.confidence * 100)}% confident)
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setExpanded(!expanded)}
          className="w-full"
        >
          {expanded ? (
            <>
              <ChevronUp className="w-4 h-4 mr-1" />
              Show Less
            </>
          ) : (
            <>
              <ChevronDown className="w-4 h-4 mr-1" />
              Show More
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

function ProjectSummaryCard({ summary, projectId }: { summary: DocumentSummaryResponse['projectSummary']; projectId: string }) {
  const [editing, setEditing] = useState(false);
  const [editedOverview, setEditedOverview] = useState(summary?.overview || '');
  const queryClient = useQueryClient();

  const updateMutation = useMutation({
    mutationFn: (updates: Partial<DocumentSummaryResponse['projectSummary']>) =>
      updateProjectSummary(projectId, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['document-summary', projectId] });
      setEditing(false);
    },
  });

  const regenerateMutation = useMutation({
    mutationFn: () => generateProjectSummary(projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['document-summary', projectId] });
    },
  });

  if (!summary) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <AlertCircle className="w-5 h-5 mr-2 text-yellow-500" />
            Project Summary Not Generated
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600 mb-4">
            Generate an AI-powered summary of your project documents to get insights and identify any missing information.
          </p>
          <Button onClick={() => regenerateMutation.mutate()} disabled={regenerateMutation.isPending}>
            {regenerateMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>Generate Summary</>
            )}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center">
            <FileCheck className="w-5 h-5 mr-2 text-blue-500" />
            AI-Generated Project Summary
          </CardTitle>
          <div className="flex gap-2">
            {editing ? (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setEditing(false);
                    setEditedOverview(summary.overview || '');
                  }}
                >
                  <X className="w-4 h-4 mr-1" />
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={() => updateMutation.mutate({ overview: editedOverview })}
                  disabled={updateMutation.isPending}
                >
                  {updateMutation.isPending ? (
                    <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4 mr-1" />
                  )}
                  Save
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditing(true)}
                >
                  <Edit2 className="w-4 h-4 mr-1" />
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => regenerateMutation.mutate()}
                  disabled={regenerateMutation.isPending}
                >
                  {regenerateMutation.isPending ? (
                    <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4 mr-1" />
                  )}
                  Regenerate
                </Button>
              </>
            )}
          </div>
        </div>
        {summary.isUserEdited && (
          <Badge variant="secondary" className="w-fit mt-2">User Edited</Badge>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        <div>
          <h3 className="font-semibold mb-2">Project Overview</h3>
          {editing ? (
            <Textarea
              value={editedOverview}
              onChange={(e) => setEditedOverview(e.target.value)}
              rows={4}
              className="w-full"
            />
          ) : (
            <p className="text-gray-700">{summary.overview || 'No overview available'}</p>
          )}
        </div>

        {summary.scopeOfWork && summary.scopeOfWork.length > 0 && (
          <div>
            <h3 className="font-semibold mb-2">Scope of Work</h3>
            <ul className="list-disc list-inside space-y-1">
              {summary.scopeOfWork.map((item, idx) => (
                <li key={idx} className="text-gray-700">{item}</li>
              ))}
            </ul>
          </div>
        )}

        {summary.keyRequirements && (
          <div>
            <h3 className="font-semibold mb-2">Key Requirements</h3>
            <div className="grid grid-cols-2 gap-3">
              {summary.keyRequirements.budget && (
                <div className="bg-gray-50 p-3 rounded">
                  <div className="text-sm font-medium text-gray-600">Budget</div>
                  <div className="text-base">{summary.keyRequirements.budget}</div>
                </div>
              )}
              {summary.keyRequirements.timeline && (
                <div className="bg-gray-50 p-3 rounded">
                  <div className="text-sm font-medium text-gray-600">Timeline</div>
                  <div className="text-base">{summary.keyRequirements.timeline}</div>
                </div>
              )}
            </div>
            {summary.keyRequirements.certifications && summary.keyRequirements.certifications.length > 0 && (
              <div className="mt-2">
                <div className="text-sm font-medium text-gray-600 mb-1">Certifications</div>
                <div className="flex flex-wrap gap-2">
                  {summary.keyRequirements.certifications.map((cert, idx) => (
                    <Badge key={idx} variant="outline">{cert}</Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {summary.riskFactors && summary.riskFactors.length > 0 && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <h4 className="font-semibold mb-1">Risk Factors Identified</h4>
              <ul className="list-disc list-inside space-y-1">
                {summary.riskFactors.map((risk, idx) => (
                  <li key={idx}>{risk}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {summary.opportunities && summary.opportunities.length > 0 && (
          <Alert>
            <TrendingUp className="h-4 w-4" />
            <AlertDescription>
              <h4 className="font-semibold mb-1">Opportunities</h4>
              <ul className="list-disc list-inside space-y-1">
                {summary.opportunities.map((opp, idx) => (
                  <li key={idx}>{opp}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {summary.missingInformation && summary.missingInformation.length > 0 && (
          <Alert variant="default">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <h4 className="font-semibold mb-1">Missing Information</h4>
              <ul className="list-disc list-inside space-y-1">
                {summary.missingInformation.map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}
      </CardContent>

      <CardFooter>
        <Button
          variant="outline"
          onClick={() => exportProjectSummary(projectId)}
          className="w-full"
        >
          <Download className="w-4 h-4 mr-2" />
          Export Summary
        </Button>
      </CardFooter>
    </Card>
  );
}

export default function DocumentSummary() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();

  const { data, isLoading, error } = useQuery({
    queryKey: ['document-summary', id],
    queryFn: () => getDocumentSummary(id!),
    enabled: !!id,
    refetchInterval: (query) => {
      // Poll every 3 seconds if documents are still processing
      const queryData = query.state?.data;
      if (queryData && queryData.stats && !queryData.stats.allProcessed) {
        return 3000;
      }
      return false;
    },
  });

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-blue-500" />
          <p className="text-gray-600">Loading document summary...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Failed to load document summary. Please try again.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!data) return null;

  const readinessPercentage = data.readinessScore.score;

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      {/* Header */}
      <div className="mb-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(`/projects/${id}`)}
          className="mb-2"
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          Back to Project
        </Button>
        <h1 className="text-3xl font-bold">Document Review & Summary</h1>
        <p className="text-gray-600 mt-1">
          Step 2 of 3: Review uploaded documents before generating your bid proposal
        </p>
      </div>

      {/* Quick Stats and Readiness Score */}
      <div className="grid md:grid-cols-2 gap-6 mb-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <FileText className="w-5 h-5 mr-2 text-blue-500" />
              Quick Stats
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Documents</span>
              <span className="font-semibold">{data.stats.documentCount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Total Size</span>
              <span className="font-semibold">{formatFileSize(data.stats.totalSize)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Chunks Extracted</span>
              <span className="font-semibold">{data.stats.totalChunks}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Status</span>
              <Badge variant={data.stats.allProcessed ? 'default' : 'secondary'}>
                {data.stats.allProcessed ? 'All Processed' : 'Processing...'}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <CheckCircle className="w-5 h-5 mr-2 text-green-500" />
              Readiness Score
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex justify-between mb-2">
                <span className="font-semibold">Overall</span>
                <span className="text-2xl font-bold">{readinessPercentage}%</span>
              </div>
              <Progress value={readinessPercentage} className="h-2" />
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                {data.readinessScore.checks.documentsUploaded ? (
                  <CheckCircle className="w-4 h-4 text-green-500" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-500" />
                )}
                <span>Documents Uploaded</span>
              </div>
              <div className="flex items-center gap-2">
                {data.readinessScore.checks.documentsProcessed ? (
                  <CheckCircle className="w-4 h-4 text-green-500" />
                ) : (
                  <Clock className="w-4 h-4 text-yellow-500" />
                )}
                <span>Documents Processed</span>
              </div>
              <div className="flex items-center gap-2">
                {data.readinessScore.checks.analysisComplete ? (
                  <CheckCircle className="w-4 h-4 text-green-500" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-yellow-500" />
                )}
                <span>Analysis Complete</span>
              </div>
              {data.readinessScore.checks.missingInfo.length > 0 && (
                <div className="flex items-start gap-2 text-yellow-600">
                  <AlertTriangle className="w-4 h-4 mt-0.5" />
                  <div>
                    <div className="font-medium">Missing Information</div>
                    <ul className="list-disc list-inside text-xs mt-1">
                      {data.readinessScore.checks.missingInfo.slice(0, 3).map((item, idx) => (
                        <li key={idx}>{item}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Documents List */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold flex items-center">
            <FileText className="w-6 h-6 mr-2" />
            Uploaded Documents
          </h2>
          <Button variant="outline" onClick={() => navigate(`/projects/${id}`)}>
            + Upload More
          </Button>
        </div>

        {data.documents.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <FileText className="w-16 h-16 mx-auto mb-4 text-gray-400" />
              <h3 className="text-lg font-semibold mb-2">No documents uploaded yet</h3>
              <p className="text-gray-600 mb-4">Upload RFQ/RFP documents to get started</p>
              <Button onClick={() => navigate(`/projects/${id}`)}>
                Upload Documents
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div>
            {data.documents.map((doc) => (
              <DocumentCard key={doc.id} document={doc} />
            ))}
          </div>
        )}
      </div>

      {/* Project Summary */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-4">Project Summary</h2>
        <ProjectSummaryCard summary={data.projectSummary} projectId={id!} />
      </div>

      {/* Analysis Dashboard */}
      {data.projectSummary && (
        <div className="mb-6">
          <h2 className="text-2xl font-bold mb-4">Analysis Dashboard</h2>
          <div className="grid md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm text-gray-600">Coverage</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{data.analysis.coverageScore}%</div>
                <Progress value={data.analysis.coverageScore} className="mt-2" />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm text-gray-600">Conflicts</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{data.analysis.conflictCount}</div>
                <p className="text-sm text-gray-500 mt-2">Issues detected</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm text-gray-600">Win Probability</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{data.analysis.winProbability}%</div>
                <Progress value={data.analysis.winProbability} className="mt-2" />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm text-gray-600">Risk Level</CardTitle>
              </CardHeader>
              <CardContent>
                <Badge
                  variant={
                    data.analysis.riskLevel === 'Low' ? 'default' :
                    data.analysis.riskLevel === 'Medium' ? 'secondary' :
                    'destructive'
                  }
                  className="text-base px-3 py-1"
                >
                  {data.analysis.riskLevel}
                </Badge>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex justify-between items-center pt-6 border-t">
        <Button
          variant="outline"
          onClick={() => navigate(`/projects/${id}`)}
        >
          <ChevronLeft className="w-4 h-4 mr-2" />
          Back to Upload
        </Button>
        <div className="flex gap-3">
          <Button variant="outline">
            Save & Exit
          </Button>
          <Button
            onClick={() => navigate(`/projects/${id}`)}
            disabled={!data.stats.allProcessed || readinessPercentage < 50}
          >
            Generate Bid
            <ChevronRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>
    </div>
  );
}
