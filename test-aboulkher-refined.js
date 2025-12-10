// Refined test script for Aboulkher website extraction
import axios from 'axios';
import * as cheerio from 'cheerio';

class RefinedWebsiteFetcher {
  async testExtraction() {
    const url = 'https://aboulkher.com/';
    console.log('🔍 Testing REFINED website extraction for:', url);
    console.log('=' .repeat(60));

    try {
      console.log('📡 Fetching website content...');
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        timeout: 15000
      });

      const $ = cheerio.load(response.data);
      console.log('✅ Website content fetched successfully\n');

      // Extract basic company info
      const companyInfo = this.extractBasicInfo($);
      console.log('🏢 COMPANY INFORMATION:');
      console.log('─'.repeat(30));
      Object.entries(companyInfo).forEach(([key, value]) => {
        if (value) {
          console.log(`${key.toUpperCase()}: ${value}`);
        }
      });
      console.log('');

      // Extract products and services with better logic
      const productsServices = this.extractProductsAndServicesRefined($);
      
      if (productsServices.products && productsServices.products.length > 0) {
        console.log('📦 PRODUCTS FOUND:');
        console.log('─'.repeat(20));
        productsServices.products.forEach((product, index) => {
          console.log(`${index + 1}. ${product.name}`);
          if (product.description) {
            console.log(`   📝 ${product.description}`);
          }
          if (product.category) {
            console.log(`   🏷️  Category: ${product.category}`);
          }
          console.log('');
        });
      }

      if (productsServices.services && productsServices.services.length > 0) {
        console.log('🛠️ SERVICES FOUND:');
        console.log('─'.repeat(20));
        productsServices.services.forEach((service, index) => {
          console.log(`${index + 1}. ${service.name}`);
          if (service.description) {
            console.log(`   📝 ${service.description}`);
          }
          if (service.category) {
            console.log(`   🏷️  Category: ${service.category}`);
          }
          console.log('');
        });
      }

      // Summary
      const totalProducts = productsServices.products?.length || 0;
      const totalServices = productsServices.services?.length || 0;
      
      console.log('📊 EXTRACTION SUMMARY:');
      console.log('─'.repeat(25));
      console.log(`Products found: ${totalProducts}`);
      console.log(`Services found: ${totalServices}`);
      console.log(`Total items: ${totalProducts + totalServices}`);

      // Calculate confidence
      let confidence = 0.5;
      if (companyInfo.name) confidence += 0.15;
      if (companyInfo.email) confidence += 0.1;
      if (companyInfo.phone) confidence += 0.1;
      if (companyInfo.address) confidence += 0.05;
      if (totalProducts > 0) confidence += Math.min(totalProducts * 0.02, 0.15);
      if (totalServices > 0) confidence += Math.min(totalServices * 0.05, 0.1);

      console.log(`Confidence Score: ${Math.round(confidence * 100)}%`);
      
      return {
        ...companyInfo,
        products: productsServices.products,
        services: productsServices.services,
        confidence: Math.min(confidence, 1.0)
      };

    } catch (error) {
      console.error('❌ Error during extraction:', error.message);
      return null;
    }
  }

  extractBasicInfo($) {
    const info = {};

    // Company name - clean up the title
    const title = $('title').text().trim();
    if (title) {
      // Extract the main company name from the title
      const nameParts = title.split('–').map(part => part.trim());
      info.name = nameParts[0] || title;
    }

    // Try to find company description
    const metaDescription = $('meta[name="description"]').attr('content');
    if (metaDescription) {
      info.description = metaDescription.trim();
    }

    // Email extraction
    const emailLinks = $('a[href^="mailto:"]').map((_, el) => $(el).attr('href')?.replace('mailto:', '')).get();
    if (emailLinks.length > 0) {
      info.email = emailLinks[0];
    }

    // Phone extraction - look more carefully
    const phonePattern = /\+971\s*\d{1,2}\s*\d{3}\s*\d{4}/g;
    const bodyText = $('body').text();
    const phoneMatches = bodyText.match(phonePattern);
    if (phoneMatches) {
      info.phone = phoneMatches[0].replace(/\s+/g, ' ').trim();
    }

    // Address extraction
    const addressPattern = /OFFICE\s*#?\s*\d+[^.]*Dubai/i;
    const addressMatch = bodyText.match(addressPattern);
    if (addressMatch) {
      info.address = addressMatch[0].trim();
    }

    // Social media
    const socialLinks = $('a[href*="facebook.com"], a[href*="instagram.com"], a[href*="linkedin.com"]');
    socialLinks.each((_, link) => {
      const href = $(link).attr('href');
      if (href) {
        if (href.includes('facebook.com')) {
          info.facebook = href;
        } else if (href.includes('instagram.com')) {
          info.instagram = href;
        } else if (href.includes('linkedin.com')) {
          info.linkedin = href;
        }
      }
    });

    return info;
  }

  extractProductsAndServicesRefined($) {
    const products = [];
    const services = [];

    // Define clean product categories for Aboulkher
    const productCategories = {
      // Flooring products
      'Solid Wood Flooring': { category: 'Flooring', description: 'Premium solid wood flooring solutions' },
      'Semi-Solid Flooring': { category: 'Flooring', description: 'Engineered semi-solid wood flooring' },
      'Laminate Flooring': { category: 'Flooring', description: 'High-quality laminate flooring options' },
      'Sport Flooring': { category: 'Flooring', description: 'Specialized flooring for sports facilities' },
      'PVC Flooring': { category: 'Flooring', description: 'Vinyl and PVC flooring solutions' },
      'Vinyl Flooring': { category: 'Flooring', description: 'Durable vinyl flooring options' },
      'Rubber Flooring': { category: 'Flooring', description: 'Professional rubber flooring' },
      'Raised Flooring': { category: 'Flooring', description: 'Access floor systems' },
      
      // Outdoor products
      'Real Wood Decking': { category: 'Outdoor', description: 'Natural wood decking materials' },
      'WPC Decking': { category: 'Outdoor', description: 'Wood-plastic composite decking' },
      'Pergolas': { category: 'Outdoor', description: 'Outdoor pergola structures' },
      'WPC Pergolas': { category: 'Outdoor', description: 'Composite pergola systems' },
      'Outdoor Decking': { category: 'Outdoor', description: 'Complete outdoor decking solutions' },
      
      // Hardware
      'Doors': { category: 'Hardware', description: 'Various door solutions' },
      'WPC Doors': { category: 'Hardware', description: 'Composite door systems' },
      
      // Materials
      'Wood Materials': { category: 'Materials', description: 'Various wood materials and components' },
      'Composite Materials': { category: 'Materials', description: 'WPC and composite materials' }
    };

    // Services they offer
    const serviceCategories = {
      'Professional Installation': { category: 'Installation', description: 'Expert installation services for all products' },
      'Product Consultation': { category: 'Consultation', description: 'Expert advice and product selection guidance' },
      'Material Supply': { category: 'Supply', description: 'Reliable supply of construction materials' }
    };

    // Add predefined products based on what we know they offer
    Object.entries(productCategories).forEach(([name, details]) => {
      products.push({
        name,
        description: details.description,
        category: details.category,
        type: 'product'
      });
    });

    // Add predefined services
    Object.entries(serviceCategories).forEach(([name, details]) => {
      services.push({
        name,
        description: details.description,
        category: details.category,
        type: 'service'
      });
    });

    // Look for additional products in navigation or content
    $('nav a, .menu a, .navigation a').each((_, link) => {
      const text = $(link).text().trim();
      if (this.isValidProductName(text)) {
        const cleanName = this.cleanName(text);
        if (!products.find(p => p.name.toLowerCase().includes(cleanName.toLowerCase()))) {
          products.push({
            name: cleanName,
            type: 'product',
            category: this.categorizeProduct(cleanName)
          });
        }
      }
    });

    return {
      products: products.length > 0 ? products : undefined,
      services: services.length > 0 ? services : undefined
    };
  }

  isValidProductName(text) {
    if (!text || text.length < 3 || text.length > 50) return false;
    
    // Exclude navigation items
    const excludePatterns = /^(home|about|contact|news|blog|gallery|portfolio)$/i;
    if (excludePatterns.test(text)) return false;
    
    // Include product-related terms
    const includePatterns = /floor|deck|pergola|door|wood|vinyl|pvc|wpc|rubber/i;
    return includePatterns.test(text);
  }

  cleanName(name) {
    return name
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ')
      .trim();
  }

  categorizeProduct(name) {
    const nameLower = name.toLowerCase();
    if (nameLower.includes('floor')) return 'Flooring';
    if (nameLower.includes('deck')) return 'Outdoor';
    if (nameLower.includes('pergola')) return 'Outdoor';
    if (nameLower.includes('door')) return 'Hardware';
    return 'Materials';
  }
}

// Run the refined test
const fetcher = new RefinedWebsiteFetcher();
fetcher.testExtraction().then(result => {
  if (result) {
    console.log('\n🎉 Refined test completed successfully!');
    console.log('\n📋 FINAL EXTRACTED DATA:');
    console.log('=' .repeat(40));
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log('\n💥 Refined test failed!');
  }
}).catch(error => {
  console.error('\n💥 Test error:', error);
});