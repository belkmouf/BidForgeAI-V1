import { useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { WebsiteAutoFill } from './website-auto-fill';
import { useToast } from '@/hooks/use-toast';
import { Building, Sparkles, UserPlus, Save, CheckCircle, AlertTriangle, AlertCircle } from 'lucide-react';

const companySchema = z.object({
  name: z.string().min(2, 'Company name must be at least 2 characters'),
  description: z.string().optional(),
  website: z.string().url('Please enter a valid website URL').optional().or(z.literal('')),
  email: z.string().email('Please enter a valid email address').optional().or(z.literal('')),
  phone: z.string().optional(),
  address: z.string().optional(),
  industry: z.string().optional(),
  linkedin: z.string().url('Please enter a valid LinkedIn URL').optional().or(z.literal('')),
  twitter: z.string().url('Please enter a valid Twitter URL').optional().or(z.literal('')),
  facebook: z.string().url('Please enter a valid Facebook URL').optional().or(z.literal('')),
  instagram: z.string().url('Please enter a valid Instagram URL').optional().or(z.literal('')),
});

type CompanyFormData = z.infer<typeof companySchema>;

interface CompanyOnboardingFormProps {
  onSubmit: (data: CompanyFormData) => Promise<void>;
  isLoading?: boolean;
  initialData?: Partial<CompanyFormData>;
}

export function CompanyOnboardingForm({
  onSubmit,
  isLoading = false,
  initialData = {}
}: CompanyOnboardingFormProps) {
  const [showAutoFill, setShowAutoFill] = useState(false);
  const [autoFilledFields, setAutoFilledFields] = useState<Set<string>>(new Set());
  const [showValidationErrors, setShowValidationErrors] = useState(false);
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isDirty, isValid }
  } = useForm<CompanyFormData>({
    resolver: zodResolver(companySchema),
    defaultValues: initialData,
    mode: 'onBlur'
  });

  const watchedValues = watch();

  const handleAutoFillData = useCallback((extractedData: Partial<CompanyFormData>) => {
    const fieldsSet = new Set<string>();

    Object.entries(extractedData).forEach(([key, value]) => {
      if (value && typeof value === 'string' && value.trim()) {
        setValue(key as keyof CompanyFormData, value, { 
          shouldDirty: true, 
          shouldValidate: true 
        });
        fieldsSet.add(key);
      }
    });

    setAutoFilledFields(fieldsSet);
    setShowAutoFill(false);

    toast({
      title: "Information Applied",
      description: `Successfully auto-filled ${fieldsSet.size} fields from website data.`,
      variant: "default",
    });
  }, [setValue, toast]);

  const getFieldStatus = (fieldName: string) => {
    if (autoFilledFields.has(fieldName)) {
      return 'auto-filled';
    }
    if (errors[fieldName as keyof CompanyFormData]) {
      return 'error';
    }
    if (watchedValues[fieldName as keyof CompanyFormData]) {
      return 'filled';
    }
    return 'empty';
  };

  const getFieldIcon = (status: string) => {
    switch (status) {
      case 'auto-filled':
        return <Sparkles className="h-4 w-4 text-blue-500" />;
      case 'error':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case 'filled':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      default:
        return null;
    }
  };

  const handleFormSubmit = async (data: CompanyFormData) => {
    if (Object.keys(errors).length > 0) {
      setShowValidationErrors(true);
      return;
    }
    try {
      await onSubmit(data);
    } catch (error: any) {
      toast({
        title: "Submission Failed",
        description: error.message || "An error occurred while saving company information.",
        variant: "destructive",
      });
    }
  };

  const errorsList = Object.entries(errors).map(([field, error]) => {
    const fieldName = field.charAt(0).toUpperCase() + field.slice(1).replace(/([A-Z])/g, ' $1');
    let message = error?.message || 'Invalid value';
    
    // Format message for clarity
    if (!message || message === 'Invalid value') {
      message = `${fieldName} is invalid`;
    }
    
    return { field: fieldName, message };
  });

  if (showAutoFill) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <WebsiteAutoFill
          onDataExtracted={handleAutoFillData}
          onCancel={() => setShowAutoFill(false)}
          disabled={isLoading}
          initialWebsite={watchedValues.website || ''}
        />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Building className="h-6 w-6 text-blue-600" />
              <div>
                <CardTitle className="text-2xl">Company Information</CardTitle>
                <CardDescription>
                  Set up your company profile to get started with BidForge AI
                </CardDescription>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowAutoFill(true)}
              disabled={isLoading}
              className="shrink-0"
            >
              <Sparkles className="mr-2 h-4 w-4" />
              Auto-Fill from Website
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
            <Tabs defaultValue="basic" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="basic">Basic Info</TabsTrigger>
                <TabsTrigger value="contact">Contact Details</TabsTrigger>
                <TabsTrigger value="social">Social Media</TabsTrigger>
              </TabsList>

              <TabsContent value="basic" className="space-y-4 mt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Label htmlFor="name">Company Name *</Label>
                      {getFieldIcon(getFieldStatus('name'))}
                    </div>
                    <Input
                      id="name"
                      {...register('name')}
                      placeholder="Enter company name"
                      disabled={isLoading}
                      className={autoFilledFields.has('name') ? 'ring-2 ring-blue-200' : ''}
                    />
                    {errors.name && (
                      <p className="text-sm text-red-600">{errors.name.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Label htmlFor="industry">Industry</Label>
                      {getFieldIcon(getFieldStatus('industry'))}
                    </div>
                    <Input
                      id="industry"
                      {...register('industry')}
                      placeholder="e.g., Construction, Technology"
                      disabled={isLoading}
                      className={autoFilledFields.has('industry') ? 'ring-2 ring-blue-200' : ''}
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <div className="flex items-center space-x-2">
                      <Label htmlFor="description">Company Description</Label>
                      {getFieldIcon(getFieldStatus('description'))}
                    </div>
                    <Textarea
                      id="description"
                      {...register('description')}
                      placeholder="Brief description of your company and services"
                      rows={3}
                      disabled={isLoading}
                      className={autoFilledFields.has('description') ? 'ring-2 ring-blue-200' : ''}
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <div className="flex items-center space-x-2">
                      <Label htmlFor="website">Website</Label>
                      {getFieldIcon(getFieldStatus('website'))}
                    </div>
                    <Input
                      id="website"
                      type="url"
                      {...register('website')}
                      placeholder="https://your-company.com"
                      disabled={isLoading}
                      className={autoFilledFields.has('website') ? 'ring-2 ring-blue-200' : ''}
                    />
                    {errors.website && (
                      <p className="text-sm text-red-600">{errors.website.message}</p>
                    )}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="contact" className="space-y-4 mt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Label htmlFor="email">Business Email</Label>
                      {getFieldIcon(getFieldStatus('email'))}
                    </div>
                    <Input
                      id="email"
                      type="email"
                      {...register('email')}
                      placeholder="contact@company.com"
                      disabled={isLoading}
                      className={autoFilledFields.has('email') ? 'ring-2 ring-blue-200' : ''}
                    />
                    {errors.email && (
                      <p className="text-sm text-red-600">{errors.email.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Label htmlFor="phone">Phone Number</Label>
                      {getFieldIcon(getFieldStatus('phone'))}
                    </div>
                    <Input
                      id="phone"
                      type="tel"
                      {...register('phone')}
                      placeholder="(555) 123-4567"
                      disabled={isLoading}
                      className={autoFilledFields.has('phone') ? 'ring-2 ring-blue-200' : ''}
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <div className="flex items-center space-x-2">
                      <Label htmlFor="address">Business Address</Label>
                      {getFieldIcon(getFieldStatus('address'))}
                    </div>
                    <Textarea
                      id="address"
                      {...register('address')}
                      placeholder="Street address, city, state, zip code"
                      rows={2}
                      disabled={isLoading}
                      className={autoFilledFields.has('address') ? 'ring-2 ring-blue-200' : ''}
                    />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="social" className="space-y-4 mt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Label htmlFor="linkedin">LinkedIn</Label>
                      {getFieldIcon(getFieldStatus('linkedin'))}
                    </div>
                    <Input
                      id="linkedin"
                      type="url"
                      {...register('linkedin')}
                      placeholder="https://linkedin.com/company/your-company"
                      disabled={isLoading}
                      className={autoFilledFields.has('linkedin') ? 'ring-2 ring-blue-200' : ''}
                    />
                    {errors.linkedin && (
                      <p className="text-sm text-red-600">{errors.linkedin.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Label htmlFor="twitter">Twitter</Label>
                      {getFieldIcon(getFieldStatus('twitter'))}
                    </div>
                    <Input
                      id="twitter"
                      type="url"
                      {...register('twitter')}
                      placeholder="https://twitter.com/your-company"
                      disabled={isLoading}
                      className={autoFilledFields.has('twitter') ? 'ring-2 ring-blue-200' : ''}
                    />
                    {errors.twitter && (
                      <p className="text-sm text-red-600">{errors.twitter.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Label htmlFor="facebook">Facebook</Label>
                      {getFieldIcon(getFieldStatus('facebook'))}
                    </div>
                    <Input
                      id="facebook"
                      type="url"
                      {...register('facebook')}
                      placeholder="https://facebook.com/your-company"
                      disabled={isLoading}
                      className={autoFilledFields.has('facebook') ? 'ring-2 ring-blue-200' : ''}
                    />
                    {errors.facebook && (
                      <p className="text-sm text-red-600">{errors.facebook.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Label htmlFor="instagram">Instagram</Label>
                      {getFieldIcon(getFieldStatus('instagram'))}
                    </div>
                    <Input
                      id="instagram"
                      type="url"
                      {...register('instagram')}
                      placeholder="https://instagram.com/your-company"
                      disabled={isLoading}
                      className={autoFilledFields.has('instagram') ? 'ring-2 ring-blue-200' : ''}
                    />
                    {errors.instagram && (
                      <p className="text-sm text-red-600">{errors.instagram.message}</p>
                    )}
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            {autoFilledFields.size > 0 && (
              <Alert>
                <Sparkles className="h-4 w-4" />
                <AlertDescription>
                  {autoFilledFields.size} fields were auto-filled from website data. 
                  Review and modify as needed before saving.
                </AlertDescription>
              </Alert>
            )}

            <div className="flex justify-between pt-6 border-t">
              <div className="text-sm text-muted-foreground">
                * Required fields
              </div>
              <Button
                type="submit"
                disabled={isLoading || !isDirty || !isValid}
                className="min-w-32"
              >
                {isLoading ? (
                  <>
                    <Save className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save Company Info
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Validation Error Dialog */}
      <Dialog open={showValidationErrors} onOpenChange={setShowValidationErrors}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertCircle className="h-5 w-5" />
              Validation Failed
            </DialogTitle>
            <DialogDescription>
              Please fix the following errors before submitting:
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {errorsList.map((error, idx) => (
              <div key={idx} className="flex items-start gap-3 p-2 rounded-lg bg-red-50 border border-red-200">
                <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-sm text-red-900">{error.field}</p>
                  <p className="text-xs text-red-700">{error.message}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button onClick={() => setShowValidationErrors(false)} variant="outline">
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
