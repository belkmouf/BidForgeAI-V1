import axios from 'axios';
import * as cheerio from 'cheerio';
import { cache } from './cache.js';
import { logger, logContext } from './logger.js';
import { validationScorer, type CompanyValidationReport } from './validation-scorer.js';

export interface ProductService {
  name: string;
  description?: string;
  category?: string;
  type: 'product' | 'service';
}

export interface CompanyInfo {
  name?: string;
  description?: string;
  fullAboutContent?: string; // Full multi-paragraph about content
  website?: string;
  email?: string;
  phone?: string;
  address?: string;
  industry?: string;
  size?: string;
  founded?: string;
  linkedin?: string;
  twitter?: string;
  facebook?: string;
  instagram?: string;
  youtube?: string;
  logo?: string;
  products?: ProductService[];
  services?: ProductService[];
  confidence: number;
  validation?: CompanyValidationReport;
}

export interface FetchOptions {
  timeout?: number;
  useCache?: boolean;
  followRedirects?: boolean;
  userAgent?: string;
}

export class WebsiteFetcher {
  private readonly defaultTimeout = 10000;
  private readonly defaultUserAgent = 'BidForge AI Bot 1.0';
  private readonly rateLimitDelay = 1000; // 1 second between requests
  private readonly requestCounts = new Map<string, { count: number; resetTime: number }>();
  private readonly maxRequestsPerHour = 100;
  private lastRequestTime = 0;

  async fetchCompanyInfo(website: string, options: FetchOptions = {}): Promise<CompanyInfo> {
    const startTime = Date.now();
    const normalizedUrl = this.normalizeUrl(website);
    
    try {
      // Check cache first
      if (options.useCache !== false) {
        const cached = await this.getCachedInfo(normalizedUrl);
        if (cached) {
          logContext.system('Website info retrieved from cache', {
            event: 'website_fetch_cache_hit',
            severity: 'low',
            metadata: { url: normalizedUrl, duration: Date.now() - startTime }
          });
          return cached;
        }
      }

      // Enhanced rate limiting
      await this.enforceRateLimit(normalizedUrl);

      // Fetch website content
      const htmlContent = await this.fetchHtml(normalizedUrl, options);
      
      // Extract company information
      const companyInfo = await this.extractCompanyInfo(htmlContent, normalizedUrl);
      
      // Cache the result
      if (options.useCache !== false && companyInfo.confidence > 0.3) {
        await this.cacheInfo(normalizedUrl, companyInfo);
      }

      const duration = Date.now() - startTime;
      
      logContext.system('Website info fetched successfully', {
        event: 'website_fetch_success',
        severity: 'low',
        metadata: {
          url: normalizedUrl,
          confidence: companyInfo.confidence,
          duration,
          fieldsExtracted: Object.keys(companyInfo).filter(k => companyInfo[k as keyof CompanyInfo]).length
        }
      });

      return companyInfo;

    } catch (error: any) {
      const duration = Date.now() - startTime;
      
      logContext.system('Website fetch failed', {
        event: 'website_fetch_failed',
        severity: 'medium',
        metadata: {
          url: normalizedUrl,
          error: error.message,
          duration
        }
      });

      // Return basic info with low confidence
      return {
        website: normalizedUrl,
        confidence: 0.1
      };
    }
  }

  private async fetchHtml(url: string, options: FetchOptions): Promise<string> {
    const config = {
      timeout: options.timeout || this.defaultTimeout,
      headers: {
        'User-Agent': options.userAgent || this.defaultUserAgent,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        'DNT': '1',
        'Connection': 'keep-alive',
      },
      maxRedirects: options.followRedirects === false ? 0 : 5,
      validateStatus: (status: number) => status >= 200 && status < 400
    };

    try {
      const response = await axios.get(url, config);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 403 || error.response?.status === 429) {
        // Try with different user agent
        config.headers['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
        const retryResponse = await axios.get(url, config);
        return retryResponse.data;
      }
      throw error;
    }
  }

  private async extractCompanyInfo(html: string, url: string): Promise<CompanyInfo> {
    const $ = cheerio.load(html);
    const info: Partial<CompanyInfo> = { website: url };
    let confidenceScore = 0;

    // Extract title and description
    const title = $('title').text().trim();
    const metaDescription = $('meta[name="description"]').attr('content')?.trim();
    const ogTitle = $('meta[property="og:title"]').attr('content')?.trim();
    const ogDescription = $('meta[property="og:description"]').attr('content')?.trim();

    // Company name extraction
    info.name = this.extractCompanyName($, title, url);
    if (info.name) confidenceScore += 0.3;

    // Description extraction (short version for meta/preview)
    info.description = metaDescription || ogDescription || this.extractDescriptionFromContent($);
    if (info.description) confidenceScore += 0.2;

    // Full About content extraction (multi-paragraph for RAG)
    info.fullAboutContent = this.extractFullAboutContent($);
    if (info.fullAboutContent && info.fullAboutContent.length > 200) {
      confidenceScore += 0.15; // Bonus for comprehensive about content
    }

    // Contact information
    const contactInfo = this.extractContactInfo($);
    Object.assign(info, contactInfo);
    if (contactInfo.email) confidenceScore += 0.2;
    if (contactInfo.phone) confidenceScore += 0.1;
    if (contactInfo.address) confidenceScore += 0.1;

    // Social media links
    const socialInfo = this.extractSocialMedia($);
    Object.assign(info, socialInfo);
    if (socialInfo.linkedin) confidenceScore += 0.1;

    // Logo extraction
    info.logo = this.extractLogo($, url);
    if (info.logo) confidenceScore += 0.1;

    // Industry and company details
    const companyDetails = this.extractCompanyDetails($);
    Object.assign(info, companyDetails);
    if (companyDetails.industry) confidenceScore += 0.1;

    // Products and services extraction
    const productsServices = this.extractProductsAndServices($, url);
    if (productsServices.products && productsServices.products.length > 0) {
      info.products = productsServices.products;
      confidenceScore += Math.min(productsServices.products.length * 0.05, 0.2);
    }
    if (productsServices.services && productsServices.services.length > 0) {
      info.services = productsServices.services;
      confidenceScore += Math.min(productsServices.services.length * 0.05, 0.2);
    }

    const companyInfo = {
      ...info,
      confidence: Math.min(confidenceScore, 1.0)
    } as CompanyInfo;

    // Run validation scoring
    const validationReport = validationScorer.validateCompanyInfo(companyInfo);
    
    // Adjust confidence based on validation results
    const adjustedConfidence = (companyInfo.confidence * 0.7) + (validationReport.overallConfidence * 0.3);
    
    return {
      ...companyInfo,
      confidence: adjustedConfidence,
      validation: validationReport
    };
  }

  private extractCompanyName($: cheerio.CheerioAPI, title: string, url: string): string | undefined {
    // Try structured data first
    const jsonLd = $('script[type="application/ld+json"]').text();
    if (jsonLd) {
      try {
        const data = JSON.parse(jsonLd);
        if (data.name || data.legalName) {
          return data.name || data.legalName;
        }
      } catch {}
    }

    // Try OpenGraph
    const ogSiteName = $('meta[property="og:site_name"]').attr('content');
    if (ogSiteName) return ogSiteName.trim();

    // Extract from title, removing common suffixes
    const cleanTitle = title
      .replace(/\s*[\|\-\–\—]\s*(Home|Welcome|Official Website|Inc|LLC|Corp|Ltd).*$/i, '')
      .replace(/^(Welcome to|Home of)\s+/i, '')
      .trim();

    if (cleanTitle && cleanTitle.length > 2 && cleanTitle.length < 100) {
      return cleanTitle;
    }

    // Fallback to domain name
    try {
      const domain = new URL(url).hostname;
      return domain.replace(/^www\./, '').replace(/\.[^.]+$/, '');
    } catch {
      return undefined;
    }
  }

  private extractContactInfo($: cheerio.CheerioAPI): Partial<CompanyInfo> {
    const info: Partial<CompanyInfo> = {};

    // Email extraction
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const emailLinks = $('a[href^="mailto:"]').map((_, el) => $(el).attr('href')?.replace('mailto:', '')).get();
    const textEmails = $.html().match(emailRegex) || [];
    const allEmails = [...emailLinks, ...textEmails].filter(Boolean);
    
    if (allEmails.length > 0) {
      // Prefer contact/info emails over personal ones
      const preferredEmail = allEmails.find(email => 
        /^(info|contact|hello|support|sales)@/.test(email)
      ) || allEmails[0];
      info.email = preferredEmail;
    }

    // Phone extraction
    const phoneRegex = /(?:\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})/g;
    const phoneLinks = $('a[href^="tel:"]').map((_, el) => $(el).text()).get();
    const textPhones = $.html().match(phoneRegex) || [];
    const allPhones = [...phoneLinks, ...textPhones].filter(Boolean);
    
    if (allPhones.length > 0) {
      info.phone = allPhones[0].replace(/[^\d+\-\(\)\s]/g, '').trim();
    }

    // Address extraction (basic)
    const addressSelectors = [
      '[itemtype*="PostalAddress"]',
      '.address',
      '.contact-address',
      '.location'
    ];
    
    for (const selector of addressSelectors) {
      const addressEl = $(selector).first();
      if (addressEl.length > 0) {
        const addressText = addressEl.text().trim();
        if (addressText.length > 10 && addressText.length < 200) {
          info.address = addressText;
          break;
        }
      }
    }

    return info;
  }

  private extractSocialMedia($: cheerio.CheerioAPI): Partial<CompanyInfo> {
    const info: Partial<CompanyInfo> = {};

    // Enhanced LinkedIn detection
    const linkedinSelectors = [
      'a[href*="linkedin.com/company/"]',
      'a[href*="linkedin.com/in/"]',
      'a[href*="linkedin.com"]',
      '.linkedin a',
      '[class*="linkedin" i] a',
      'a[title*="linkedin" i]',
      'a[aria-label*="linkedin" i]'
    ];
    
    for (const selector of linkedinSelectors) {
      const link = $(selector).attr('href');
      if (link && link.includes('linkedin.com')) {
        // Prefer company pages over individual profiles
        if (link.includes('/company/') || !info.linkedin) {
          info.linkedin = this.cleanSocialUrl(link);
        }
        if (link.includes('/company/')) break; // Stop if we found a company page
      }
    }

    // Enhanced Twitter/X detection
    const twitterSelectors = [
      'a[href*="twitter.com/"]',
      'a[href*="x.com/"]',
      '.twitter a',
      '.x-twitter a',
      '[class*="twitter" i] a',
      'a[title*="twitter" i]',
      'a[aria-label*="twitter" i]'
    ];
    
    for (const selector of twitterSelectors) {
      const link = $(selector).attr('href');
      if (link && (link.includes('twitter.com') || link.includes('x.com'))) {
        info.twitter = this.cleanSocialUrl(link);
        break;
      }
    }

    // Enhanced Facebook detection
    const facebookSelectors = [
      'a[href*="facebook.com/"]',
      'a[href*="fb.com/"]',
      '.facebook a',
      '[class*="facebook" i] a',
      'a[title*="facebook" i]',
      'a[aria-label*="facebook" i]'
    ];
    
    for (const selector of facebookSelectors) {
      const link = $(selector).attr('href');
      if (link && (link.includes('facebook.com') || link.includes('fb.com'))) {
        // Skip Facebook login/share links
        if (!link.includes('/sharer/') && !link.includes('/login/')) {
          info.facebook = this.cleanSocialUrl(link);
          break;
        }
      }
    }

    // Additional social platforms
    const instagramLink = $('a[href*="instagram.com/"]').attr('href');
    if (instagramLink && !instagramLink.includes('/share/')) {
      info.instagram = this.cleanSocialUrl(instagramLink);
    }

    const youtubeSelectors = [
      'a[href*="youtube.com/c/"]',
      'a[href*="youtube.com/channel/"]',
      'a[href*="youtube.com/user/"]',
      'a[href*="youtu.be/"]'
    ];
    
    for (const selector of youtubeSelectors) {
      const link = $(selector).attr('href');
      if (link) {
        info.youtube = this.cleanSocialUrl(link);
        break;
      }
    }

    return info;
  }

  private cleanSocialUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      // Remove tracking parameters
      const cleanParams = new URLSearchParams();
      urlObj.searchParams.forEach((value, key) => {
        // Keep only essential parameters
        if (!key.startsWith('utm_') && !key.startsWith('ref') && key !== 'fbclid') {
          cleanParams.set(key, value);
        }
      });
      urlObj.search = cleanParams.toString();
      return urlObj.href;
    } catch {
      return url;
    }
  }

  private extractLogo($: cheerio.CheerioAPI, baseUrl: string): string | undefined {
    // Try various selectors for logo
    const logoSelectors = [
      'img[alt*="logo" i]',
      '.logo img',
      '#logo img',
      '.header-logo img',
      '.navbar-brand img',
      'img[class*="logo" i]',
      'link[rel="apple-touch-icon"]',
      'link[rel="icon"]'
    ];

    for (const selector of logoSelectors) {
      const logoEl = $(selector).first();
      if (logoEl.length > 0) {
        const src = logoEl.attr('src') || logoEl.attr('href');
        if (src) {
          try {
            return new URL(src, baseUrl).href;
          } catch {
            continue;
          }
        }
      }
    }

    return undefined;
  }

  private extractDescriptionFromContent($: cheerio.CheerioAPI): string | undefined {
    // Look for about sections - return short description for meta purposes
    const aboutSelectors = [
      '.about',
      '#about',
      '.company-description',
      '.intro',
      '.hero-text',
      'main p:first-of-type',
      '.content p:first-of-type'
    ];

    for (const selector of aboutSelectors) {
      const text = $(selector).text().trim();
      if (text.length > 50 && text.length < 500) {
        return text;
      }
    }

    return undefined;
  }

  /**
   * Extract full About Us content - multiple paragraphs for comprehensive company description
   * This is used for RAG and detailed company profile
   */
  private extractFullAboutContent($: cheerio.CheerioAPI): string | undefined {
    const contentParts: string[] = [];
    
    // Priority 1: Look for dedicated about sections with multiple paragraphs
    const aboutSectionSelectors = [
      '#about',
      '.about-us',
      '.about-section',
      '[data-section="about"]',
      'section.about',
      'div.about',
      '.company-about',
      '.who-we-are',
      '.about-company'
    ];

    for (const selector of aboutSectionSelectors) {
      const section = $(selector);
      if (section.length > 0) {
        // Get all paragraphs within the section
        const paragraphs: string[] = [];
        section.find('p').each((_, el) => {
          const text = $(el).text().trim();
          if (text.length > 30 && !this.isNavigationText(text)) {
            paragraphs.push(text);
          }
        });
        
        // Also check for div content if no paragraphs
        if (paragraphs.length === 0) {
          section.find('div').each((_, el) => {
            const text = $(el).text().trim();
            if (text.length > 50 && text.length < 2000 && !this.isNavigationText(text)) {
              paragraphs.push(text);
            }
          });
        }
        
        if (paragraphs.length > 0) {
          contentParts.push(...paragraphs);
        }
      }
    }

    // Priority 2: Look for hero/intro sections with detailed content
    const heroSelectors = [
      '.hero-content',
      '.hero-text',
      '.intro-section',
      '.welcome-section',
      '.main-content'
    ];

    for (const selector of heroSelectors) {
      const section = $(selector);
      if (section.length > 0 && contentParts.length < 3) {
        section.find('p').each((_, el) => {
          const text = $(el).text().trim();
          if (text.length > 50 && !this.isNavigationText(text) && !contentParts.includes(text)) {
            contentParts.push(text);
          }
        });
      }
    }

    // Priority 3: Look for article schema content
    $('script[type="application/ld+json"]').each((_, element) => {
      try {
        const data = JSON.parse($(element).text());
        if (data['@type'] === 'Organization' && data.description && data.description.length > 100) {
          if (!contentParts.includes(data.description)) {
            contentParts.unshift(data.description); // Add at beginning as most authoritative
          }
        }
        if (data['@type'] === 'AboutPage' && data.mainEntity?.description) {
          if (!contentParts.includes(data.mainEntity.description)) {
            contentParts.push(data.mainEntity.description);
          }
        }
      } catch (e) {
        // Ignore JSON parse errors
      }
    });

    // Priority 4: Get main content paragraphs if we still don't have much
    if (contentParts.length < 2) {
      $('main p, article p, .content p, section p, .container p').each((index, el) => {
        if (index < 8) { // Check more paragraphs
          const text = $(el).text().trim();
          if (text.length > 50 && !this.isNavigationText(text) && !contentParts.includes(text)) {
            contentParts.push(text);
          }
        }
      });
    }

    // Priority 5: Look for any substantial text blocks in body sections
    if (contentParts.length < 2) {
      const bodySelectors = [
        'body section',
        '.page-content',
        '.site-content',
        '.wrapper',
        '#main',
        'main',
        '[role="main"]'
      ];
      
      for (const selector of bodySelectors) {
        if (contentParts.length >= 3) break;
        $(selector).find('p, h2 + p, h3 + p, .text, .description').each((index, el) => {
          if (index < 5 && contentParts.length < 5) {
            const text = $(el).text().trim();
            if (text.length > 60 && text.length < 1500 && !this.isNavigationText(text) && !contentParts.includes(text)) {
              contentParts.push(text);
            }
          }
        });
      }
    }

    // Priority 6: Use meta description if we have nothing else
    if (contentParts.length === 0) {
      const metaDesc = $('meta[name="description"]').attr('content')?.trim();
      const ogDesc = $('meta[property="og:description"]').attr('content')?.trim();
      if (metaDesc && metaDesc.length > 50) {
        contentParts.push(metaDesc);
      } else if (ogDesc && ogDesc.length > 50) {
        contentParts.push(ogDesc);
      }
    }

    // Clean and deduplicate
    const uniqueParts = Array.from(new Set(contentParts))
      .filter(text => text.length > 30)
      .slice(0, 10); // Limit to 10 paragraphs max

    if (uniqueParts.length === 0) {
      return undefined;
    }

    // Join with double newline for clear paragraph separation
    const fullContent = uniqueParts.join('\n\n');
    
    // Limit total content to ~5000 chars for RAG efficiency
    return fullContent.length > 5000 ? fullContent.substring(0, 5000) + '...' : fullContent;
  }

  /**
   * Check if text appears to be navigation/menu text rather than content
   */
  private isNavigationText(text: string): boolean {
    const navPatterns = [
      /^(home|about|services?|products?|contact|login|sign up|menu|go back)$/i,
      /^(read more|learn more|click here|view all)$/i,
      /^[\d\s\-\(\)]+$/, // Phone number patterns
      /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/, // Email patterns
    ];
    
    return navPatterns.some(pattern => pattern.test(text.trim()));
  }

  private extractCompanyDetails($: cheerio.CheerioAPI): Partial<CompanyInfo> {
    const info: Partial<CompanyInfo> = {};

    // Try to extract industry from meta keywords or content
    const keywords = $('meta[name="keywords"]').attr('content');
    if (keywords) {
      // Simple industry detection based on keywords
      const industries = ['construction', 'technology', 'healthcare', 'finance', 'retail', 'manufacturing'];
      for (const industry of industries) {
        if (keywords.toLowerCase().includes(industry)) {
          info.industry = industry.charAt(0).toUpperCase() + industry.slice(1);
          break;
        }
      }
    }

    return info;
  }

  private extractProductsAndServices($: cheerio.CheerioAPI, url: string): { products?: ProductService[], services?: ProductService[] } {
    const result: { products?: ProductService[], services?: ProductService[] } = {};
    
    // Try multiple strategies to find products and services
    const extractionStrategies = [
      this.extractFromStructuredData,
      this.extractFromNavigationMenus,
      this.extractFromContentSections,
      this.extractFromListings,
      this.extractFromCards
    ];

    let allProducts: ProductService[] = [];
    let allServices: ProductService[] = [];

    for (const strategy of extractionStrategies) {
      try {
        const extracted = strategy.call(this, $);
        if (extracted.products) {
          allProducts.push(...extracted.products);
        }
        if (extracted.services) {
          allServices.push(...extracted.services);
        }
      } catch (error: any) {
        // Continue with other strategies if one fails
        logger.warn('Product/service extraction strategy failed', { 
          strategy: strategy.name, 
          error: error.message 
        });
      }
    }

    // Remove duplicates and clean up
    const uniqueProducts = this.deduplicateProductsServices(allProducts);
    const uniqueServices = this.deduplicateProductsServices(allServices);

    if (uniqueProducts.length > 0) {
      result.products = uniqueProducts.slice(0, 20); // Limit to 20 items
    }
    if (uniqueServices.length > 0) {
      result.services = uniqueServices.slice(0, 20); // Limit to 20 items
    }

    return result;
  }

  private extractFromStructuredData($: cheerio.CheerioAPI): { products?: ProductService[], services?: ProductService[] } {
    const products: ProductService[] = [];
    const services: ProductService[] = [];

    // Look for JSON-LD structured data
    $('script[type="application/ld+json"]').each((_, element) => {
      try {
        const data = JSON.parse($(element).text());
        
        if (data['@type'] === 'Product' || data.hasOwnProperty('name')) {
          products.push({
            name: data.name || data.title,
            description: data.description,
            category: data.category,
            type: 'product'
          });
        }

        if (data.hasOwnProperty('serviceType') || data['@type'] === 'Service') {
          services.push({
            name: data.name || data.serviceType,
            description: data.description,
            category: data.category,
            type: 'service'
          });
        }

        // Handle arrays of products/services
        if (Array.isArray(data.hasOfferCatalog?.hasOfferCategory)) {
          data.hasOfferCatalog.hasOfferCategory.forEach((item: any) => {
            if (item.name) {
              const isService = /service|consultation|installation|maintenance|support/i.test(item.name);
              (isService ? services : products).push({
                name: item.name,
                description: item.description,
                type: isService ? 'service' : 'product'
              });
            }
          });
        }
      } catch (error) {
        // Invalid JSON, continue
      }
    });

    return { products: products.length > 0 ? products : undefined, services: services.length > 0 ? services : undefined };
  }

  private extractFromNavigationMenus($: cheerio.CheerioAPI): { products?: ProductService[], services?: ProductService[] } {
    const products: ProductService[] = [];
    const services: ProductService[] = [];

    // Look for navigation menus with products/services
    const navSelectors = [
      'nav a', '.navigation a', '.menu a', '.navbar a',
      '.main-menu a', '.primary-menu a', '.header-menu a'
    ];

    navSelectors.forEach(selector => {
      $(selector).each((_, element) => {
        const text = $(element).text().trim();
        const href = $(element).attr('href');
        
        if (text && href && this.isProductServiceLink(text, href)) {
          const isService = this.isServiceKeyword(text);
          const item: ProductService = {
            name: this.cleanProductServiceName(text),
            type: isService ? 'service' : 'product'
          };

          if (isService) {
            services.push(item);
          } else {
            products.push(item);
          }
        }
      });
    });

    return { products: products.length > 0 ? products : undefined, services: services.length > 0 ? services : undefined };
  }

  private extractFromContentSections($: cheerio.CheerioAPI): { products?: ProductService[], services?: ProductService[] } {
    const products: ProductService[] = [];
    const services: ProductService[] = [];

    // Look for dedicated product/service sections
    const sectionSelectors = [
      '.products', '.services', '.offerings', '.solutions',
      '#products', '#services', '#offerings', '#solutions',
      '[class*="product"]', '[class*="service"]',
      '.portfolio', '.capabilities', '.specialties'
    ];

    sectionSelectors.forEach(selector => {
      $(selector).each((_, section) => {
        const sectionText = $(section).text().toLowerCase();
        const isServiceSection = /service|consultation|support|maintenance|installation/i.test(sectionText);

        // Look for items within the section
        $(section).find('h1, h2, h3, h4, h5, h6, .title, .name, li').each((_, element) => {
          const text = $(element).text().trim();
          const description = $(element).next('p, .description, .desc').text().trim();

          if (text && text.length > 2 && text.length < 100 && this.isValidProductServiceName(text)) {
            const item: ProductService = {
              name: this.cleanProductServiceName(text),
              description: description || undefined,
              type: (isServiceSection || this.isServiceKeyword(text)) ? 'service' : 'product'
            };

            if (item.type === 'service') {
              services.push(item);
            } else {
              products.push(item);
            }
          }
        });
      });
    });

    return { products: products.length > 0 ? products : undefined, services: services.length > 0 ? services : undefined };
  }

  private extractFromListings($: cheerio.CheerioAPI): { products?: ProductService[], services?: ProductService[] } {
    const products: ProductService[] = [];
    const services: ProductService[] = [];

    // Look for lists that might contain products/services
    $('ul, ol').each((_, list) => {
      const listContext = $(list).prev('h1, h2, h3, h4, h5, h6, p').text().toLowerCase();
      const isServiceList = /service|offer|provide|specializ|capabilit/i.test(listContext);

      $(list).find('li').each((_, item) => {
        const text = $(item).text().trim();
        
        if (text && text.length > 2 && text.length < 150 && this.isValidProductServiceName(text)) {
          const item: ProductService = {
            name: this.cleanProductServiceName(text),
            type: (isServiceList || this.isServiceKeyword(text)) ? 'service' : 'product'
          };

          if (item.type === 'service') {
            services.push(item);
          } else {
            products.push(item);
          }
        }
      });
    });

    return { products: products.length > 0 ? products : undefined, services: services.length > 0 ? services : undefined };
  }

  private extractFromCards($: cheerio.CheerioAPI): { products?: ProductService[], services?: ProductService[] } {
    const products: ProductService[] = [];
    const services: ProductService[] = [];

    // Look for card-like elements
    const cardSelectors = [
      '.card', '.product-card', '.service-card', '.item',
      '.feature', '.offering', '.solution', '.category'
    ];

    cardSelectors.forEach(selector => {
      $(selector).each((_, card) => {
        const title = $(card).find('.title, .name, h1, h2, h3, h4, h5, h6').first().text().trim();
        const description = $(card).find('.description, .desc, p').first().text().trim();
        
        if (title && this.isValidProductServiceName(title)) {
          const isService = this.isServiceKeyword(title + ' ' + description);
          const item: ProductService = {
            name: this.cleanProductServiceName(title),
            description: description || undefined,
            type: isService ? 'service' : 'product'
          };

          if (isService) {
            services.push(item);
          } else {
            products.push(item);
          }
        }
      });
    });

    return { products: products.length > 0 ? products : undefined, services: services.length > 0 ? services : undefined };
  }

  private isProductServiceLink(text: string, href: string): boolean {
    // Check if this looks like a product/service link
    const productServiceKeywords = /product|service|solution|offering|category|item/i;
    return productServiceKeywords.test(text) || productServiceKeywords.test(href);
  }

  private isServiceKeyword(text: string): boolean {
    const serviceKeywords = /service|consultation|support|maintenance|installation|repair|training|design|planning|management|consulting|advisory|implementation|integration|custom|bespoke/i;
    return serviceKeywords.test(text);
  }

  private isValidProductServiceName(text: string): boolean {
    // Filter out common non-product/service text
    const excludePatterns = /^(home|about|contact|news|blog|career|team|privacy|terms|cookie|legal|more|read|click|learn|view|see|get|find|search|menu|navigation)$/i;
    const excludePhrases = /more info|read more|learn more|click here|view all|see more|get started|find out|contact us/i;
    
    return !excludePatterns.test(text) && !excludePhrases.test(text) && text.length >= 3;
  }

  private cleanProductServiceName(name: string): string {
    // Clean up product/service names
    return name
      .replace(/^\d+\.\s*/, '') // Remove numbering
      .replace(/^[-•]\s*/, '') // Remove bullet points
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  }

  private deduplicateProductsServices(items: ProductService[]): ProductService[] {
    const seen = new Set<string>();
    return items.filter(item => {
      const key = item.name.toLowerCase().trim();
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  private normalizeUrl(url: string): string {
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }
    
    try {
      const urlObj = new URL(url);
      return urlObj.href;
    } catch {
      throw new Error('Invalid URL format');
    }
  }

  private async getCachedInfo(url: string): Promise<CompanyInfo | null> {
    try {
      const cacheKey = this.getCacheKey(url);
      const cached = await cache.get(cacheKey);
      
      if (cached) {
        const parsedData = JSON.parse(cached);
        
        // Check if cached data has expired based on confidence
        const cacheAge = Date.now() - (parsedData.cachedAt || 0);
        const maxAge = this.getCacheMaxAge(parsedData.confidence);
        
        if (cacheAge > maxAge) {
          // Cache expired, remove it
          await cache.del(cacheKey);
          return null;
        }
        
        return parsedData;
      }
      
      return null;
    } catch (error: any) {
      logger.warn('Failed to get cached website info', { error: error.message });
      return null;
    }
  }

  private async cacheInfo(url: string, info: CompanyInfo): Promise<void> {
    try {
      const cacheKey = this.getCacheKey(url);
      const cacheData = {
        ...info,
        cachedAt: Date.now()
      };
      
      // Determine cache TTL based on confidence score
      const ttl = this.getCacheTTL(info.confidence);
      
      await cache.set(cacheKey, JSON.stringify(cacheData), ttl);
      
      logContext.performance('Website info cached', {
        operation: 'website_cache_set',
        url,
        confidence: info.confidence,
        ttl,
        fieldsCount: Object.keys(info).length
      });
      
    } catch (error: any) {
      logger.warn('Failed to cache website info', { error: error.message });
    }
  }

  private getCacheKey(url: string): string {
    const hash = Buffer.from(url).toString('base64').replace(/[/+=]/g, '');
    return `website_info:${hash}`;
  }

  private getCacheTTL(confidence: number): number {
    // Higher confidence = longer cache time
    if (confidence >= 0.8) return 86400; // 24 hours for high confidence
    if (confidence >= 0.5) return 43200; // 12 hours for medium confidence
    if (confidence >= 0.3) return 7200;  // 2 hours for low confidence
    return 1800; // 30 minutes for very low confidence
  }

  private getCacheMaxAge(confidence: number): number {
    // Convert TTL to milliseconds
    return this.getCacheTTL(confidence) * 1000;
  }

  private async enforceRateLimit(url: string): Promise<void> {
    const now = Date.now();
    const domain = this.getDomainFromUrl(url);
    
    // Global rate limiting - minimum delay between any requests
    const timeSinceLastRequest = now - this.lastRequestTime;
    if (timeSinceLastRequest < this.rateLimitDelay) {
      await new Promise(resolve => 
        setTimeout(resolve, this.rateLimitDelay - timeSinceLastRequest)
      );
    }
    
    // Domain-specific rate limiting
    const domainLimits = this.requestCounts.get(domain) || { count: 0, resetTime: now + 3600000 }; // 1 hour
    
    // Reset counter if hour has passed
    if (now > domainLimits.resetTime) {
      domainLimits.count = 0;
      domainLimits.resetTime = now + 3600000;
    }
    
    // Check if we've exceeded the hourly limit for this domain
    if (domainLimits.count >= this.maxRequestsPerHour) {
      const waitTime = domainLimits.resetTime - now;
      
      logContext.security('Rate limit exceeded for domain', {
        domain,
        count: domainLimits.count,
        waitTime,
        action: 'rate_limit_exceeded',
        result: 'blocked'
      });
      
      throw new Error(`Rate limit exceeded for ${domain}. Try again in ${Math.ceil(waitTime / 60000)} minutes.`);
    }
    
    // Increment counter and update last request time
    domainLimits.count++;
    this.requestCounts.set(domain, domainLimits);
    this.lastRequestTime = Date.now();
    
    // Add progressive delay based on request count for this domain
    const progressiveDelay = Math.min(domainLimits.count * 100, 5000); // Max 5 second delay
    if (progressiveDelay > 0) {
      await new Promise(resolve => setTimeout(resolve, progressiveDelay));
    }
  }

  private getDomainFromUrl(url: string): string {
    try {
      return new URL(url).hostname;
    } catch {
      return 'unknown';
    }
  }
}

export const websiteFetcher = new WebsiteFetcher();