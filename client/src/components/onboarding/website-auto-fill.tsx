import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Globe, CheckCircle, AlertTriangle, ExternalLink, Sparkles } from 'lucide-react';

interface ProductService {
  name: string;
  description?: string;
  category?: string;
  type: 'product' | 'service';
}

interface CompanyInfo {
  name?: string;
  description?: string;
  website?: string;
  email?: string;
  phone?: string;
  address?: string;
  industry?: string;
  linkedin?: string;
  twitter?: string;
  facebook?: string;
  instagram?: string;
  youtube?: string;
  logo?: string;
  products?: ProductService[];
  services?: ProductService[];
  confidence: number;
}

interface WebsiteAutoFillProps {
  onDataExtracted: (data: Partial<CompanyInfo>) => void;
  onCancel?: () => void;
  disabled?: boolean;
  initialWebsite?: string;
}

export function WebsiteAutoFill({ 
  onDataExtracted, 
  onCancel, 
  disabled = false,
  initialWebsite = ''
}: WebsiteAutoFillProps) {
  const [website, setWebsite] = useState(initialWebsite);
  const [isLoading, setIsLoading] = useState(false);
  const [extractedData, setExtractedData] = useState<CompanyInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchWebsiteInfo = useCallback(async () => {
    if (!website.trim()) {
      toast({
        title: "Website Required",
        description: "Please enter a website URL to extract information.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/website-info/fetch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          website: website.trim(),
          useCache: true
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (result.success) {
        setExtractedData(result.data);
        
        if (result.data.confidence < 0.3) {
          toast({
            title: "Low Confidence",
            description: "We found some information, but please verify the accuracy.",
            variant: "default",
          });
        } else {
          toast({
            title: "Information Extracted",
            description: `Successfully extracted company information with ${Math.round(result.data.confidence * 100)}% confidence.`,
            variant: "default",
          });
        }
      } else {
        throw new Error(result.error || 'Failed to fetch website information');
      }
    } catch (err: any) {
      console.error('Error fetching website info:', err);
      setError(err.message || 'An unexpected error occurred');
      toast({
        title: "Extraction Failed",
        description: "Could not extract information from the website. Please try again or fill manually.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [website, toast]);

  const handleApplyData = useCallback(() => {
    if (!extractedData) return;
    
    // Filter out undefined values and the confidence score
    const cleanData = Object.entries(extractedData)
      .filter(([key, value]) => key !== 'confidence' && value !== undefined && value !== '')
      .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {});

    onDataExtracted(cleanData);
    
    toast({
      title: "Data Applied",
      description: "Company information has been applied to the form.",
      variant: "default",
    });
  }, [extractedData, onDataExtracted, toast]);

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.7) return 'bg-green-500';
    if (confidence >= 0.4) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getConfidenceText = (confidence: number) => {
    if (confidence >= 0.7) return 'High';
    if (confidence >= 0.4) return 'Medium';
    return 'Low';
  };

  const formatFieldValue = (value: string | undefined, maxLength = 100) => {
    if (!value) return '-';
    return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <div className="flex items-center space-x-2">
          <Sparkles className="h-5 w-5 text-blue-600" />
          <CardTitle>Auto-Fill Company Information</CardTitle>
        </div>
        <CardDescription>
          Enter your company website to automatically extract and populate company information.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="website">Company Website</Label>
          <div className="flex space-x-2">
            <div className="relative flex-1">
              <Globe className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="website"
                type="url"
                placeholder="https://example.com"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                className="pl-10"
                disabled={disabled || isLoading}
                onKeyDown={(e) => e.key === 'Enter' && fetchWebsiteInfo()}
              />
            </div>
            <Button 
              onClick={fetchWebsiteInfo}
              disabled={disabled || isLoading || !website.trim()}
              className="shrink-0"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Extracting...
                </>
              ) : (
                'Extract Info'
              )}
            </Button>
          </div>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {extractedData && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Extracted Information</h3>
              <Badge 
                variant="secondary" 
                className={`text-white ${getConfidenceColor(extractedData.confidence)}`}
              >
                {getConfidenceText(extractedData.confidence)} Confidence ({Math.round(extractedData.confidence * 100)}%)
              </Badge>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {extractedData.name && (
                <div className="space-y-1">
                  <Label className="text-sm font-medium">Company Name</Label>
                  <p className="text-sm text-muted-foreground">{extractedData.name}</p>
                </div>
              )}

              {extractedData.description && (
                <div className="space-y-1 md:col-span-2">
                  <Label className="text-sm font-medium">Description</Label>
                  <p className="text-sm text-muted-foreground">{formatFieldValue(extractedData.description, 200)}</p>
                </div>
              )}

              {extractedData.industry && (
                <div className="space-y-1">
                  <Label className="text-sm font-medium">Industry</Label>
                  <p className="text-sm text-muted-foreground">{extractedData.industry}</p>
                </div>
              )}

              {extractedData.email && (
                <div className="space-y-1">
                  <Label className="text-sm font-medium">Email</Label>
                  <p className="text-sm text-muted-foreground">{extractedData.email}</p>
                </div>
              )}

              {extractedData.phone && (
                <div className="space-y-1">
                  <Label className="text-sm font-medium">Phone</Label>
                  <p className="text-sm text-muted-foreground">{extractedData.phone}</p>
                </div>
              )}

              {extractedData.address && (
                <div className="space-y-1 md:col-span-2">
                  <Label className="text-sm font-medium">Address</Label>
                  <p className="text-sm text-muted-foreground">{formatFieldValue(extractedData.address, 150)}</p>
                </div>
              )}

              {(extractedData.linkedin || extractedData.twitter || extractedData.facebook) && (
                <div className="space-y-1 md:col-span-2">
                  <Label className="text-sm font-medium">Social Media</Label>
                  <div className="flex flex-wrap gap-2">
                    {extractedData.linkedin && (
                      <Badge variant="outline">
                        <ExternalLink className="mr-1 h-3 w-3" />
                        LinkedIn
                      </Badge>
                    )}
                    {extractedData.twitter && (
                      <Badge variant="outline">
                        <ExternalLink className="mr-1 h-3 w-3" />
                        Twitter
                      </Badge>
                    )}
                    {extractedData.facebook && (
                      <Badge variant="outline">
                        <ExternalLink className="mr-1 h-3 w-3" />
                        Facebook
                      </Badge>
                    )}
                    {extractedData.instagram && (
                      <Badge variant="outline">
                        <ExternalLink className="mr-1 h-3 w-3" />
                        Instagram
                      </Badge>
                    )}
                  </div>
                </div>
              )}

              {extractedData.products && extractedData.products.length > 0 && (
                <div className="space-y-1 md:col-span-2">
                  <Label className="text-sm font-medium">
                    Products ({extractedData.products.length})
                  </Label>
                  <div className="max-h-32 overflow-y-auto">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {extractedData.products.slice(0, 10).map((product, index) => (
                        <div key={index} className="p-2 border rounded-md bg-blue-50">
                          <p className="text-sm font-medium text-blue-900">{product.name}</p>
                          {product.description && (
                            <p className="text-xs text-blue-700 mt-1">
                              {formatFieldValue(product.description, 80)}
                            </p>
                          )}
                          {product.category && (
                            <Badge variant="secondary" className="text-xs mt-1">
                              {product.category}
                            </Badge>
                          )}
                        </div>
                      ))}
                    </div>
                    {extractedData.products.length > 10 && (
                      <p className="text-xs text-muted-foreground mt-2">
                        +{extractedData.products.length - 10} more products
                      </p>
                    )}
                  </div>
                </div>
              )}

              {extractedData.services && extractedData.services.length > 0 && (
                <div className="space-y-1 md:col-span-2">
                  <Label className="text-sm font-medium">
                    Services ({extractedData.services.length})
                  </Label>
                  <div className="max-h-32 overflow-y-auto">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {extractedData.services.slice(0, 10).map((service, index) => (
                        <div key={index} className="p-2 border rounded-md bg-green-50">
                          <p className="text-sm font-medium text-green-900">{service.name}</p>
                          {service.description && (
                            <p className="text-xs text-green-700 mt-1">
                              {formatFieldValue(service.description, 80)}
                            </p>
                          )}
                          {service.category && (
                            <Badge variant="secondary" className="text-xs mt-1">
                              {service.category}
                            </Badge>
                          )}
                        </div>
                      ))}
                    </div>
                    {extractedData.services.length > 10 && (
                      <p className="text-xs text-muted-foreground mt-2">
                        +{extractedData.services.length - 10} more services
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {extractedData.confidence < 0.3 && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  The confidence score is low. Please review and verify the extracted information before applying it.
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}
      </CardContent>

      <CardFooter className="flex justify-between">
        <div className="flex space-x-2">
          {onCancel && (
            <Button variant="outline" onClick={onCancel} disabled={disabled || isLoading}>
              Cancel
            </Button>
          )}
        </div>
        {extractedData && (
          <Button onClick={handleApplyData} disabled={disabled || isLoading}>
            <CheckCircle className="mr-2 h-4 w-4" />
            Apply to Form
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}