import { logger } from './logger.js';

interface ScrapedBranding {
  companyName?: string;
  tagline?: string;
  logoUrl?: string;
  primaryColor?: string;
  aboutUs?: string;
  contactEmail?: string;
  contactPhone?: string;
  streetAddress?: string;
  city?: string;
  state?: string;
  zip?: string;
}

export async function scrapeWebsiteForBranding(websiteUrl: string): Promise<ScrapedBranding> {
  try {
    let url = websiteUrl.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch website: ${response.status}`);
    }

    const html = await response.text();
    const result: ScrapedBranding = {};

    // Extract company name from title or og:site_name
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const ogSiteNameMatch = html.match(/<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i) ||
                            html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:site_name["']/i);
    
    if (ogSiteNameMatch) {
      result.companyName = cleanText(ogSiteNameMatch[1]);
    } else if (titleMatch) {
      let title = cleanText(titleMatch[1]);
      title = title.split(/[|\-–—]/)[0].trim();
      if (title.length > 2 && title.length < 100) {
        result.companyName = title;
      }
    }

    // Extract tagline/description from meta description
    const descMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i) ||
                      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i);
    if (descMatch) {
      const desc = cleanText(descMatch[1]);
      if (desc.length > 10 && desc.length < 200) {
        result.tagline = desc;
      }
    }

    // Extract logo URL
    const logoPatterns = [
      /<link[^>]+rel=["'](?:icon|shortcut icon|apple-touch-icon)["'][^>]+href=["']([^"']+)["']/i,
      /<img[^>]+(?:class|id)=["'][^"']*logo[^"']*["'][^>]+src=["']([^"']+)["']/i,
      /<img[^>]+src=["']([^"']+)["'][^>]+(?:class|id)=["'][^"']*logo[^"']*["']/i,
      /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
    ];

    for (const pattern of logoPatterns) {
      const match = html.match(pattern);
      if (match) {
        let logoUrl = match[1];
        if (logoUrl.startsWith('//')) {
          logoUrl = 'https:' + logoUrl;
        } else if (logoUrl.startsWith('/')) {
          const baseUrl = new URL(url);
          logoUrl = `${baseUrl.protocol}//${baseUrl.host}${logoUrl}`;
        } else if (!logoUrl.startsWith('http')) {
          const baseUrl = new URL(url);
          logoUrl = `${baseUrl.protocol}//${baseUrl.host}/${logoUrl}`;
        }
        result.logoUrl = logoUrl;
        break;
      }
    }

    // Extract primary color from CSS or theme-color meta
    const themeColorMatch = html.match(/<meta[^>]+name=["']theme-color["'][^>]+content=["']([^"']+)["']/i);
    if (themeColorMatch) {
      result.primaryColor = themeColorMatch[1];
    } else {
      const colorMatches = html.match(/(?:--primary|--brand|--main)[^:]*:\s*(#[0-9a-fA-F]{6}|#[0-9a-fA-F]{3})/gi);
      if (colorMatches && colorMatches.length > 0) {
        const colorValue = colorMatches[0].match(/#[0-9a-fA-F]{3,6}/i);
        if (colorValue) {
          result.primaryColor = colorValue[0];
        }
      }
    }

    // Extract email addresses
    const emailMatch = html.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    if (emailMatch) {
      const email = emailMatch[0];
      if (!email.includes('example') && !email.includes('test') && !email.includes('placeholder')) {
        result.contactEmail = email;
      }
    }

    // Extract phone numbers
    const phonePatterns = [
      /(?:tel:|phone:|call:)?[\s]*(\+?1?[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})/i,
      /(\(\d{3}\)\s*\d{3}[-.\s]\d{4})/,
    ];
    for (const pattern of phonePatterns) {
      const match = html.match(pattern);
      if (match) {
        result.contactPhone = match[1].replace(/[^\d+()-\s]/g, '').trim();
        break;
      }
    }

    // Extract address using schema.org or common patterns
    const addressMatch = html.match(/"streetAddress"\s*:\s*"([^"]+)"/i);
    if (addressMatch) {
      result.streetAddress = cleanText(addressMatch[1]);
    }

    const cityMatch = html.match(/"addressLocality"\s*:\s*"([^"]+)"/i);
    if (cityMatch) {
      result.city = cleanText(cityMatch[1]);
    }

    const stateMatch = html.match(/"addressRegion"\s*:\s*"([^"]+)"/i);
    if (stateMatch) {
      result.state = cleanText(stateMatch[1]);
    }

    const zipMatch = html.match(/"postalCode"\s*:\s*"([^"]+)"/i);
    if (zipMatch) {
      result.zip = cleanText(zipMatch[1]);
    }

    logger.info('Website scraped for branding', { 
      url, 
      fieldsFound: Object.keys(result).length 
    });

    return result;
  } catch (error: any) {
    logger.error('Failed to scrape website', { 
      url: websiteUrl, 
      error: error.message 
    });
    throw new Error(`Failed to scrape website: ${error.message}`);
  }
}

function cleanText(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
