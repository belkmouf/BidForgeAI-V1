import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'wouter';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Settings as SettingsIcon, Bell, Palette, Shield, User, LogOut, Lock, Loader2, Building2, Globe, Phone, Mail, MapPin, Award, Upload, CheckCircle, FileText, Trash2, File, FileSpreadsheet, Sparkles, Plus, Edit2, Save, X } from 'lucide-react';
import { useAuthStore, logout, apiRequest } from '@/lib/auth';

interface BrandingProfile {
  companyName?: string;
  tagline?: string;
  websiteUrl?: string;
  primaryColor?: string;
  logoUrl?: string;
  aboutUs?: string;
  contactName?: string;
  contactTitle?: string;
  contactPhone?: string;
  contactEmail?: string;
  streetAddress?: string;
  city?: string;
  state?: string;
  zip?: string;
  licenseNumber?: string;
}

export default function Settings() {
  const [, setLocation] = useLocation();
  const { user, isAuthenticated, updateUser } = useAuthStore();
  const [name, setName] = useState(user?.name || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [profileLoading, setProfileLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState('');
  const [profileError, setProfileError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const [companyName, setCompanyName] = useState('');
  const [tagline, setTagline] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#0055AA');
  const [logoUrl, setLogoUrl] = useState('');
  const [aboutUs, setAboutUs] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactTitle, setContactTitle] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [streetAddress, setStreetAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zip, setZip] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  
  const [brandingLoading, setBrandingLoading] = useState(false);
  const [brandingFetching, setBrandingFetching] = useState(true);
  const [brandingSuccess, setBrandingSuccess] = useState('');
  const [brandingError, setBrandingError] = useState('');
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Knowledge base documents state
  interface KnowledgeDoc {
    id: number;
    filename: string;
    originalName: string;
    fileType: string;
    fileSize: number;
    isProcessed: boolean;
    chunkCount: number;
    uploadedAt: string;
  }
  const [knowledgeDocs, setKnowledgeDocs] = useState<KnowledgeDoc[]>([]);
  const [isUploadingKnowledge, setIsUploadingKnowledge] = useState(false);
  const [knowledgeError, setKnowledgeError] = useState('');
  const [knowledgeSuccess, setKnowledgeSuccess] = useState('');
  const [isDeletingDoc, setIsDeletingDoc] = useState<number | null>(null);
  const knowledgeInputRef = useRef<HTMLInputElement>(null);
  
  // AI Instructions state
  interface AIInstructionType {
    id: number;
    name: string;
    instructions: string;
    isDefault: boolean;
    createdAt: string;
    updatedAt: string;
  }
  const [aiInstructions, setAiInstructions] = useState<AIInstructionType[]>([]);
  const [aiInstructionsLoading, setAiInstructionsLoading] = useState(true);
  const [aiInstructionsError, setAiInstructionsError] = useState('');
  const [aiInstructionsSuccess, setAiInstructionsSuccess] = useState('');
  const [editingInstructionId, setEditingInstructionId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState('');
  const [editingText, setEditingText] = useState('');
  const [isCreatingInstruction, setIsCreatingInstruction] = useState(false);
  const [newInstructionName, setNewInstructionName] = useState('');
  const [newInstructionText, setNewInstructionText] = useState('');
  const [savingInstructionId, setSavingInstructionId] = useState<number | null>(null);
  const [deletingInstructionId, setDeletingInstructionId] = useState<number | null>(null);

  useEffect(() => {
    const fetchBranding = async () => {
      try {
        const response = await apiRequest('/api/branding');
        if (response.ok) {
          const data = await response.json();
          const branding: BrandingProfile = data.brandingProfile || {};
          setCompanyName(branding.companyName || user?.companyName || '');
          setTagline(branding.tagline || '');
          setWebsiteUrl(branding.websiteUrl || '');
          setPrimaryColor(branding.primaryColor || '#0055AA');
          setLogoUrl(branding.logoUrl || '');
          setAboutUs(branding.aboutUs || '');
          setContactName(branding.contactName || '');
          setContactTitle(branding.contactTitle || '');
          setContactPhone(branding.contactPhone || '');
          setContactEmail(branding.contactEmail || '');
          setStreetAddress(branding.streetAddress || '');
          setCity(branding.city || '');
          setState(branding.state || '');
          setZip(branding.zip || '');
          setLicenseNumber(branding.licenseNumber || '');
        }
      } catch (error) {
        console.error('Failed to fetch branding:', error);
      } finally {
        setBrandingFetching(false);
      }
    };

    if (isAuthenticated) {
      fetchBranding();
    }
  }, [isAuthenticated, user?.companyName]);

  // Fetch knowledge base documents
  useEffect(() => {
    const fetchKnowledgeDocs = async () => {
      try {
        const response = await apiRequest('/api/knowledge-base');
        if (response.ok) {
          const data = await response.json();
          setKnowledgeDocs(data.documents || []);
        }
      } catch (error) {
        console.error('Failed to fetch knowledge docs:', error);
      }
    };

    if (isAuthenticated) {
      fetchKnowledgeDocs();
    }
  }, [isAuthenticated]);

  // Fetch AI instructions
  useEffect(() => {
    const fetchAiInstructions = async () => {
      try {
        const response = await apiRequest('/api/ai-instructions');
        if (response.ok) {
          const data = await response.json();
          setAiInstructions(data.instructions || []);
        }
      } catch (error) {
        console.error('Failed to fetch AI instructions:', error);
      } finally {
        setAiInstructionsLoading(false);
      }
    };

    if (isAuthenticated) {
      fetchAiInstructions();
    }
  }, [isAuthenticated]);

  const handleStartEdit = (instruction: AIInstructionType) => {
    setEditingInstructionId(instruction.id);
    setEditingName(instruction.name);
    setEditingText(instruction.instructions);
  };

  const handleCancelEdit = () => {
    setEditingInstructionId(null);
    setEditingName('');
    setEditingText('');
  };

  const handleSaveInstruction = async (id: number) => {
    setSavingInstructionId(id);
    setAiInstructionsError('');
    setAiInstructionsSuccess('');

    try {
      const response = await apiRequest(`/api/ai-instructions/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: editingName, instructions: editingText }),
      });

      if (response.ok) {
        const data = await response.json();
        setAiInstructions(prev => prev.map(i => i.id === id ? data.instruction : i));
        setAiInstructionsSuccess('Instruction updated successfully');
        handleCancelEdit();
      } else {
        const error = await response.json();
        setAiInstructionsError(error.error || 'Failed to update instruction');
      }
    } catch {
      setAiInstructionsError('Failed to update instruction. Please try again.');
    } finally {
      setSavingInstructionId(null);
    }
  };

  const handleDeleteInstruction = async (id: number) => {
    setDeletingInstructionId(id);
    setAiInstructionsError('');

    try {
      const response = await apiRequest(`/api/ai-instructions/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setAiInstructions(prev => prev.filter(i => i.id !== id));
        setAiInstructionsSuccess('Instruction deleted successfully');
      } else {
        const error = await response.json();
        setAiInstructionsError(error.error || 'Failed to delete instruction');
      }
    } catch {
      setAiInstructionsError('Failed to delete instruction. Please try again.');
    } finally {
      setDeletingInstructionId(null);
    }
  };

  const handleCreateInstruction = async () => {
    if (!newInstructionName.trim() || !newInstructionText.trim()) {
      setAiInstructionsError('Name and instructions are required');
      return;
    }

    setSavingInstructionId(-1);
    setAiInstructionsError('');
    setAiInstructionsSuccess('');

    try {
      const response = await apiRequest('/api/ai-instructions', {
        method: 'POST',
        body: JSON.stringify({ name: newInstructionName, instructions: newInstructionText }),
      });

      if (response.ok) {
        const data = await response.json();
        setAiInstructions(prev => [...prev, data.instruction]);
        setAiInstructionsSuccess('Instruction created successfully');
        setIsCreatingInstruction(false);
        setNewInstructionName('');
        setNewInstructionText('');
      } else {
        const error = await response.json();
        setAiInstructionsError(error.error || 'Failed to create instruction');
      }
    } catch {
      setAiInstructionsError('Failed to create instruction. Please try again.');
    } finally {
      setSavingInstructionId(null);
    }
  };

  const handleKnowledgeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const allowedTypes = [
      'text/csv',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/pdf',
      'text/plain',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel'
    ];

    setIsUploadingKnowledge(true);
    setKnowledgeError('');
    setKnowledgeSuccess('');

    try {
      for (const file of Array.from(files)) {
        if (!allowedTypes.includes(file.type)) {
          setKnowledgeError(`File type not supported: ${file.name}. Use CSV, DOCX, PDF, TXT, or Excel files.`);
          continue;
        }

        if (file.size > 10 * 1024 * 1024) {
          setKnowledgeError(`File too large: ${file.name}. Maximum size is 10MB.`);
          continue;
        }

        const formData = new FormData();
        formData.append('file', file);

        const res = await fetch('/api/knowledge-base/upload', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${useAuthStore.getState().accessToken}`,
          },
          body: formData,
        });

        const data = await res.json();

        if (!res.ok) {
          setKnowledgeError(data.error || `Failed to upload ${file.name}`);
        } else {
          setKnowledgeDocs(prev => [...prev, data.document]);
          setKnowledgeSuccess(`Successfully uploaded ${file.name}`);
        }
      }
    } catch {
      setKnowledgeError('Failed to upload documents. Please try again.');
    } finally {
      setIsUploadingKnowledge(false);
      if (knowledgeInputRef.current) {
        knowledgeInputRef.current.value = '';
      }
    }
  };

  const handleDeleteKnowledgeDoc = async (docId: number) => {
    setIsDeletingDoc(docId);
    setKnowledgeError('');

    try {
      const response = await apiRequest(`/api/knowledge-base/${docId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setKnowledgeDocs(prev => prev.filter(doc => doc.id !== docId));
        setKnowledgeSuccess('Document deleted successfully');
      } else {
        const error = await response.json();
        setKnowledgeError(error.error || 'Failed to delete document');
      }
    } catch {
      setKnowledgeError('Failed to delete document. Please try again.');
    } finally {
      setIsDeletingDoc(null);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = (fileType: string) => {
    if (fileType === 'pdf') return <FileText className="h-5 w-5 text-red-500" />;
    if (fileType === 'docx') return <FileText className="h-5 w-5 text-blue-500" />;
    if (fileType === 'xlsx' || fileType === 'csv') return <FileSpreadsheet className="h-5 w-5 text-green-500" />;
    return <File className="h-5 w-5 text-gray-500" />;
  };

  const handleLogout = async () => {
    await logout();
    setLocation('/login');
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileLoading(true);
    setProfileError('');
    setProfileSuccess('');

    try {
      const response = await apiRequest('/api/auth/profile', {
        method: 'PATCH',
        body: JSON.stringify({ name }),
      });

      if (response.ok) {
        const data = await response.json();
        updateUser(data.user);
        setProfileSuccess('Profile updated successfully');
      } else {
        const error = await response.json();
        setProfileError(error.error || 'Failed to update profile');
      }
    } catch (error) {
      setProfileError('Network error. Please try again.');
    } finally {
      setProfileLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordLoading(true);
    setPasswordError('');
    setPasswordSuccess('');

    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match');
      setPasswordLoading(false);
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError('Password must be at least 8 characters');
      setPasswordLoading(false);
      return;
    }

    try {
      const response = await apiRequest('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      if (response.ok) {
        setPasswordSuccess('Password changed successfully');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        const error = await response.json();
        setPasswordError(error.error || 'Failed to change password');
      }
    } catch (error) {
      setPasswordError('Network error. Please try again.');
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setBrandingError('Please select an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setBrandingError('Logo file must be less than 5MB');
      return;
    }

    setIsUploadingLogo(true);
    setBrandingError('');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/upload/logo', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${useAuthStore.getState().accessToken}`,
        },
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setBrandingError(data.error || 'Failed to upload logo');
      } else {
        setLogoUrl(data.url);
      }
    } catch {
      setBrandingError('Failed to upload logo. Please try again.');
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const handleSaveBranding = async (e: React.FormEvent) => {
    e.preventDefault();
    setBrandingLoading(true);
    setBrandingError('');
    setBrandingSuccess('');

    try {
      const response = await apiRequest('/api/branding', {
        method: 'PATCH',
        body: JSON.stringify({
          companyName,
          tagline,
          websiteUrl,
          primaryColor,
          logoUrl,
          aboutUs,
          contactName,
          contactTitle,
          contactPhone,
          contactEmail,
          streetAddress,
          city,
          state,
          zip,
          licenseNumber,
        }),
      });

      if (response.ok) {
        setBrandingSuccess('Company branding saved successfully! Your bids will now use this information.');
      } else {
        const error = await response.json();
        setBrandingError(error.error || error.details?.[0]?.message || 'Failed to save branding');
      }
    } catch (error) {
      setBrandingError('Network error. Please try again.');
    } finally {
      setBrandingLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar />
      
      <main className="flex-1 ml-64 p-8 overflow-auto">
        <div className="max-w-7xl mx-auto space-y-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <SettingsIcon className="h-6 w-6 text-primary" />
              <h1 className="text-3xl font-display font-bold">Settings</h1>
            </div>
            {isAuthenticated && (
              <Button
                variant="outline"
                onClick={handleLogout}
                className="text-red-500 border-red-500 hover:bg-red-500/10"
                data-testid="button-logout"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </Button>
            )}
          </div>

          <div className="max-w-4xl mx-auto space-y-6">
            {isAuthenticated && (
              <>
                <Card data-testid="card-profile-settings">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <User className="h-5 w-5" />
                      Profile
                    </CardTitle>
                    <CardDescription>
                      Manage your account information
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleUpdateProfile} className="space-y-4">
                      {profileSuccess && (
                        <Alert className="bg-green-900/20 border-green-500/50">
                          <AlertDescription className="text-green-400">{profileSuccess}</AlertDescription>
                        </Alert>
                      )}
                      {profileError && (
                        <Alert variant="destructive" className="bg-red-900/20 border-red-500/50">
                          <AlertDescription>{profileError}</AlertDescription>
                        </Alert>
                      )}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="email">Email</Label>
                          <Input
                            id="email"
                            value={user?.email || ''}
                            disabled
                            className="bg-muted"
                            data-testid="input-user-email"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="role">Role</Label>
                          <Input
                            id="role"
                            value={user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : ''}
                            disabled
                            className="bg-muted"
                            data-testid="input-user-role"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="name">Full Name</Label>
                        <Input
                          id="name"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="Your name"
                          data-testid="input-user-name"
                        />
                      </div>
                      <Button type="submit" disabled={profileLoading} data-testid="button-save-profile">
                        {profileLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                        Save Profile
                      </Button>
                    </form>
                  </CardContent>
                </Card>

                <Card data-testid="card-password-settings">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Lock className="h-5 w-5" />
                      Change Password
                    </CardTitle>
                    <CardDescription>
                      Update your password
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleChangePassword} className="space-y-4">
                      {passwordSuccess && (
                        <Alert className="bg-green-900/20 border-green-500/50">
                          <AlertDescription className="text-green-400">{passwordSuccess}</AlertDescription>
                        </Alert>
                      )}
                      {passwordError && (
                        <Alert variant="destructive" className="bg-red-900/20 border-red-500/50">
                          <AlertDescription>{passwordError}</AlertDescription>
                        </Alert>
                      )}
                      <div className="space-y-2">
                        <Label htmlFor="current-password">Current Password</Label>
                        <Input
                          id="current-password"
                          type="password"
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          required
                          data-testid="input-current-password"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="new-password">New Password</Label>
                          <Input
                            id="new-password"
                            type="password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            required
                            minLength={8}
                            data-testid="input-new-password"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="confirm-password">Confirm Password</Label>
                          <Input
                            id="confirm-password"
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            required
                            data-testid="input-confirm-password"
                          />
                        </div>
                      </div>
                      <Button type="submit" disabled={passwordLoading} data-testid="button-change-password">
                        {passwordLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                        Change Password
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              </>
            )}

            <Card data-testid="card-company-settings">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Company Branding
                </CardTitle>
                <CardDescription>
                  This information appears in your AI-generated bid documents
                </CardDescription>
              </CardHeader>
              <CardContent>
                {brandingFetching ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin mr-2" />
                    <span>Loading branding...</span>
                  </div>
                ) : (
                  <form onSubmit={handleSaveBranding} className="space-y-6">
                    {brandingSuccess && (
                      <Alert className="bg-green-900/20 border-green-500/50">
                        <AlertDescription className="text-green-400">{brandingSuccess}</AlertDescription>
                      </Alert>
                    )}
                    {brandingError && (
                      <Alert variant="destructive" className="bg-red-900/20 border-red-500/50">
                        <AlertDescription>{brandingError}</AlertDescription>
                      </Alert>
                    )}

                    <div className="space-y-4">
                      <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Company Information</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="company-name" className="flex items-center gap-2">
                            <Building2 className="h-4 w-4" />
                            Company Name *
                          </Label>
                          <Input
                            id="company-name"
                            value={companyName}
                            onChange={(e) => setCompanyName(e.target.value)}
                            placeholder="Acme Construction"
                            required
                            data-testid="input-company-name"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="tagline">Tagline</Label>
                          <Input
                            id="tagline"
                            value={tagline}
                            onChange={(e) => setTagline(e.target.value)}
                            placeholder="Building Excellence Since 1998"
                            data-testid="input-tagline"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="website" className="flex items-center gap-2">
                            <Globe className="h-4 w-4" />
                            Website URL
                          </Label>
                          <Input
                            id="website"
                            type="url"
                            value={websiteUrl}
                            onChange={(e) => setWebsiteUrl(e.target.value)}
                            placeholder="https://yourcompany.com"
                            data-testid="input-website"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="license" className="flex items-center gap-2">
                            <Award className="h-4 w-4" />
                            License Number
                          </Label>
                          <Input
                            id="license"
                            value={licenseNumber}
                            onChange={(e) => setLicenseNumber(e.target.value)}
                            placeholder="GC-123456"
                            data-testid="input-license"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="primary-color" className="flex items-center gap-2">
                            <Palette className="h-4 w-4" />
                            Primary Brand Color *
                          </Label>
                          <div className="flex gap-2">
                            <Input
                              type="color"
                              value={primaryColor}
                              onChange={(e) => setPrimaryColor(e.target.value)}
                              className="w-16 h-10 p-1 cursor-pointer"
                            />
                            <Input
                              id="primary-color"
                              value={primaryColor}
                              onChange={(e) => setPrimaryColor(e.target.value)}
                              pattern="^#[0-9A-Fa-f]{6}$"
                              className="flex-1 font-mono"
                              required
                              data-testid="input-primary-color"
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label className="flex items-center gap-2">Company Logo</Label>
                          <div className="flex gap-2">
                            <input
                              ref={fileInputRef}
                              type="file"
                              accept="image/*"
                              onChange={handleLogoUpload}
                              className="hidden"
                            />
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => fileInputRef.current?.click()}
                              disabled={isUploadingLogo}
                              className="flex-1"
                            >
                              {isUploadingLogo ? (
                                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Uploading...</>
                              ) : (
                                <><Upload className="mr-2 h-4 w-4" />Upload Logo</>
                              )}
                            </Button>
                            {logoUrl && (
                              <div className="flex items-center gap-2 px-3 py-2 bg-green-900/20 border border-green-500/50 rounded-md">
                                <CheckCircle className="h-4 w-4 text-green-500" />
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="about-us">About Your Company</Label>
                        <Textarea
                          id="about-us"
                          value={aboutUs}
                          onChange={(e) => setAboutUs(e.target.value)}
                          placeholder="Brief description of your company for bid proposals..."
                          className="min-h-[80px]"
                          data-testid="input-about-us"
                        />
                      </div>
                    </div>

                    <Separator />

                    <div className="space-y-4">
                      <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Contact Person (for bids)</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="contact-name" className="flex items-center gap-2">
                            <User className="h-4 w-4" />
                            Full Name
                          </Label>
                          <Input
                            id="contact-name"
                            value={contactName}
                            onChange={(e) => setContactName(e.target.value)}
                            placeholder="John Smith"
                            data-testid="input-contact-name"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="contact-title">Job Title</Label>
                          <Input
                            id="contact-title"
                            value={contactTitle}
                            onChange={(e) => setContactTitle(e.target.value)}
                            placeholder="Director of Business Development"
                            data-testid="input-contact-title"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="contact-phone" className="flex items-center gap-2">
                            <Phone className="h-4 w-4" />
                            Phone Number
                          </Label>
                          <Input
                            id="contact-phone"
                            value={contactPhone}
                            onChange={(e) => setContactPhone(e.target.value)}
                            placeholder="(555) 123-4567"
                            data-testid="input-contact-phone"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="contact-email" className="flex items-center gap-2">
                            <Mail className="h-4 w-4" />
                            Email Address
                          </Label>
                          <Input
                            id="contact-email"
                            type="email"
                            value={contactEmail}
                            onChange={(e) => setContactEmail(e.target.value)}
                            placeholder="john@yourcompany.com"
                            data-testid="input-contact-email"
                          />
                        </div>
                      </div>
                    </div>

                    <Separator />

                    <div className="space-y-4">
                      <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Company Address</h4>
                      <div className="space-y-2">
                        <Label htmlFor="street-address" className="flex items-center gap-2">
                          <MapPin className="h-4 w-4" />
                          Street Address
                        </Label>
                        <Input
                          id="street-address"
                          value={streetAddress}
                          onChange={(e) => setStreetAddress(e.target.value)}
                          placeholder="1234 Industrial Parkway, Suite 500"
                          data-testid="input-street-address"
                        />
                      </div>
                      <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="city">City</Label>
                          <Input
                            id="city"
                            value={city}
                            onChange={(e) => setCity(e.target.value)}
                            placeholder="Springfield"
                            data-testid="input-city"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="state">State</Label>
                          <Input
                            id="state"
                            value={state}
                            onChange={(e) => setState(e.target.value)}
                            placeholder="IL"
                            data-testid="input-state"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="zip">ZIP Code</Label>
                          <Input
                            id="zip"
                            value={zip}
                            onChange={(e) => setZip(e.target.value)}
                            placeholder="62701"
                            data-testid="input-zip"
                          />
                        </div>
                      </div>
                    </div>

                    <Button type="submit" disabled={brandingLoading || !companyName || !primaryColor} className="w-full" data-testid="button-save-branding">
                      {brandingLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                      Save Company Branding
                    </Button>
                  </form>
                )}
              </CardContent>
            </Card>

            <Card data-testid="card-notification-settings">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-5 w-5" />
                  Notifications
                </CardTitle>
                <CardDescription>
                  Manage your notification preferences
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Email Notifications</Label>
                    <p className="text-sm text-muted-foreground">Receive updates about bid submissions</p>
                  </div>
                  <Switch data-testid="switch-email-notifications" />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Deadline Reminders</Label>
                    <p className="text-sm text-muted-foreground">Get reminded before bid deadlines</p>
                  </div>
                  <Switch defaultChecked data-testid="switch-deadline-reminders" />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <Label>AI Generation Complete</Label>
                    <p className="text-sm text-muted-foreground">Notify when bid generation is complete</p>
                  </div>
                  <Switch defaultChecked data-testid="switch-ai-complete" />
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-appearance-settings">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Palette className="h-5 w-5" />
                  Appearance
                </CardTitle>
                <CardDescription>
                  Customize how BidForge looks
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Dark Mode</Label>
                    <p className="text-sm text-muted-foreground">Use dark theme throughout the app</p>
                  </div>
                  <Switch defaultChecked data-testid="switch-dark-mode" />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Compact View</Label>
                    <p className="text-sm text-muted-foreground">Show more content with smaller spacing</p>
                  </div>
                  <Switch data-testid="switch-compact-view" />
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-knowledge-base-settings">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Supporting Documents (Knowledge Base)
                </CardTitle>
                <CardDescription>
                  Upload documents (CSV, DOCX, PDF, TXT, Excel) to use as a knowledge base during AI bid generation. These documents help the AI understand your company's capabilities, past projects, and technical specifications.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {knowledgeSuccess && (
                  <Alert className="bg-green-900/20 border-green-500/50">
                    <AlertDescription className="text-green-400">{knowledgeSuccess}</AlertDescription>
                  </Alert>
                )}
                {knowledgeError && (
                  <Alert variant="destructive" className="bg-red-900/20 border-red-500/50">
                    <AlertDescription>{knowledgeError}</AlertDescription>
                  </Alert>
                )}

                <div className="space-y-2">
                  <input
                    ref={knowledgeInputRef}
                    type="file"
                    accept=".csv,.docx,.pdf,.txt,.xlsx,.xls"
                    multiple
                    onChange={handleKnowledgeUpload}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => knowledgeInputRef.current?.click()}
                    disabled={isUploadingKnowledge}
                    className="w-full h-24 border-dashed border-2 hover:border-primary/50"
                    data-testid="button-upload-knowledge"
                  >
                    {isUploadingKnowledge ? (
                      <div className="flex flex-col items-center gap-2">
                        <Loader2 className="h-6 w-6 animate-spin" />
                        <span>Uploading and processing...</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2">
                        <Upload className="h-6 w-6" />
                        <span>Click to upload documents</span>
                        <span className="text-xs text-muted-foreground">CSV, DOCX, PDF, TXT, Excel (max 10MB each)</span>
                      </div>
                    )}
                  </Button>
                </div>

                {knowledgeDocs.length > 0 && (
                  <>
                    <Separator />
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Uploaded Documents ({knowledgeDocs.length})</Label>
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {knowledgeDocs.map((doc) => (
                          <div
                            key={doc.id}
                            className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border"
                            data-testid={`knowledge-doc-${doc.id}`}
                          >
                            <div className="flex items-center gap-3">
                              {getFileIcon(doc.fileType)}
                              <div>
                                <p className="text-sm font-medium truncate max-w-[200px]">{doc.originalName}</p>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  <span>{formatFileSize(doc.fileSize)}</span>
                                  <span>•</span>
                                  <span>{doc.fileType.toUpperCase()}</span>
                                  {doc.isProcessed ? (
                                    <>
                                      <span>•</span>
                                      <span className="text-green-500 flex items-center gap-1">
                                        <CheckCircle className="h-3 w-3" />
                                        {doc.chunkCount} chunks indexed
                                      </span>
                                    </>
                                  ) : (
                                    <>
                                      <span>•</span>
                                      <span className="text-yellow-500">Processing...</span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteKnowledgeDoc(doc.id)}
                              disabled={isDeletingDoc === doc.id}
                              className="text-red-500 hover:text-red-600 hover:bg-red-500/10"
                              data-testid={`button-delete-doc-${doc.id}`}
                            >
                              {isDeletingDoc === doc.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {knowledgeDocs.length === 0 && (
                  <div className="text-center py-6 text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No documents uploaded yet</p>
                    <p className="text-sm">Upload company documents to enhance AI-generated bids</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card data-testid="card-ai-instructions-settings">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5" />
                  AI Instructions
                </CardTitle>
                <CardDescription>
                  Create and manage reusable instruction presets for AI bid generation. These presets will be available in the bid generator dropdown.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {aiInstructionsSuccess && (
                  <Alert className="bg-green-900/20 border-green-500/50">
                    <AlertDescription className="text-green-400">{aiInstructionsSuccess}</AlertDescription>
                  </Alert>
                )}
                {aiInstructionsError && (
                  <Alert variant="destructive" className="bg-red-900/20 border-red-500/50">
                    <AlertDescription>{aiInstructionsError}</AlertDescription>
                  </Alert>
                )}

                {aiInstructionsLoading ? (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <>
                    <div className="space-y-3">
                      {aiInstructions.map((instruction) => (
                        <div
                          key={instruction.id}
                          className="p-4 bg-muted/50 rounded-lg border"
                          data-testid={`ai-instruction-${instruction.id}`}
                        >
                          {editingInstructionId === instruction.id ? (
                            <div className="space-y-3">
                              <Input
                                value={editingName}
                                onChange={(e) => setEditingName(e.target.value)}
                                placeholder="Instruction name"
                                data-testid={`input-instruction-name-${instruction.id}`}
                              />
                              <Textarea
                                value={editingText}
                                onChange={(e) => setEditingText(e.target.value)}
                                placeholder="Enter AI instructions..."
                                className="min-h-[150px]"
                                data-testid={`textarea-instruction-${instruction.id}`}
                              />
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  onClick={() => handleSaveInstruction(instruction.id)}
                                  disabled={savingInstructionId === instruction.id}
                                  data-testid={`button-save-instruction-${instruction.id}`}
                                >
                                  {savingInstructionId === instruction.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                                  ) : (
                                    <Save className="h-4 w-4 mr-1" />
                                  )}
                                  Save
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={handleCancelEdit}
                                  data-testid={`button-cancel-edit-${instruction.id}`}
                                >
                                  <X className="h-4 w-4 mr-1" />
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <h4 className="font-medium">{instruction.name}</h4>
                                  {instruction.isDefault && (
                                    <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded">Default</span>
                                  )}
                                </div>
                                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                                  {instruction.instructions.substring(0, 150)}...
                                </p>
                              </div>
                              <div className="flex gap-1 ml-4">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleStartEdit(instruction)}
                                  data-testid={`button-edit-instruction-${instruction.id}`}
                                >
                                  <Edit2 className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteInstruction(instruction.id)}
                                  disabled={deletingInstructionId === instruction.id || aiInstructions.length <= 1}
                                  className="text-red-500 hover:text-red-600 hover:bg-red-500/10"
                                  data-testid={`button-delete-instruction-${instruction.id}`}
                                >
                                  {deletingInstructionId === instruction.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Trash2 className="h-4 w-4" />
                                  )}
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {isCreatingInstruction ? (
                      <div className="p-4 border-2 border-dashed border-primary/50 rounded-lg space-y-3">
                        <Input
                          value={newInstructionName}
                          onChange={(e) => setNewInstructionName(e.target.value)}
                          placeholder="Enter instruction name (e.g., 'Technical Proposal')"
                          data-testid="input-new-instruction-name"
                        />
                        <Textarea
                          value={newInstructionText}
                          onChange={(e) => setNewInstructionText(e.target.value)}
                          placeholder="Enter the AI instructions..."
                          className="min-h-[150px]"
                          data-testid="textarea-new-instruction"
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={handleCreateInstruction}
                            disabled={savingInstructionId === -1}
                            data-testid="button-save-new-instruction"
                          >
                            {savingInstructionId === -1 ? (
                              <Loader2 className="h-4 w-4 animate-spin mr-1" />
                            ) : (
                              <Save className="h-4 w-4 mr-1" />
                            )}
                            Create
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setIsCreatingInstruction(false);
                              setNewInstructionName('');
                              setNewInstructionText('');
                            }}
                            data-testid="button-cancel-new-instruction"
                          >
                            <X className="h-4 w-4 mr-1" />
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => setIsCreatingInstruction(true)}
                        data-testid="button-add-instruction"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add New Instruction Preset
                      </Button>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
