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
import { Settings as SettingsIcon, Bell, Palette, Shield, User, LogOut, Lock, Loader2, Building2, Globe, Phone, Mail, MapPin, Award, Upload, CheckCircle } from 'lucide-react';
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
          </div>
        </div>
      </main>
    </div>
  );
}
