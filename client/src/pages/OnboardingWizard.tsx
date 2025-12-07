import { useState } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Building2, Globe, Palette, Image, FileText, CheckCircle } from 'lucide-react';
import { useAuthStore } from '@/lib/auth';
import bidForgeLogo from '@assets/generated_images/bidforge_ai_premium_logo.png';

export default function OnboardingWizard() {
  const [, setLocation] = useLocation();
  const { user, accessToken, updateUser } = useAuthStore();
  
  const [companyName, setCompanyName] = useState(user?.companyName || '');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#0055AA');
  const [logoUrl, setLogoUrl] = useState('');
  const [aboutUs, setAboutUs] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

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
          websiteUrl,
          primaryColor,
          logoUrl,
          aboutUs,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || data.details?.[0]?.message || 'Failed to complete setup');
      } else {
        updateUser({ onboardingStatus: 'complete' });
        setLocation('/dashboard');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-gradient-to-br from-slate-100 to-slate-200">
      <div className="flex-1 flex items-center justify-center p-8">
        <Card className="w-full max-w-lg bg-white border-deep-teal/30 shadow-xl">
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
            <CardContent className="space-y-4">
              {error && (
                <Alert variant="destructive" className="bg-red-900/20 border-red-500/50">
                  <AlertDescription data-testid="error-message">{error}</AlertDescription>
                </Alert>
              )}
              
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
                <Label htmlFor="websiteUrl" className="text-slate-700 flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  Website URL
                </Label>
                <Input
                  id="websiteUrl"
                  type="url"
                  placeholder="https://yourcompany.com"
                  value={websiteUrl}
                  onChange={(e) => setWebsiteUrl(e.target.value)}
                  className="bg-slate-50 border-slate-300 text-slate-900 placeholder:text-slate-400"
                  data-testid="input-website-url"
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
                <Label htmlFor="logoUrl" className="text-slate-700 flex items-center gap-2">
                  <Image className="h-4 w-4" />
                  Logo URL
                </Label>
                <Input
                  id="logoUrl"
                  type="url"
                  placeholder="https://example.com/logo.png"
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  className="bg-slate-50 border-slate-300 text-slate-900 placeholder:text-slate-400"
                  data-testid="input-logo-url"
                />
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
                  className="bg-slate-50 border-slate-300 text-slate-900 placeholder:text-slate-400 min-h-[100px]"
                  data-testid="input-about-us"
                />
              </div>

              <Button 
                type="submit" 
                className="w-full bg-deep-teal hover:bg-deep-teal/90 text-white mt-6"
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
      </div>

      <div className="hidden lg:flex flex-1 items-center justify-center bg-slate-800 p-8">
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
            
            <div className="p-6 space-y-4">
              <div>
                <h1 className="text-xl font-bold text-slate-800">{companyName || 'Company Name'}</h1>
                {websiteUrl && (
                  <p className="text-sm text-slate-500">{websiteUrl}</p>
                )}
              </div>
              
              <div className="border-t pt-4">
                <h2 className="text-sm font-semibold text-slate-700 mb-2">About Us</h2>
                <p className="text-sm text-slate-600 leading-relaxed">
                  {aboutUs || 'Your company description will appear here in bid documents...'}
                </p>
              </div>
              
              <div className="border-t pt-4">
                <h2 className="text-sm font-semibold text-slate-700 mb-2">Bid Proposal</h2>
                <div className="space-y-2">
                  <div className="h-3 bg-slate-200 rounded w-full"></div>
                  <div className="h-3 bg-slate-200 rounded w-4/5"></div>
                  <div className="h-3 bg-slate-200 rounded w-3/5"></div>
                </div>
              </div>
              
              <div 
                className="mt-6 py-2 text-center text-sm font-medium text-white rounded"
                style={{ backgroundColor: primaryColor }}
              >
                Proposal Prepared by {companyName || 'Your Company'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
