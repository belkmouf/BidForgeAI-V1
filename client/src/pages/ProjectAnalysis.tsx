import { useState, useEffect } from 'react';
import { useRoute, Link, useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Clock, 
  FileText,
  ShieldAlert,
  TrendingUp,
  Target,
  Users,
  Play,
  RefreshCw,
  MessageCircle,
  Mail,
  Send,
  Copy,
  Loader2
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { getProject, listDocuments } from '@/lib/api';
import { apiRequest } from '@/lib/auth';
import type { Project, Document } from '@shared/schema';
import { WinProbability } from '@/components/WinProbability';
import { ProjectWorkflowLayout, getWorkflowSteps } from '@/components/workflow/ProjectWorkflowLayout';
import { useProjectProgress } from '@/hooks/useProjectProgress';

interface AnalysisData {
  id: number;
  qualityScore: number;
  clarityScore: number;
  doabilityScore: number;
  vendorRiskScore: number;
  overallRiskLevel: 'Low' | 'Medium' | 'High' | 'Critical';
  missingDocuments: string[];
  unclearRequirements: Array<{ section: string; issue: string }>;
  redFlags: Array<{ type: string; severity: string; description: string; action: string }>;
  opportunities: Array<{ type: string; description: string; benefit: string }>;
  recommendations: Array<{ action: string; priority: string; details: string; estimatedTime: string }>;
  vendorName?: string;
  vendorPaymentRating?: string;
  paymentHistory?: {
    averagePaymentDays: number;
    onTimeRate: number;
    totalProjects: number;
    disputedPayments: number;
  };
  analyzedAt: string;
}

interface AlertData {
  id: number;
  type: string;
  severity: string;
  title: string;
  description: string;
  action: string;
  isResolved: boolean;
}

function getRiskColor(level: string) {
  switch (level) {
    case 'Low': return 'bg-green-100 text-green-800 border-green-200';
    case 'Medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'High': return 'bg-orange-100 text-orange-800 border-orange-200';
    case 'Critical': return 'bg-red-100 text-red-800 border-red-200';
    default: return 'bg-gray-100 text-gray-800 border-gray-200';
  }
}

function getScoreColor(score: number, inverted = false) {
  const val = inverted ? 100 - score : score;
  if (val >= 75) return 'text-green-600 bg-green-50';
  if (val >= 60) return 'text-yellow-600 bg-yellow-50';
  if (val >= 40) return 'text-orange-600 bg-orange-50';
  return 'text-red-600 bg-red-50';
}

function ScoreCard({ title, score, icon, inverted = false }: { 
  title: string; 
  score: number; 
  icon: React.ReactNode;
  inverted?: boolean;
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm border p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className={`p-3 rounded-lg ${getScoreColor(score, inverted)}`}>
          {icon}
        </div>
        <h3 className="font-semibold text-gray-900">{title}</h3>
      </div>
      <div className={`text-4xl font-bold ${getScoreColor(score, inverted)}`}>
        {Math.round(score)}
      </div>
      <div className="text-sm text-gray-500 mt-1">/ 100</div>
    </div>
  );
}

export default function ProjectAnalysis() {
  const [, params] = useRoute('/projects/:id/analysis');
  const [, navigate] = useLocation();
  const projectId = params?.id || '';
  const progress = useProjectProgress(projectId);
  
  const [project, setProject] = useState<Project | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [analysis, setAnalysis] = useState<AnalysisData | null>(null);
  const [alerts, setAlerts] = useState<AlertData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  // Missing docs request state
  const [showWhatsAppDialog, setShowWhatsAppDialog] = useState(false);
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [generatedMessage, setGeneratedMessage] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    async function loadData() {
      if (!projectId) return;
      try {
        const [projectData, docsData] = await Promise.all([
          getProject(projectId),
          listDocuments(projectId)
        ]);
        setProject(projectData);
        setDocuments(docsData);
        
        const analysisRes = await apiRequest(`/api/projects/${projectId}/analysis`);
        if (analysisRes.ok) {
          const data = await analysisRes.json();
          setAnalysis(data.analysis);
          setAlerts(data.alerts);
        }
      } catch (error) {
        console.error('Failed to load data:', error);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, [projectId]);

  const runAnalysis = async () => {
    setIsAnalyzing(true);
    try {
      const res = await apiRequest(`/api/projects/${projectId}/analyze`, {
        method: 'POST',
      });
      
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Analysis failed');
      }
      
      const data = await res.json();
      setAnalysis(data.analysis);
      setAlerts(data.alerts || []);
      
      toast({
        title: "Analysis Complete",
        description: `Risk Level: ${data.analysis.overallRiskLevel}`,
      });
    } catch (error: any) {
      toast({
        title: "Analysis Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const resolveAlert = async (alertId: number) => {
    try {
      await apiRequest(`/api/alerts/${alertId}/resolve`, { method: 'POST' });
      setAlerts(alerts.map(a => a.id === alertId ? { ...a, isResolved: true } : a));
      toast({ title: "Alert Resolved" });
    } catch (error) {
      toast({ title: "Failed to resolve alert", variant: "destructive" });
    }
  };

  const openWhatsAppDialog = async () => {
    if (!analysis?.missingDocuments?.length) return;
    
    setIsGenerating(true);
    setShowWhatsAppDialog(true);
    
    try {
      const res = await apiRequest(`/api/projects/${projectId}/generate-missing-docs-message`, {
        method: 'POST',
        body: JSON.stringify({
          missingDocuments: analysis.missingDocuments,
          format: 'whatsapp'
        })
      });
      
      if (!res.ok) throw new Error('Failed to generate message');
      
      const data = await res.json();
      setGeneratedMessage(data.message);
    } catch (error) {
      toast({ title: "Failed to generate message", variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  const openEmailDialog = async () => {
    if (!analysis?.missingDocuments?.length) return;
    
    setIsGenerating(true);
    setShowEmailDialog(true);
    
    try {
      const res = await apiRequest(`/api/projects/${projectId}/generate-missing-docs-message`, {
        method: 'POST',
        body: JSON.stringify({
          missingDocuments: analysis.missingDocuments,
          format: 'email'
        })
      });
      
      if (!res.ok) throw new Error('Failed to generate message');
      
      const data = await res.json();
      setEmailSubject(data.subject || '');
      setGeneratedMessage(data.message);
    } catch (error) {
      toast({ title: "Failed to generate email", variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  const sendWhatsAppMessage = async () => {
    if (!phoneNumber || !generatedMessage) return;
    
    setIsSending(true);
    try {
      const res = await apiRequest(`/api/projects/${projectId}/send-missing-docs-whatsapp`, {
        method: 'POST',
        body: JSON.stringify({
          to: phoneNumber,
          message: generatedMessage
        })
      });
      
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to send message');
      }
      
      toast({ title: "WhatsApp message sent successfully!" });
      setShowWhatsAppDialog(false);
      setPhoneNumber('');
      setGeneratedMessage('');
    } catch (error: any) {
      toast({ title: error.message || "Failed to send message", variant: "destructive" });
    } finally {
      setIsSending(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: "Copied to clipboard!" });
    } catch (error) {
      toast({ title: "Failed to copy", variant: "destructive" });
    }
  };

  const openEmailClient = () => {
    const subject = encodeURIComponent(emailSubject);
    const body = encodeURIComponent(generatedMessage);
    window.open(`mailto:?subject=${subject}&body=${body}`, '_blank');
    setShowEmailDialog(false);
    setGeneratedMessage('');
    setEmailSubject('');
  };

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
          <Link href="/">
            <Button className="mt-4">Back to Dashboard</Button>
          </Link>
        </div>
      </div>
    );
  }

  const activeAlerts = alerts.filter(a => !a.isResolved);

  const workflowStatus = (project?.workflowStatus || 'analyzing') as 'uploading' | 'summarizing' | 'summary_review' | 'analyzing' | 'analysis_review' | 'conflict_check' | 'generating' | 'review' | 'completed';
  const steps = getWorkflowSteps(projectId, workflowStatus);

  const canProceed = !!analysis && !isAnalyzing;

  return (
    <ProjectWorkflowLayout
      projectId={projectId}
      projectName={project.name}
      clientName={project.clientName}
      currentStep={2}
      steps={steps}
      backLabel="Back to Review Documents"
      onBack={() => navigate(`/projects/${projectId}/summary`)}
      nextLabel="Review Conflicts"
      nextDisabled={!canProceed}
      onNext={() => navigate(`/projects/${projectId}/conflicts`)}
    >
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Analysis</h1>
            <p className="text-muted-foreground mt-1">
              AI-powered analysis of your documents for risks and opportunities
            </p>
          </div>
          <Button 
            onClick={runAnalysis} 
            disabled={isAnalyzing || documents.length === 0}
            className="gap-2"
            data-testid="button-run-analysis"
          >
            {isAnalyzing ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Play className="h-4 w-4" />
                {analysis ? 'Re-run Analysis' : 'Run Analysis'}
              </>
            )}
          </Button>
        </div>

        <div className="space-y-6">
          {documents.length === 0 ? (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
              <FileText className="h-12 w-12 mx-auto text-yellow-600 mb-3" />
              <h3 className="font-semibold text-yellow-800 mb-2">No Documents Uploaded</h3>
              <p className="text-yellow-700 mb-4">Upload RFP documents first to run an analysis.</p>
              <Link href={`/projects/${projectId}/documents`}>
                <Button variant="outline" data-testid="button-upload-docs">Upload Documents</Button>
              </Link>
            </div>
          ) : !analysis ? (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
              <ShieldAlert className="h-12 w-12 mx-auto text-blue-600 mb-3" />
              <h3 className="font-semibold text-blue-800 mb-2">Ready for Analysis</h3>
              <p className="text-blue-700 mb-4">
                {documents.length} document(s) uploaded. Click "Run Analysis" to evaluate the RFP.
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <span className={`px-4 py-2 rounded-full text-sm font-semibold border ${getRiskColor(analysis.overallRiskLevel)}`}>
                    {analysis.overallRiskLevel} Risk
                  </span>
                  <span className="text-sm text-gray-500">
                    Last analyzed: {new Date(analysis.analyzedAt).toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="grid md:grid-cols-4 gap-4" data-testid="score-cards">
                <ScoreCard 
                  title="Document Quality" 
                  score={analysis.qualityScore || 0}
                  icon={<FileText className="h-5 w-5" />}
                />
                <ScoreCard 
                  title="Requirement Clarity" 
                  score={analysis.clarityScore || 0}
                  icon={<Target className="h-5 w-5" />}
                />
                <ScoreCard 
                  title="Doability" 
                  score={analysis.doabilityScore || 0}
                  icon={<TrendingUp className="h-5 w-5" />}
                />
                <ScoreCard 
                  title="Vendor Risk" 
                  score={analysis.vendorRiskScore || 0}
                  icon={<Users className="h-5 w-5" />}
                  inverted
                />
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <WinProbability projectId={projectId} />
              </div>

              {activeAlerts.length > 0 && (
                <div className="bg-red-50 border-2 border-red-200 rounded-lg p-6" data-testid="alerts-section">
                  <h2 className="text-xl font-bold text-red-900 mb-4 flex items-center gap-2">
                    <AlertTriangle size={24} />
                    Active Alerts ({activeAlerts.length})
                  </h2>
                  
                  <div className="space-y-3">
                    {activeAlerts.map((alert) => (
                      <div key={alert.id} className="bg-white rounded-lg p-4 border border-red-200" data-testid={`alert-${alert.id}`}>
                        <div className="flex justify-between items-start mb-2">
                          <h3 className="font-semibold text-red-900">{alert.title}</h3>
                          <div className="flex items-center gap-2">
                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${getRiskColor(alert.severity)}`}>
                              {alert.severity}
                            </span>
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => resolveAlert(alert.id)}
                              data-testid={`button-resolve-alert-${alert.id}`}
                            >
                              Resolve
                            </Button>
                          </div>
                        </div>
                        <p className="text-gray-700 mb-2">{alert.description}</p>
                        <p className="text-sm text-red-700">
                          <strong>Action:</strong> {alert.action}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {analysis.vendorName && analysis.paymentHistory && (
                <div className="bg-white rounded-lg shadow-sm border p-6" data-testid="vendor-info">
                  <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Vendor Payment History
                  </h2>
                  
                  <div className="grid md:grid-cols-3 gap-6">
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Vendor Name</p>
                      <p className="text-lg font-semibold">{analysis.vendorName}</p>
                    </div>
                    
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Payment Rating</p>
                      <p className={`text-lg font-semibold ${
                        ['A+', 'A', 'B+'].includes(analysis.vendorPaymentRating || '')
                          ? 'text-green-600'
                          : ['C', 'D', 'F'].includes(analysis.vendorPaymentRating || '')
                          ? 'text-red-600'
                          : 'text-gray-600'
                      }`}>
                        {analysis.vendorPaymentRating || 'Unknown'}
                      </p>
                    </div>
                    
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Avg Payment Time</p>
                      <p className="text-lg font-semibold">
                        {analysis.paymentHistory.averagePaymentDays} days
                      </p>
                    </div>
                  </div>
                  
                  <div className="mt-4 pt-4 border-t grid md:grid-cols-3 gap-4">
                    <div>
                      <p className="text-sm text-gray-600">Total Projects</p>
                      <p className="text-lg font-medium">{analysis.paymentHistory.totalProjects}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">On-Time Rate</p>
                      <p className="text-lg font-medium text-green-600">
                        {analysis.paymentHistory.onTimeRate}%
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Disputed Payments</p>
                      <p className="text-lg font-medium text-red-600">
                        {analysis.paymentHistory.disputedPayments}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid md:grid-cols-2 gap-6">
                {analysis.missingDocuments && analysis.missingDocuments.length > 0 && (
                  <div className="bg-white rounded-lg shadow-sm border p-6" data-testid="missing-documents">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                        <XCircle className="h-5 w-5 text-red-500" />
                        Missing Documents ({analysis.missingDocuments.length})
                      </h2>
                      <div className="flex gap-2">
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={openWhatsAppDialog}
                          className="gap-1.5"
                          data-testid="button-request-whatsapp"
                        >
                          <MessageCircle className="h-4 w-4" />
                          WhatsApp
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={openEmailDialog}
                          className="gap-1.5"
                          data-testid="button-request-email"
                        >
                          <Mail className="h-4 w-4" />
                          Email
                        </Button>
                      </div>
                    </div>
                    <ul className="space-y-2">
                      {analysis.missingDocuments.map((doc: string, index: number) => (
                        <li key={index} className="flex items-center gap-2 text-gray-700">
                          <XCircle size={16} className="text-red-500 flex-shrink-0" />
                          {doc}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {analysis.unclearRequirements && analysis.unclearRequirements.length > 0 && (
                  <div className="bg-white rounded-lg shadow-sm border p-6" data-testid="unclear-requirements">
                    <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-yellow-500" />
                      Unclear Requirements ({analysis.unclearRequirements.length})
                    </h2>
                    <div className="space-y-3">
                      {analysis.unclearRequirements.slice(0, 5).map((item: any, index: number) => (
                        <div key={index} className="border-l-4 border-yellow-500 pl-3">
                          <p className="font-medium text-gray-900">{item.section}</p>
                          <p className="text-sm text-gray-600">{item.issue}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {analysis.redFlags && analysis.redFlags.length > 0 && (
                <div className="bg-white rounded-lg shadow-sm border p-6" data-testid="red-flags">
                  <h2 className="text-xl font-bold text-red-900 mb-4 flex items-center gap-2">
                    <AlertTriangle size={24} />
                    Red Flags ({analysis.redFlags.length})
                  </h2>
                  <div className="space-y-4">
                    {analysis.redFlags.map((flag: any, index: number) => (
                      <div key={index} className="border-l-4 border-red-500 pl-4 py-2">
                        <div className="flex justify-between items-start mb-2">
                          <h3 className="font-semibold text-gray-900">{flag.type}</h3>
                          <span className={`px-3 py-1 rounded-full text-xs ${getRiskColor(flag.severity)}`}>
                            {flag.severity}
                          </span>
                        </div>
                        <p className="text-gray-700 mb-2">{flag.description}</p>
                        <p className="text-sm text-red-700">
                          <strong>Recommended Action:</strong> {flag.action}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {analysis.opportunities && analysis.opportunities.length > 0 && (
                <div className="bg-white rounded-lg shadow-sm border p-6" data-testid="opportunities">
                  <h2 className="text-xl font-bold text-green-900 mb-4 flex items-center gap-2">
                    <CheckCircle size={24} />
                    Opportunities ({analysis.opportunities.length})
                  </h2>
                  <div className="space-y-3">
                    {analysis.opportunities.map((opp: any, index: number) => (
                      <div key={index} className="border-l-4 border-green-500 pl-4 py-2">
                        <h3 className="font-semibold text-gray-900 mb-1">{opp.type}</h3>
                        <p className="text-gray-700 mb-1">{opp.description}</p>
                        <p className="text-sm text-green-700">
                          <strong>Benefit:</strong> {opp.benefit}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {analysis.recommendations && analysis.recommendations.length > 0 && (
                <div className="bg-white rounded-lg shadow-sm border p-6" data-testid="recommendations">
                  <h2 className="text-xl font-bold text-gray-900 mb-4">
                    Recommendations
                  </h2>
                  <div className="space-y-4">
                    {analysis.recommendations.map((rec: any, index: number) => (
                      <div key={index} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-start mb-2">
                          <h3 className="font-semibold text-lg text-gray-900">{rec.action}</h3>
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                            rec.priority === 'CRITICAL' ? 'bg-red-100 text-red-800' :
                            rec.priority === 'HIGH' ? 'bg-orange-100 text-orange-800' :
                            rec.priority === 'MEDIUM' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-blue-100 text-blue-800'
                          }`}>
                            {rec.priority}
                          </span>
                        </div>
                        <p className="text-gray-700 mb-2">{rec.details}</p>
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Clock size={16} />
                          <span>{rec.estimatedTime}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* WhatsApp Dialog */}
      <Dialog open={showWhatsAppDialog} onOpenChange={setShowWhatsAppDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-green-600" />
              Request Missing Documents via WhatsApp
            </DialogTitle>
            <DialogDescription>
              Send an AI-generated message to the vendor requesting the missing documents.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number (with country code)</Label>
              <Input
                id="phone"
                placeholder="+971 50 123 4567"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                data-testid="input-phone-number"
              />
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Generated Message</Label>
                <Button 
                  size="sm" 
                  variant="ghost" 
                  onClick={() => copyToClipboard(generatedMessage)}
                  disabled={!generatedMessage}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              {isGenerating ? (
                <div className="flex items-center justify-center p-8 border rounded-lg">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-muted-foreground">Generating message...</span>
                </div>
              ) : (
                <Textarea
                  value={generatedMessage}
                  onChange={(e) => setGeneratedMessage(e.target.value)}
                  rows={8}
                  className="resize-none"
                  data-testid="textarea-whatsapp-message"
                />
              )}
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowWhatsAppDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={sendWhatsAppMessage} 
              disabled={isSending || !phoneNumber || !generatedMessage}
              className="gap-2 bg-green-600 hover:bg-green-700"
              data-testid="button-send-whatsapp"
            >
              {isSending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Send WhatsApp
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Email Dialog */}
      <Dialog open={showEmailDialog} onOpenChange={setShowEmailDialog}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-blue-600" />
              Request Missing Documents via Email
            </DialogTitle>
            <DialogDescription>
              Review and edit the AI-generated email, then open it in your email client.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="subject">Subject</Label>
              <Input
                id="subject"
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
                data-testid="input-email-subject"
              />
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Email Body</Label>
                <Button 
                  size="sm" 
                  variant="ghost" 
                  onClick={() => copyToClipboard(generatedMessage)}
                  disabled={!generatedMessage}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              {isGenerating ? (
                <div className="flex items-center justify-center p-8 border rounded-lg">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-muted-foreground">Generating email...</span>
                </div>
              ) : (
                <Textarea
                  value={generatedMessage}
                  onChange={(e) => setGeneratedMessage(e.target.value)}
                  rows={12}
                  className="resize-none font-mono text-sm"
                  data-testid="textarea-email-body"
                />
              )}
            </div>
          </div>
          
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setShowEmailDialog(false)}>
              Cancel
            </Button>
            <Button 
              variant="outline"
              onClick={() => copyToClipboard(`Subject: ${emailSubject}\n\n${generatedMessage}`)}
              disabled={!generatedMessage}
              className="gap-2"
            >
              <Copy className="h-4 w-4" />
              Copy All
            </Button>
            <Button 
              onClick={openEmailClient} 
              disabled={!generatedMessage}
              className="gap-2"
              data-testid="button-open-email"
            >
              <Mail className="h-4 w-4" />
              Open in Email Client
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ProjectWorkflowLayout>
  );
}
