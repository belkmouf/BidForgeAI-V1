import { useState, useRef, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Building2, Globe, Palette, Image, FileText, CheckCircle, Upload, ExternalLink, User, Phone, Mail, MapPin, Award, Wand2 } from 'lucide-react';
import { useAuthStore, apiRequest } from '@/lib/auth';
import bidForgeLogo from '@assets/generated_images/bidforge_ai_premium_logo.png';

export default function OnboardingWizard() {
  const [, setLocation] = useLocation();
  const { user, accessToken, updateUser } = useAuthStore();
  
  const [companyName, setCompanyName] = useState(user?.companyName || '');
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
  
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingBranding, setIsLoadingBranding] = useState(true);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isAutoFilling, setIsAutoFilling] = useState(false);
  const [autoFillSuccess, setAutoFillSuccess] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAutoFill = async () => {
    if (!websiteUrl) {
      setError('Please enter a website URL first');
      return;
    }

    setIsAutoFilling(true);
    setError('');
    setAutoFillSuccess('');

    try {
      const response = await apiRequest('/api/branding/autofill', {
        method: 'POST',
        body: JSON.stringify({ websiteUrl }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to auto-fill from website');
        return;
      }

      const bp = data.branding;
      let fieldsUpdated = 0;

      if (bp.companyName && !companyName) {
        setCompanyName(bp.companyName);
        fieldsUpdated++;
      }
      if (bp.tagline && !tagline) {
        setTagline(bp.tagline);
        fieldsUpdated++;
      }
      if (bp.logoUrl && !logoUrl) {
        setLogoUrl(bp.logoUrl);
        fieldsUpdated++;
      }
      if (bp.primaryColor) {
        setPrimaryColor(bp.primaryColor);
        fieldsUpdated++;
      }
      if (bp.aboutUs && !aboutUs) {
        setAboutUs(bp.aboutUs);
        fieldsUpdated++;
      }
      if (bp.contactEmail && !contactEmail) {
        setContactEmail(bp.contactEmail);
        fieldsUpdated++;
      }
      if (bp.contactPhone && !contactPhone) {
        setContactPhone(bp.contactPhone);
        fieldsUpdated++;
      }
      if (bp.streetAddress && !streetAddress) {
        setStreetAddress(bp.streetAddress);
        fieldsUpdated++;
      }
      if (bp.city && !city) {
        setCity(bp.city);
        fieldsUpdated++;
      }
      if (bp.state && !state) {
        setState(bp.state);
        fieldsUpdated++;
      }
      if (bp.zip && !zip) {
        setZip(bp.zip);
        fieldsUpdated++;
      }

      if (fieldsUpdated > 0) {
        setAutoFillSuccess(`Auto-filled ${fieldsUpdated} field${fieldsUpdated > 1 ? 's' : ''} from website`);
      } else {
        setAutoFillSuccess('No new fields found to auto-fill');
      }
    } catch (err) {
      setError('Failed to connect to the website. Please check the URL.');
    } finally {
      setIsAutoFilling(false);
    }
  };

  useEffect(() => {
    const fetchBranding = async () => {
      try {
        const response = await apiRequest('/api/branding');
        const data = await response.json();
        
        if (data.brandingProfile) {
          const bp = data.brandingProfile;
          if (bp.companyName) setCompanyName(bp.companyName);
          if (bp.tagline) setTagline(bp.tagline);
          if (bp.websiteUrl) setWebsiteUrl(bp.websiteUrl);
          if (bp.primaryColor) setPrimaryColor(bp.primaryColor);
          if (bp.logoUrl) setLogoUrl(bp.logoUrl);
          if (bp.aboutUs) setAboutUs(bp.aboutUs);
          if (bp.contactName) setContactName(bp.contactName);
          if (bp.contactTitle) setContactTitle(bp.contactTitle);
          if (bp.contactPhone) setContactPhone(bp.contactPhone);
          if (bp.contactEmail) setContactEmail(bp.contactEmail);
          if (bp.streetAddress) setStreetAddress(bp.streetAddress);
          if (bp.city) setCity(bp.city);
          if (bp.state) setState(bp.state);
          if (bp.zip) setZip(bp.zip);
          if (bp.licenseNumber) setLicenseNumber(bp.licenseNumber);
        }
      } catch (err) {
        console.error('Failed to fetch branding:', err);
      } finally {
        setIsLoadingBranding(false);
      }
    };

    fetchBranding();
  }, []);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('Logo file must be less than 5MB');
      return;
    }

    setIsUploadingLogo(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/upload/logo', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to upload logo');
      } else {
        setLogoUrl(data.url);
      }
    } catch {
      setError('Failed to upload logo. Please try again.');
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/onboarding', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
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

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || data.details?.[0]?.message || 'Failed to complete setup');
      } else {
        updateUser({ onboardingStatus: 'complete' });
        setLocation('/');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const fullAddress = [streetAddress, city, state, zip].filter(Boolean).join(', ');

  if (isLoadingBranding) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-deep-teal" />
          <p className="text-slate-600">Loading your branding profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-gradient-to-br from-slate-100 to-slate-200">
      <div className="flex-1 flex flex-col h-screen">
        <div className="flex-1 overflow-y-auto p-8">
          <Card className="w-full max-w-2xl mx-auto bg-white border-deep-teal/30 shadow-xl">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4">
                <img 
                  src={bidForgeLogo} 
                  alt="BidForge AI" 
                  className="h-12 w-auto mx-auto"
                />
              </div>
              <CardTitle className="text-2xl font-syne text-slate-800">Set Up Your Company</CardTitle>
              <CardDescription className="text-slate-500">
                Customize your branding for professional bid documents
              </CardDescription>
            </CardHeader>
            <form onSubmit={handleSubmit}>
              <CardContent className="space-y-6">
              {error && (
                <Alert variant="destructive" className="bg-red-900/20 border-red-500/50">
                  <AlertDescription data-testid="error-message">{error}</AlertDescription>
                </Alert>
              )}
              
              {autoFillSuccess && (
                <Alert className="bg-green-100 border-green-500/50">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-700">{autoFillSuccess}</AlertDescription>
                </Alert>
              )}
              
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-slate-700 border-b pb-2">Company Information</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="companyName" className="text-slate-700 flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      Company Name *
                    </Label>
                    <Input
                      id="companyName"
                      type="text"
                      placeholder="Acme Construction"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      className="bg-slate-50 border-slate-300 text-slate-900 placeholder:text-slate-400"
                      data-testid="input-company-name"
                      required
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="tagline" className="text-slate-700 flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Tagline
                    </Label>
                    <Input
                      id="tagline"
                      type="text"
                      placeholder="Building Excellence Since 1998"
                      value={tagline}
                      onChange={(e) => setTagline(e.target.value)}
                      className="bg-slate-50 border-slate-300 text-slate-900 placeholder:text-slate-400"
                      data-testid="input-tagline"
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="websiteUrl" className="text-slate-700 flex items-center gap-2">
                    <Globe className="h-4 w-4" />
                    Website URL
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      id="websiteUrl"
                      type="url"
                      placeholder="https://yourcompany.com"
                      value={websiteUrl}
                      onChange={(e) => setWebsiteUrl(e.target.value)}
                      className="flex-1 bg-slate-50 border-slate-300 text-slate-900 placeholder:text-slate-400"
                      data-testid="input-website-url"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleAutoFill}
                      disabled={isAutoFilling || !websiteUrl}
                      className="border-deep-teal/50 text-deep-teal hover:bg-deep-teal/10"
                      data-testid="button-autofill"
                    >
                      {isAutoFilling ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Wand2 className="h-4 w-4" />
                      )}
                      <span className="ml-2 hidden sm:inline">Auto-fill</span>
                    </Button>
                  </div>
                  <p className="text-xs text-slate-500">
                    Enter your website URL and click Auto-fill to automatically extract branding information
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="licenseNumber" className="text-slate-700 flex items-center gap-2">
                    <Award className="h-4 w-4" />
                    License Number
                  </Label>
                  <Input
                    id="licenseNumber"
                    type="text"
                    placeholder="GC-123456"
                    value={licenseNumber}
                    onChange={(e) => setLicenseNumber(e.target.value)}
                    className="bg-slate-50 border-slate-300 text-slate-900 placeholder:text-slate-400"
                    data-testid="input-license-number"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="primaryColor" className="text-slate-700 flex items-center gap-2">
                    <Palette className="h-4 w-4" />
                    Primary Brand Color *
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      type="color"
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      className="w-16 h-10 p-1 cursor-pointer"
                      data-testid="input-color-picker"
                    />
                    <Input
                      id="primaryColor"
                      type="text"
                      placeholder="#0055AA"
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      pattern="^#[0-9A-Fa-f]{6}$"
                      className="flex-1 bg-slate-50 border-slate-300 text-slate-900 placeholder:text-slate-400 font-mono"
                      data-testid="input-primary-color"
                      required
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label className="text-slate-700 flex items-center gap-2">
                    <Image className="h-4 w-4" />
                    Company Logo
                  </Label>
                  <div className="flex gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleLogoUpload}
                      className="hidden"
                      data-testid="input-logo-file"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploadingLogo}
                      className="flex-1 bg-slate-50 border-slate-300 text-slate-700 hover:bg-slate-100"
                      data-testid="button-upload-logo"
                    >
                      {isUploadingLogo ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Upload className="mr-2 h-4 w-4" />
                          Upload Logo
                        </>
                      )}
                    </Button>
                    {logoUrl && (
                      <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-md">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <span className="text-sm text-green-700">Uploaded</span>
                      </div>
                    )}
                  </div>
                  {!logoUrl && (
                    <div className="flex items-center gap-2 text-sm text-slate-500">
                      <span>or enter URL:</span>
                      <Input
                        id="logoUrl"
                        type="url"
                        placeholder="https://example.com/logo.png"
                        value={logoUrl}
                        onChange={(e) => setLogoUrl(e.target.value)}
                        className="flex-1 bg-slate-50 border-slate-300 text-slate-900 placeholder:text-slate-400 h-8 text-sm"
                        data-testid="input-logo-url"
                      />
                    </div>
                  )}
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="aboutUs" className="text-slate-700 flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    About Your Company
                  </Label>
                  <Textarea
                    id="aboutUs"
                    placeholder="Brief description of your company for bid proposals..."
                    value={aboutUs}
                    onChange={(e) => setAboutUs(e.target.value)}
                    className="bg-slate-50 border-slate-300 text-slate-900 placeholder:text-slate-400 min-h-[80px]"
                    data-testid="input-about-us"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-slate-700 border-b pb-2">Contact Person</h3>
                <p className="text-sm text-slate-500">This person will appear as the contact on your bid documents</p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="contactName" className="text-slate-700 flex items-center gap-2">
                      <User className="h-4 w-4" />
                      Full Name
                    </Label>
                    <Input
                      id="contactName"
                      type="text"
                      placeholder="John Smith"
                      value={contactName}
                      onChange={(e) => setContactName(e.target.value)}
                      className="bg-slate-50 border-slate-300 text-slate-900 placeholder:text-slate-400"
                      data-testid="input-contact-name"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="contactTitle" className="text-slate-700 flex items-center gap-2">
                      <Award className="h-4 w-4" />
                      Job Title
                    </Label>
                    <Input
                      id="contactTitle"
                      type="text"
                      placeholder="Director of Business Development"
                      value={contactTitle}
                      onChange={(e) => setContactTitle(e.target.value)}
                      className="bg-slate-50 border-slate-300 text-slate-900 placeholder:text-slate-400"
                      data-testid="input-contact-title"
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="contactPhone" className="text-slate-700 flex items-center gap-2">
                      <Phone className="h-4 w-4" />
                      Phone Number
                    </Label>
                    <Input
                      id="contactPhone"
                      type="tel"
                      placeholder="(555) 123-4567"
                      value={contactPhone}
                      onChange={(e) => setContactPhone(e.target.value)}
                      className="bg-slate-50 border-slate-300 text-slate-900 placeholder:text-slate-400"
                      data-testid="input-contact-phone"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="contactEmail" className="text-slate-700 flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      Email Address
                    </Label>
                    <Input
                      id="contactEmail"
                      type="email"
                      placeholder="john@yourcompany.com"
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                      className="bg-slate-50 border-slate-300 text-slate-900 placeholder:text-slate-400"
                      data-testid="input-contact-email"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-slate-700 border-b pb-2">Company Address</h3>
                
                <div className="space-y-2">
                  <Label htmlFor="streetAddress" className="text-slate-700 flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    Street Address
                  </Label>
                  <Input
                    id="streetAddress"
                    type="text"
                    placeholder="1234 Industrial Parkway, Suite 500"
                    value={streetAddress}
                    onChange={(e) => setStreetAddress(e.target.value)}
                    className="bg-slate-50 border-slate-300 text-slate-900 placeholder:text-slate-400"
                    data-testid="input-street-address"
                  />
                </div>
                
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="city" className="text-slate-700">
                      City
                    </Label>
                    <Input
                      id="city"
                      type="text"
                      placeholder="Springfield"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="bg-slate-50 border-slate-300 text-slate-900 placeholder:text-slate-400"
                      data-testid="input-city"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="state" className="text-slate-700">
                      State
                    </Label>
                    <Input
                      id="state"
                      type="text"
                      placeholder="IL"
                      value={state}
                      onChange={(e) => setState(e.target.value)}
                      className="bg-slate-50 border-slate-300 text-slate-900 placeholder:text-slate-400"
                      data-testid="input-state"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="zip" className="text-slate-700">
                      ZIP Code
                    </Label>
                    <Input
                      id="zip"
                      type="text"
                      placeholder="62701"
                      value={zip}
                      onChange={(e) => setZip(e.target.value)}
                      className="bg-slate-50 border-slate-300 text-slate-900 placeholder:text-slate-400"
                      data-testid="input-zip"
                    />
                  </div>
                </div>
              </div>

              <Button 
                type="submit" 
                className="w-full bg-teal-700 hover:bg-teal-800 text-white mt-8 py-6 text-lg font-semibold shadow-lg"
                disabled={isLoading || !companyName || !primaryColor}
                data-testid="button-complete-setup"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Complete Setup
                  </>
                )}
              </Button>
            </CardContent>
          </form>
        </Card>
        <div className="h-16"></div>
        </div>
      </div>

      <div className="hidden lg:flex flex-1 items-center justify-center bg-slate-800 p-8 overflow-y-auto">
        <div className="w-full max-w-md">
          <h3 className="text-white text-lg font-semibold mb-4 text-center">Live Preview</h3>
          <div 
            className="bg-white rounded-lg shadow-2xl overflow-hidden"
            style={{ aspectRatio: '210/297' }}
          >
            <div 
              className="h-20 flex items-center justify-center px-6"
              style={{ backgroundColor: primaryColor }}
            >
              {logoUrl ? (
                <img 
                  src={logoUrl} 
                  alt="Company Logo" 
                  className="h-12 w-auto object-contain"
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                />
              ) : (
                <span className="text-white font-bold text-xl">{companyName || 'Your Company'}</span>
              )}
            </div>
            
            <div className="p-4 space-y-3 text-sm">
              <div>
                <h1 className="text-lg font-bold text-slate-800">{companyName || 'Company Name'}</h1>
                {tagline && (
                  <p className="text-xs text-slate-500 italic">{tagline}</p>
                )}
                {websiteUrl && (
                  <a 
                    href={websiteUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-xs text-deep-teal hover:underline flex items-center gap-1"
                  >
                    {websiteUrl}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
              
              {(contactName || contactTitle || contactPhone || contactEmail) && (
                <div className="border-t pt-3">
                  <h2 className="text-xs font-semibold text-slate-700 mb-1">Contact</h2>
                  <div className="text-xs text-slate-600 space-y-0.5">
                    {contactName && <p className="font-medium">{contactName}</p>}
                    {contactTitle && <p className="text-slate-500">{contactTitle}</p>}
                    {contactPhone && <p>{contactPhone}</p>}
                    {contactEmail && <p>{contactEmail}</p>}
                  </div>
                </div>
              )}
              
              {fullAddress && (
                <div className="border-t pt-3">
                  <h2 className="text-xs font-semibold text-slate-700 mb-1">Address</h2>
                  <p className="text-xs text-slate-600">{fullAddress}</p>
                  {licenseNumber && (
                    <p className="text-xs text-slate-500 mt-1">License: {licenseNumber}</p>
                  )}
                </div>
              )}
              
              <div className="border-t pt-3">
                <h2 className="text-xs font-semibold text-slate-700 mb-1">About Us</h2>
                <p className="text-xs text-slate-600 leading-relaxed line-clamp-3">
                  {aboutUs || 'Your company description will appear here...'}
                </p>
              </div>
              
              <div 
                className="mt-4 py-1.5 text-center text-xs font-medium text-white rounded"
                style={{ backgroundColor: primaryColor }}
              >
                Proposal by {companyName || 'Your Company'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
