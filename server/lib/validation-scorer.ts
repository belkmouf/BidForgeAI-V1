import type { CompanyInfo, ProductService } from './website-fetcher.js';

export interface ValidationResult {
  field: string;
  value: string;
  isValid: boolean;
  confidence: number;
  issues: string[];
  suggestions?: string[];
}

export interface CompanyValidationReport {
  overallConfidence: number;
  overallScore: number;
  fieldResults: ValidationResult[];
  summary: {
    valid: number;
    invalid: number;
    total: number;
    highConfidence: number;
    mediumConfidence: number;
    lowConfidence: number;
  };
}

export class ValidationScorer {
  
  validateCompanyInfo(data: CompanyInfo): CompanyValidationReport {
    const fieldResults: ValidationResult[] = [];
    
    // Validate each field that has a value
    Object.entries(data).forEach(([field, value]) => {
      if (value && field !== 'confidence' && field !== 'validation') {
        if (typeof value === 'string') {
          const result = this.validateField(field, value, data);
          if (result) {
            fieldResults.push(result);
          }
        } else if (Array.isArray(value) && (field === 'products' || field === 'services')) {
          const result = this.validateProductsServices(field, value as ProductService[]);
          if (result) {
            fieldResults.push(result);
          }
        }
      }
    });

    // Calculate summary statistics
    const valid = fieldResults.filter(r => r.isValid).length;
    const invalid = fieldResults.filter(r => !r.isValid).length;
    const total = fieldResults.length;
    
    const highConfidence = fieldResults.filter(r => r.confidence >= 0.7).length;
    const mediumConfidence = fieldResults.filter(r => r.confidence >= 0.4 && r.confidence < 0.7).length;
    const lowConfidence = fieldResults.filter(r => r.confidence < 0.4).length;

    // Calculate overall confidence and score
    const avgConfidence = fieldResults.length > 0 
      ? fieldResults.reduce((sum, r) => sum + r.confidence, 0) / fieldResults.length 
      : 0;
    
    const overallScore = total > 0 ? (valid / total) * 100 : 0;

    return {
      overallConfidence: avgConfidence,
      overallScore,
      fieldResults,
      summary: {
        valid,
        invalid,
        total,
        highConfidence,
        mediumConfidence,
        lowConfidence
      }
    };
  }

  private validateField(field: string, value: string, context: CompanyInfo): ValidationResult | null {
    switch (field) {
      case 'name':
        return this.validateCompanyName(value);
      case 'email':
        return this.validateEmail(value);
      case 'phone':
        return this.validatePhone(value);
      case 'website':
        return this.validateWebsite(value);
      case 'linkedin':
        return this.validateLinkedIn(value);
      case 'twitter':
        return this.validateTwitter(value);
      case 'facebook':
        return this.validateFacebook(value);
      case 'instagram':
        return this.validateInstagram(value);
      case 'address':
        return this.validateAddress(value);
      case 'description':
        return this.validateDescription(value);
      case 'industry':
        return this.validateIndustry(value);
      default:
        return null;
    }
  }

  private validateCompanyName(name: string): ValidationResult {
    const issues: string[] = [];
    const suggestions: string[] = [];
    let confidence = 1.0;

    // Length checks
    if (name.length < 2) {
      issues.push('Company name is too short');
      confidence -= 0.5;
    }
    
    if (name.length > 100) {
      issues.push('Company name is unusually long');
      confidence -= 0.2;
      suggestions.push('Consider shortening the company name');
    }

    // Common patterns that reduce confidence
    if (/^(welcome to|home|about|contact)/i.test(name)) {
      issues.push('Name appears to contain website navigation text');
      confidence -= 0.4;
      suggestions.push('Remove navigation text from company name');
    }

    // Check for suspicious characters
    if (/[<>{}[\]]/.test(name)) {
      issues.push('Contains invalid characters');
      confidence -= 0.3;
    }

    // Check for common business suffixes
    if (/\b(inc|llc|ltd|corp|company|co\.|incorporated)\b/i.test(name)) {
      confidence += 0.1; // Slight boost for professional naming
    }

    return {
      field: 'name',
      value: name,
      isValid: issues.length === 0,
      confidence: Math.max(0, Math.min(1, confidence)),
      issues,
      suggestions
    };
  }

  private validateEmail(email: string): ValidationResult {
    const issues: string[] = [];
    const suggestions: string[] = [];
    let confidence = 1.0;

    // Basic email format validation
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    
    if (!emailRegex.test(email)) {
      issues.push('Invalid email format');
      confidence = 0;
    } else {
      // Check for business-like email patterns
      const domain = email.split('@')[1];
      const localPart = email.split('@')[0];

      // Boost confidence for business email patterns
      if (/^(info|contact|hello|support|sales|admin|office)$/i.test(localPart)) {
        confidence += 0.2;
      }

      // Reduce confidence for personal email patterns
      if (/^(test|example|demo|sample|noreply)$/i.test(localPart)) {
        issues.push('Appears to be a placeholder email');
        confidence -= 0.4;
      }

      // Check for common personal email providers
      const personalProviders = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com'];
      if (personalProviders.includes(domain)) {
        confidence -= 0.2;
        suggestions.push('Consider using a business email domain');
      }
    }

    return {
      field: 'email',
      value: email,
      isValid: issues.length === 0,
      confidence: Math.max(0, Math.min(1, confidence)),
      issues,
      suggestions
    };
  }

  private validatePhone(phone: string): ValidationResult {
    const issues: string[] = [];
    const suggestions: string[] = [];
    let confidence = 1.0;

    // Remove common formatting characters for validation
    const cleanPhone = phone.replace(/[\s\-\(\)\.\+]/g, '');

    // Check for reasonable phone number length
    if (cleanPhone.length < 10) {
      issues.push('Phone number appears to be too short');
      confidence -= 0.4;
    }
    
    if (cleanPhone.length > 15) {
      issues.push('Phone number appears to be too long');
      confidence -= 0.2;
    }

    // Check if it's all digits (after cleaning)
    if (!/^\+?\d+$/.test(cleanPhone)) {
      issues.push('Contains invalid characters for a phone number');
      confidence -= 0.3;
    }

    // Check for obvious fake numbers
    const fakePatterns = [
      /^(\d)\1+$/, // All same digit
      /^1234567890$/, // Sequential
      /^0000000000$/  // All zeros
    ];

    if (fakePatterns.some(pattern => pattern.test(cleanPhone))) {
      issues.push('Appears to be a placeholder phone number');
      confidence -= 0.5;
    }

    return {
      field: 'phone',
      value: phone,
      isValid: issues.length === 0,
      confidence: Math.max(0, Math.min(1, confidence)),
      issues,
      suggestions
    };
  }

  private validateWebsite(website: string): ValidationResult {
    const issues: string[] = [];
    const suggestions: string[] = [];
    let confidence = 1.0;

    try {
      const url = new URL(website);
      
      // Check for valid protocol
      if (!['http:', 'https:'].includes(url.protocol)) {
        issues.push('Invalid protocol (should be http or https)');
        confidence -= 0.3;
      }

      // Prefer HTTPS
      if (url.protocol === 'http:') {
        suggestions.push('Consider using HTTPS for better security');
        confidence -= 0.1;
      }

      // Check for suspicious TLDs
      const suspiciousTlds = ['.tk', '.ml', '.ga', '.cf'];
      if (suspiciousTlds.some(tld => url.hostname.endsWith(tld))) {
        issues.push('Uses a suspicious domain extension');
        confidence -= 0.3;
      }

      // Check for localhost or IP addresses
      if (url.hostname === 'localhost' || /^\d+\.\d+\.\d+\.\d+$/.test(url.hostname)) {
        issues.push('Appears to be a local or IP address');
        confidence -= 0.5;
      }

    } catch (error) {
      issues.push('Invalid URL format');
      confidence = 0;
    }

    return {
      field: 'website',
      value: website,
      isValid: issues.length === 0,
      confidence: Math.max(0, Math.min(1, confidence)),
      issues,
      suggestions
    };
  }

  private validateLinkedIn(linkedin: string): ValidationResult {
    return this.validateSocialUrl(linkedin, 'linkedin', ['linkedin.com'], '/company/');
  }

  private validateTwitter(twitter: string): ValidationResult {
    return this.validateSocialUrl(twitter, 'twitter', ['twitter.com', 'x.com']);
  }

  private validateFacebook(facebook: string): ValidationResult {
    return this.validateSocialUrl(facebook, 'facebook', ['facebook.com', 'fb.com']);
  }

  private validateInstagram(instagram: string): ValidationResult {
    return this.validateSocialUrl(instagram, 'instagram', ['instagram.com']);
  }

  private validateSocialUrl(url: string, platform: string, validDomains: string[], preferredPath?: string): ValidationResult {
    const issues: string[] = [];
    const suggestions: string[] = [];
    let confidence = 1.0;

    try {
      const urlObj = new URL(url);
      
      // Check if domain matches
      const isValidDomain = validDomains.some(domain => urlObj.hostname.includes(domain));
      if (!isValidDomain) {
        issues.push(`Not a valid ${platform} URL`);
        confidence = 0;
      } else {
        // Boost confidence if it matches preferred path (e.g., company pages)
        if (preferredPath && urlObj.pathname.includes(preferredPath)) {
          confidence += 0.2;
        }

        // Check for tracking parameters (reduces confidence)
        if (urlObj.search) {
          confidence -= 0.1;
          suggestions.push('Remove tracking parameters for cleaner URL');
        }
      }

    } catch (error) {
      issues.push('Invalid URL format');
      confidence = 0;
    }

    return {
      field: platform,
      value: url,
      isValid: issues.length === 0,
      confidence: Math.max(0, Math.min(1, confidence)),
      issues,
      suggestions
    };
  }

  private validateAddress(address: string): ValidationResult {
    const issues: string[] = [];
    const suggestions: string[] = [];
    let confidence = 0.8; // Start with good confidence for addresses

    // Length checks
    if (address.length < 10) {
      issues.push('Address appears to be too short');
      confidence -= 0.3;
    }

    // Check for common address components
    const hasNumber = /\d/.test(address);
    const hasStreetWords = /\b(street|st|avenue|ave|road|rd|drive|dr|lane|ln|blvd|boulevard)\b/i.test(address);
    const hasStateOrProvince = /\b[A-Z]{2}\b/.test(address);

    if (hasNumber) confidence += 0.1;
    if (hasStreetWords) confidence += 0.1;
    if (hasStateOrProvince) confidence += 0.1;

    // Check for placeholder text
    if (/placeholder|example|sample|test/i.test(address)) {
      issues.push('Appears to be placeholder text');
      confidence -= 0.5;
    }

    return {
      field: 'address',
      value: address,
      isValid: issues.length === 0,
      confidence: Math.max(0, Math.min(1, confidence)),
      issues,
      suggestions
    };
  }

  private validateDescription(description: string): ValidationResult {
    const issues: string[] = [];
    const suggestions: string[] = [];
    let confidence = 0.8;

    // Length checks
    if (description.length < 20) {
      issues.push('Description is very short');
      confidence -= 0.2;
    }

    if (description.length > 1000) {
      suggestions.push('Description is quite long, consider shortening');
      confidence -= 0.1;
    }

    // Check for placeholder text
    if (/lorem ipsum|placeholder|example|sample|test|todo|coming soon/i.test(description)) {
      issues.push('Contains placeholder text');
      confidence -= 0.4;
    }

    // Check for business-related keywords (boosts confidence)
    const businessKeywords = ['company', 'service', 'business', 'solution', 'client', 'customer', 'professional', 'industry'];
    const hasBusinessKeywords = businessKeywords.some(keyword => 
      description.toLowerCase().includes(keyword)
    );

    if (hasBusinessKeywords) {
      confidence += 0.1;
    }

    return {
      field: 'description',
      value: description,
      isValid: issues.length === 0,
      confidence: Math.max(0, Math.min(1, confidence)),
      issues,
      suggestions
    };
  }

  private validateIndustry(industry: string): ValidationResult {
    const issues: string[] = [];
    const suggestions: string[] = [];
    let confidence = 0.8;

    // Common industries list for validation
    const knownIndustries = [
      'construction', 'technology', 'healthcare', 'finance', 'retail', 'manufacturing',
      'education', 'transportation', 'real estate', 'consulting', 'marketing',
      'agriculture', 'energy', 'telecommunications', 'hospitality', 'legal',
      'automotive', 'aerospace', 'pharmaceuticals', 'biotechnology', 'media',
      'entertainment', 'non-profit', 'government', 'insurance', 'banking'
    ];

    const lowerIndustry = industry.toLowerCase();
    const isKnownIndustry = knownIndustries.some(known => 
      lowerIndustry.includes(known) || known.includes(lowerIndustry)
    );

    if (isKnownIndustry) {
      confidence += 0.2;
    } else {
      confidence -= 0.2;
      suggestions.push('Industry may be too specific or uncommon');
    }

    // Length checks
    if (industry.length < 3) {
      issues.push('Industry name is too short');
      confidence -= 0.3;
    }

    if (industry.length > 50) {
      suggestions.push('Industry name is quite long');
      confidence -= 0.1;
    }

    return {
      field: 'industry',
      value: industry,
      isValid: issues.length === 0,
      confidence: Math.max(0, Math.min(1, confidence)),
      issues,
      suggestions
    };
  }

  private validateProductsServices(field: string, items: ProductService[]): ValidationResult {
    const issues: string[] = [];
    const suggestions: string[] = [];
    let confidence = 0.8; // Start with good base confidence

    if (items.length === 0) {
      issues.push('No items found');
      confidence = 0;
    } else {
      // Validate individual items
      let validItems = 0;
      let duplicateNames = 0;
      const seenNames = new Set<string>();

      items.forEach(item => {
        // Check for valid name
        if (!item.name || item.name.length < 2) {
          issues.push('Some items have invalid names');
          confidence -= 0.1;
        } else {
          validItems++;
        }

        // Check for duplicates
        const normalizedName = item.name.toLowerCase().trim();
        if (seenNames.has(normalizedName)) {
          duplicateNames++;
        } else {
          seenNames.add(normalizedName);
        }

        // Check for overly generic names
        const genericPatterns = /^(product|service|item|offering|solution)\s*\d*$/i;
        if (genericPatterns.test(item.name)) {
          confidence -= 0.05;
        }

        // Boost confidence for items with descriptions
        if (item.description && item.description.length > 10) {
          confidence += 0.05;
        }

        // Check type consistency
        if (field === 'products' && item.type !== 'product') {
          issues.push('Type inconsistency detected');
          confidence -= 0.1;
        }
        if (field === 'services' && item.type !== 'service') {
          issues.push('Type inconsistency detected');
          confidence -= 0.1;
        }
      });

      // Handle duplicates
      if (duplicateNames > 0) {
        issues.push(`${duplicateNames} duplicate items found`);
        suggestions.push('Remove duplicate items');
        confidence -= duplicateNames * 0.05;
      }

      // Check quantity appropriateness
      if (items.length > 50) {
        issues.push('Unusually large number of items');
        suggestions.push('Consider grouping items into categories');
        confidence -= 0.2;
      } else if (items.length > 20) {
        suggestions.push('Consider organizing items into categories');
        confidence -= 0.1;
      }

      // Boost confidence for reasonable number of items
      if (items.length >= 3 && items.length <= 15) {
        confidence += 0.1;
      }

      // Check for business relevance
      const businessKeywords = ['professional', 'commercial', 'industrial', 'enterprise', 'business'];
      const hasBusinessTerms = items.some(item => 
        businessKeywords.some(keyword => 
          item.name.toLowerCase().includes(keyword) || 
          (item.description && item.description.toLowerCase().includes(keyword))
        )
      );

      if (hasBusinessTerms) {
        confidence += 0.1;
      }
    }

    const itemCountStr = `${items.length} ${field}`;

    return {
      field,
      value: itemCountStr,
      isValid: issues.length === 0,
      confidence: Math.max(0, Math.min(1, confidence)),
      issues,
      suggestions
    };
  }
}

export const validationScorer = new ValidationScorer();