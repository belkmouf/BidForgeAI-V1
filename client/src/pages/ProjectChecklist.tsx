import { useParams, useLocation } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Progress } from '../components/ui/progress';
import { ScrollArea } from '../components/ui/scroll-area';
import { 
  Loader2, FileText, CheckCircle, AlertTriangle, XCircle, 
  Sparkles, Upload, ArrowRight, FileCheck, ClipboardList,
  Building2, Calendar, DollarSign, MapPin, FileWarning, ShieldCheck
} from 'lucide-react';
import { Alert, AlertDescription } from '../components/ui/alert';
import { ProjectWorkflowLayout, getWorkflowSteps, type WorkflowStatus } from '../components/workflow/ProjectWorkflowLayout';
import { Separator } from '../components/ui/separator';
import { Label } from '../components/ui/label';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { useToast } from '../hooks/use-toast';
import { cn } from '../lib/utils';

interface IntakeProfile {
  id: number;
  projectId: string;
  rfpType: string;
  contractValueRange: string;
  clientRegion: string;
  clientType: string;
  submissionDeadline: string | null;
  projectDuration: string | null;
  specialRequirements: string | null;
  isComplete: boolean;
}

interface ChecklistItem {
  id: number;
  projectId: string;
  name: string;
  description: string | null;
  category: string;
  status: 'required' | 'uploaded' | 'verified' | 'missing' | 'optional';
  isRequired: boolean;
  documentId: number | null;
  matchConfidence: number | null;
  sortOrder: number;
}

interface ChecklistProgress {
  items: ChecklistItem[];
  totalRequired: number;
  uploadedCount: number;
  verifiedCount: number;
  completionPercentage: number;
}

interface IntakeProfileFormData {
  rfpType: string;
  contractValueRange: string;
  clientRegion: string;
  clientType: string;
  submissionDeadline: string;
  projectDuration: string;
  specialRequirements: string;
}

const RFP_TYPES = [
  { value: 'it_services', label: 'IT Services' },
  { value: 'technology', label: 'Technology Solutions' },
  { value: 'construction', label: 'Construction' },
  { value: 'infrastructure', label: 'Infrastructure' },
  { value: 'consulting', label: 'Consulting Services' },
  { value: 'maintenance', label: 'Maintenance & Operations' },
  { value: 'supply', label: 'Supply & Procurement' },
  { value: 'professional_services', label: 'Professional Services' },
  { value: 'other', label: 'Other' },
];

const CONTRACT_VALUES = [
  { value: 'small', label: 'Small (< $100K)' },
  { value: 'medium', label: 'Medium ($100K - $1M)' },
  { value: 'large', label: 'Large ($1M - $10M)' },
  { value: 'enterprise', label: 'Enterprise (> $10M)' },
];

const CLIENT_REGIONS = [
  { value: 'uae', label: 'UAE' },
  { value: 'dubai', label: 'Dubai' },
  { value: 'abu_dhabi', label: 'Abu Dhabi' },
  { value: 'ksa', label: 'Saudi Arabia (KSA)' },
  { value: 'qatar', label: 'Qatar' },
  { value: 'bahrain', label: 'Bahrain' },
  { value: 'oman', label: 'Oman' },
  { value: 'kuwait', label: 'Kuwait' },
  { value: 'gcc_other', label: 'Other GCC' },
  { value: 'international', label: 'International' },
];

const CLIENT_TYPES = [
  { value: 'government', label: 'Government Entity' },
  { value: 'semi_government', label: 'Semi-Government' },
  { value: 'private', label: 'Private Sector' },
  { value: 'ngo', label: 'NGO / Non-Profit' },
  { value: 'international_org', label: 'International Organization' },
];

const CATEGORY_LABELS: Record<string, { label: string; icon: any; color: string }> = {
  core_documents: { label: 'Core RFP Documents', icon: FileText, color: 'text-blue-600' },
  company_credentials: { label: 'Company Credentials', icon: Building2, color: 'text-purple-600' },
  financials: { label: 'Financial Documents', icon: DollarSign, color: 'text-green-600' },
  experience: { label: 'Experience & References', icon: FileCheck, color: 'text-orange-600' },
  proposals: { label: 'Proposal Documents', icon: ClipboardList, color: 'text-indigo-600' },
  legal: { label: 'Legal & Compliance', icon: ShieldCheck, color: 'text-red-600' },
  certifications: { label: 'Certifications', icon: CheckCircle, color: 'text-teal-600' },
};

function getStatusBadge(status: ChecklistItem['status'], isRequired: boolean) {
  if (!isRequired && status === 'required') {
    return <Badge variant="outline" className="text-xs">Optional</Badge>;
  }
  switch (status) {
    case 'verified':
      return <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">Verified</Badge>;
    case 'uploaded':
      return <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">Uploaded</Badge>;
    case 'missing':
      return <Badge variant="destructive">Missing</Badge>;
    case 'required':
    default:
      return <Badge variant="outline" className="text-orange-600 border-orange-300">Required</Badge>;
  }
}

function IntakeProfileForm({ 
  profile, 
  onSave, 
  isLoading 
}: { 
  profile: IntakeProfile | null; 
  onSave: (data: IntakeProfileFormData) => void;
  isLoading: boolean;
}) {
  const [formData, setFormData] = useState<IntakeProfileFormData>({
    rfpType: profile?.rfpType || '',
    contractValueRange: profile?.contractValueRange || '',
    clientRegion: profile?.clientRegion || '',
    clientType: profile?.clientType || '',
    submissionDeadline: profile?.submissionDeadline?.split('T')[0] || '',
    projectDuration: profile?.projectDuration || '',
    specialRequirements: profile?.specialRequirements || '',
  });

  useEffect(() => {
    if (profile) {
      setFormData({
        rfpType: profile.rfpType || '',
        contractValueRange: profile.contractValueRange || '',
        clientRegion: profile.clientRegion || '',
        clientType: profile.clientType || '',
        submissionDeadline: profile.submissionDeadline?.split('T')[0] || '',
        projectDuration: profile.projectDuration || '',
        specialRequirements: profile.specialRequirements || '',
      });
    }
  }, [profile]);

  const isValid = formData.rfpType && formData.contractValueRange && formData.clientRegion && formData.clientType;

  return (
    <Card data-testid="intake-profile-form">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ClipboardList className="w-5 h-5" />
          Project Intake Profile
        </CardTitle>
        <CardDescription>
          Tell us about this RFP so we can generate a tailored document checklist
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="rfpType">RFP Type *</Label>
            <Select 
              value={formData.rfpType} 
              onValueChange={(value) => setFormData(prev => ({ ...prev, rfpType: value }))}
            >
              <SelectTrigger id="rfpType" data-testid="select-rfp-type">
                <SelectValue placeholder="Select RFP type" />
              </SelectTrigger>
              <SelectContent>
                {RFP_TYPES.map(type => (
                  <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="contractValue">Contract Value Range *</Label>
            <Select 
              value={formData.contractValueRange} 
              onValueChange={(value) => setFormData(prev => ({ ...prev, contractValueRange: value }))}
            >
              <SelectTrigger id="contractValue" data-testid="select-contract-value">
                <SelectValue placeholder="Select value range" />
              </SelectTrigger>
              <SelectContent>
                {CONTRACT_VALUES.map(val => (
                  <SelectItem key={val.value} value={val.value}>{val.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="clientRegion">Client Region *</Label>
            <Select 
              value={formData.clientRegion} 
              onValueChange={(value) => setFormData(prev => ({ ...prev, clientRegion: value }))}
            >
              <SelectTrigger id="clientRegion" data-testid="select-client-region">
                <SelectValue placeholder="Select region" />
              </SelectTrigger>
              <SelectContent>
                {CLIENT_REGIONS.map(region => (
                  <SelectItem key={region.value} value={region.value}>{region.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="clientType">Client Type *</Label>
            <Select 
              value={formData.clientType} 
              onValueChange={(value) => setFormData(prev => ({ ...prev, clientType: value }))}
            >
              <SelectTrigger id="clientType" data-testid="select-client-type">
                <SelectValue placeholder="Select client type" />
              </SelectTrigger>
              <SelectContent>
                {CLIENT_TYPES.map(type => (
                  <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="deadline">Submission Deadline</Label>
            <Input 
              id="deadline"
              type="date" 
              value={formData.submissionDeadline}
              onChange={(e) => setFormData(prev => ({ ...prev, submissionDeadline: e.target.value }))}
              data-testid="input-deadline"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="duration">Project Duration</Label>
            <Input 
              id="duration"
              placeholder="e.g., 12 months, 2 years"
              value={formData.projectDuration}
              onChange={(e) => setFormData(prev => ({ ...prev, projectDuration: e.target.value }))}
              data-testid="input-duration"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="special">Special Requirements</Label>
          <Textarea 
            id="special"
            placeholder="Any specific requirements or notes about this RFP..."
            value={formData.specialRequirements}
            onChange={(e) => setFormData(prev => ({ ...prev, specialRequirements: e.target.value }))}
            className="min-h-[80px]"
            data-testid="textarea-special"
          />
        </div>
      </CardContent>
      <CardFooter>
        <Button 
          onClick={() => onSave(formData)} 
          disabled={!isValid || isLoading}
          className="w-full"
          data-testid="button-save-profile"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 mr-2" />
              Save Profile & Generate Checklist
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}

function ChecklistGrid({ checklist, onLinkDocument }: { 
  checklist: ChecklistProgress;
  onLinkDocument: (itemId: number) => void;
}) {
  const groupedItems = checklist.items.reduce((acc, item) => {
    if (!acc[item.category]) {
      acc[item.category] = [];
    }
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, ChecklistItem[]>);

  const sortedCategories = Object.entries(groupedItems).sort((a, b) => {
    const orderA = CATEGORY_LABELS[a[0]]?.label || a[0];
    const orderB = CATEGORY_LABELS[b[0]]?.label || b[0];
    return orderA.localeCompare(orderB);
  });

  return (
    <Card data-testid="checklist-grid">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileCheck className="w-5 h-5" />
              Document Checklist
            </CardTitle>
            <CardDescription>
              {checklist.verifiedCount} of {checklist.totalRequired} required documents verified
            </CardDescription>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-primary">{checklist.completionPercentage}%</div>
            <div className="text-xs text-muted-foreground">Complete</div>
          </div>
        </div>
        <Progress value={checklist.completionPercentage} className="mt-3" />
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px] pr-4">
          {sortedCategories.map(([category, items]) => {
            const categoryInfo = CATEGORY_LABELS[category] || { 
              label: category.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()), 
              icon: FileText, 
              color: 'text-gray-600' 
            };
            const CategoryIcon = categoryInfo.icon;

            return (
              <div key={category} className="mb-6 last:mb-0">
                <div className="flex items-center gap-2 mb-3">
                  <CategoryIcon className={cn("w-4 h-4", categoryInfo.color)} />
                  <h4 className="font-medium text-sm">{categoryInfo.label}</h4>
                  <Badge variant="outline" className="ml-auto text-xs">
                    {items.filter(i => i.status === 'verified' || i.status === 'uploaded').length}/{items.length}
                  </Badge>
                </div>
                <div className="space-y-2">
                  {items.map(item => (
                    <div 
                      key={item.id}
                      className={cn(
                        "flex items-center justify-between p-3 rounded-lg border transition-colors",
                        item.status === 'verified' && "bg-green-50/50 border-green-200 dark:bg-green-950/20",
                        item.status === 'uploaded' && "bg-blue-50/50 border-blue-200 dark:bg-blue-950/20",
                        item.status === 'required' && item.isRequired && "bg-orange-50/30 border-orange-200 dark:bg-orange-950/10",
                        item.status === 'missing' && "bg-red-50/50 border-red-200 dark:bg-red-950/20"
                      )}
                      data-testid={`checklist-item-${item.id}`}
                    >
                      <div className="flex items-center gap-3">
                        {item.status === 'verified' ? (
                          <CheckCircle className="w-5 h-5 text-green-600" />
                        ) : item.status === 'uploaded' ? (
                          <FileText className="w-5 h-5 text-blue-600" />
                        ) : item.status === 'missing' ? (
                          <XCircle className="w-5 h-5 text-red-500" />
                        ) : (
                          <div className="w-5 h-5 rounded-full border-2 border-muted-foreground/30" />
                        )}
                        <div>
                          <p className="font-medium text-sm">{item.name}</p>
                          {item.description && (
                            <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {getStatusBadge(item.status, item.isRequired)}
                        {item.status !== 'verified' && item.status !== 'uploaded' && (
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => onLinkDocument(item.id)}
                            data-testid={`button-link-${item.id}`}
                          >
                            <Upload className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

export default function ProjectChecklist() {
  const { id: projectId } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: project, isLoading: projectLoading } = useQuery({
    queryKey: ['project', projectId],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load project');
      return res.json();
    },
    enabled: !!projectId,
  });

  const { data: profile, isLoading: profileLoading } = useQuery<IntakeProfile | null>({
    queryKey: ['intakeProfile', projectId],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/intake-profile`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load profile');
      return res.json();
    },
    enabled: !!projectId,
  });

  const { data: checklist, isLoading: checklistLoading } = useQuery<ChecklistProgress>({
    queryKey: ['checklist', projectId],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/checklist`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load checklist');
      return res.json();
    },
    enabled: !!projectId,
  });

  const saveProfileMutation = useMutation({
    mutationFn: async (data: IntakeProfileFormData) => {
      const res = await fetch(`/api/projects/${projectId}/intake-profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to save profile');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['intakeProfile', projectId] });
      generateChecklistMutation.mutate();
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const generateChecklistMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/checklist/generate`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to generate checklist');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['checklist', projectId] });
      toast({
        title: 'Checklist Generated',
        description: 'Your document checklist has been created based on the project profile.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleSaveProfile = (data: IntakeProfileFormData) => {
    saveProfileMutation.mutate(data);
  };

  const handleLinkDocument = (itemId: number) => {
    navigate(`/projects/${projectId}/documents`);
  };

  const handleContinue = () => {
    navigate(`/projects/${projectId}/documents`);
  };

  if (projectLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Alert variant="destructive">
          <AlertDescription>Project not found</AlertDescription>
        </Alert>
      </div>
    );
  }

  const workflowStatus = (project.workflowStatus || 'uploading') as WorkflowStatus;
  const hasChecklist = checklist && checklist.items.length > 0;
  const isChecklistComplete = hasChecklist && checklist.completionPercentage >= 80;
  const steps = getWorkflowSteps(projectId!, workflowStatus, { checklistComplete: isChecklistComplete });

  return (
    <ProjectWorkflowLayout
      projectId={projectId!}
      projectName={project.name}
      currentStep={0}
      steps={steps}
    >
      <div className="max-w-5xl mx-auto px-6 py-6" data-testid="checklist-page">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Document Checklist</h1>
          <p className="text-muted-foreground mt-1">
            Complete the intake profile to generate a tailored document checklist for this RFP
          </p>
        </div>

        {!hasChecklist ? (
          <div className="grid lg:grid-cols-2 gap-6">
            <IntakeProfileForm 
              profile={profile || null}
              onSave={handleSaveProfile}
              isLoading={saveProfileMutation.isPending || generateChecklistMutation.isPending}
            />
            
            <Card className="lg:row-span-1">
              <CardHeader>
                <CardTitle className="text-base">How It Works</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">1</div>
                  <div>
                    <p className="font-medium">Complete the Profile</p>
                    <p className="text-sm text-muted-foreground">Tell us about the RFP type, client, and region</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">2</div>
                  <div>
                    <p className="font-medium">Get a Custom Checklist</p>
                    <p className="text-sm text-muted-foreground">We'll generate a document checklist tailored for your region and client type</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">3</div>
                  <div>
                    <p className="font-medium">Track Your Progress</p>
                    <p className="text-sm text-muted-foreground">Upload documents and verify compliance as you prepare your bid</p>
                  </div>
                </div>
                
                <Separator className="my-4" />
                
                <div className="bg-blue-50/50 dark:bg-blue-950/20 p-4 rounded-lg">
                  <h4 className="font-medium flex items-center gap-2 mb-2">
                    <MapPin className="w-4 h-4 text-blue-600" />
                    GCC-Optimized
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    Our checklists are tailored for UAE, Saudi Arabia, Qatar, and other GCC government and private sector requirements.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="space-y-6">
            {profile && (
              <Card className="bg-muted/30">
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-6">
                      <div>
                        <p className="text-xs text-muted-foreground">RFP Type</p>
                        <p className="font-medium">{RFP_TYPES.find(t => t.value === profile.rfpType)?.label || profile.rfpType}</p>
                      </div>
                      <Separator orientation="vertical" className="h-8" />
                      <div>
                        <p className="text-xs text-muted-foreground">Client</p>
                        <p className="font-medium">{CLIENT_TYPES.find(t => t.value === profile.clientType)?.label || profile.clientType}</p>
                      </div>
                      <Separator orientation="vertical" className="h-8" />
                      <div>
                        <p className="text-xs text-muted-foreground">Region</p>
                        <p className="font-medium">{CLIENT_REGIONS.find(r => r.value === profile.clientRegion)?.label || profile.clientRegion}</p>
                      </div>
                      <Separator orientation="vertical" className="h-8" />
                      <div>
                        <p className="text-xs text-muted-foreground">Value</p>
                        <p className="font-medium">{CONTRACT_VALUES.find(v => v.value === profile.contractValueRange)?.label || profile.contractValueRange}</p>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => queryClient.invalidateQueries({ queryKey: ['checklist', projectId] })}>
                      Refresh
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            <ChecklistGrid 
              checklist={checklist} 
              onLinkDocument={handleLinkDocument} 
            />

            <div className="flex justify-end">
              <Button onClick={handleContinue} data-testid="button-continue">
                Continue to Documents
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </ProjectWorkflowLayout>
  );
}
