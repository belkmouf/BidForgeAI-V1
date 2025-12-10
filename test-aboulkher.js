// Test script for Aboulkher website extraction
import axios from 'axios';
import * as cheerio from 'cheerio';

// Simplified version of our extraction logic for testing
class TestWebsiteFetcher {
  async testExtraction() {
    const url = 'https://aboulkher.com/';
    console.log('🔍 Testing website extraction for:', url);
    console.log('=' .repeat(60));

    try {
      // Fetch the website
      console.log('📡 Fetching website content...');
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        timeout: 15000
      });

      const $ = cheerio.load(response.data);
      console.log('✅ Website content fetched successfully');
      console.log('');

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

      // Extract products and services
      const productsServices = this.extractProductsAndServices($);
      
      if (productsServices.products && productsServices.products.length > 0) {
        console.log('📦 PRODUCTS FOUND:');
        console.log('─'.repeat(20));
        productsServices.products.forEach((product, index) => {
          console.log(`${index + 1}. ${product.name}`);
          if (product.description) {
            console.log(`   Description: ${product.description}`);
          }
          if (product.category) {
            console.log(`   Category: ${product.category}`);
          }
        });
        console.log('');
      }

      if (productsServices.services && productsServices.services.length > 0) {
        console.log('🛠️ SERVICES FOUND:');
        console.log('─'.repeat(20));
        productsServices.services.forEach((service, index) => {
          console.log(`${index + 1}. ${service.name}`);
          if (service.description) {
            console.log(`   Description: ${service.description}`);
          }
          if (service.category) {
            console.log(`   Category: ${service.category}`);
          }
        });
        console.log('');
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
      let confidence = 0.5; // Base confidence
      if (companyInfo.name) confidence += 0.1;
      if (companyInfo.email) confidence += 0.1;
      if (companyInfo.phone) confidence += 0.1;
      if (totalProducts > 0) confidence += Math.min(totalProducts * 0.03, 0.15);
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

    // Company name from title
    const title = $('title').text().trim();
    if (title) {
      info.name = title.replace(/\s*[\|\-\–\—]\s*(Home|Welcome|Official Website).*$/i, '').trim();
    }

    // Email extraction
    const emailLinks = $('a[href^="mailto:"]').map((_, el) => $(el).attr('href')?.replace('mailto:', '')).get();
    if (emailLinks.length > 0) {
      info.email = emailLinks[0];
    }

    // Phone extraction
    const phoneLinks = $('a[href^="tel:"]').map((_, el) => $(el).text()).get();
    if (phoneLinks.length > 0) {
      info.phone = phoneLinks[0];
    }

    // Try to find address
    const addressSelectors = ['.address', '.location', '[itemtype*="PostalAddress"]'];
    for (const selector of addressSelectors) {
      const addressEl = $(selector).first();
      if (addressEl.length > 0) {
        const addressText = addressEl.text().trim();
        if (addressText.length > 10) {
          info.address = addressText;
          break;
        }
      }
    }

    // Social media
    const linkedin = $('a[href*="linkedin.com"]').attr('href');
    if (linkedin) info.linkedin = linkedin;

    const facebook = $('a[href*="facebook.com"]').attr('href');
    if (facebook) info.facebook = facebook;

    const instagram = $('a[href*="instagram.com"]').attr('href');
    if (instagram) info.instagram = instagram;

    return info;
  }

  extractProductsAndServices($) {
    const products = [];
    const services = [];

    // Look for product/service related content
    const contentText = $('body').text().toLowerCase();

    // Define product patterns for this specific site
    const productPatterns = [
      /solid.*wood.*flooring/i,
      /semi.*solid.*flooring/i,
      /laminate.*flooring/i,
      /real.*wood.*decking/i,
      /wpc.*decking/i,
      /pergola/i,
      /sport.*flooring/i,
      /pvc.*flooring/i,
      /vinyl.*flooring/i,
      /raised.*floors?/i,
      /doors?/i
    ];

    // Define service patterns
    const servicePatterns = [
      /installation/i,
      /consultation/i,
      /professional.*installation/i,
      /expert.*installation/i,
      /product.*consultation/i,
      /material.*supply/i,
      /supply.*service/i
    ];

    // Extract from visible text
    const textContent = $.text();
    
    // Look for specific mentions in the content
    productPatterns.forEach(pattern => {
      const match = textContent.match(pattern);
      if (match) {
        const productName = this.cleanProductName(match[0]);
        if (productName && !products.find(p => p.name.toLowerCase() === productName.toLowerCase())) {
          products.push({
            name: productName,
            type: 'product',
            category: this.categorizeProduct(productName)
          });
        }
      }
    });

    servicePatterns.forEach(pattern => {
      const match = textContent.match(pattern);
      if (match) {
        const serviceName = this.cleanServiceName(match[0]);
        if (serviceName && !services.find(s => s.name.toLowerCase() === serviceName.toLowerCase())) {
          services.push({
            name: serviceName,
            type: 'service',
            category: this.categorizeService(serviceName)
          });
        }
      }
    });

    // Look for lists that might contain products
    $('ul, ol').each((_, list) => {
      $(list).find('li').each((_, item) => {
        const text = $(item).text().trim();
        if (text.length > 2 && text.length < 100) {
          if (this.isProductLike(text)) {
            const productName = this.cleanProductName(text);
            if (!products.find(p => p.name.toLowerCase() === productName.toLowerCase())) {
              products.push({
                name: productName,
                type: 'product',
                category: this.categorizeProduct(productName)
              });
            }
          } else if (this.isServiceLike(text)) {
            const serviceName = this.cleanServiceName(text);
            if (!services.find(s => s.name.toLowerCase() === serviceName.toLowerCase())) {
              services.push({
                name: serviceName,
                type: 'service',
                category: this.categorizeService(serviceName)
              });
            }
          }
        }
      });
    });

    return {
      products: products.length > 0 ? products : undefined,
      services: services.length > 0 ? services : undefined
    };
  }

  isProductLike(text) {
    const productKeywords = /floor|decking|pergola|door|wood|laminate|pvc|vinyl|raised/i;
    return productKeywords.test(text) && !/service|installation|consultation/i.test(text);
  }

  isServiceLike(text) {
    const serviceKeywords = /service|installation|consultation|support|maintenance|supply/i;
    return serviceKeywords.test(text);
  }

  cleanProductName(name) {
    return name
      .replace(/^\d+\.\s*/, '')
      .replace(/^[-•]\s*/, '')
      .trim()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  cleanServiceName(name) {
    return name
      .replace(/^\d+\.\s*/, '')
      .replace(/^[-•]\s*/, '')
      .trim()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  categorizeProduct(name) {
    const nameLower = name.toLowerCase();
    if (nameLower.includes('floor')) return 'Flooring';
    if (nameLower.includes('deck')) return 'Outdoor';
    if (nameLower.includes('pergola')) return 'Outdoor';
    if (nameLower.includes('door')) return 'Hardware';
    return 'Materials';
  }

  categorizeService(name) {
    const nameLower = name.toLowerCase();
    if (nameLower.includes('installation')) return 'Installation';
    if (nameLower.includes('consultation')) return 'Consultation';
    if (nameLower.includes('supply')) return 'Supply';
    return 'Service';
  }
}

// Run the test
const fetcher = new TestWebsiteFetcher();
fetcher.testExtraction().then(result => {
  if (result) {
    console.log('\n🎉 Test completed successfully!');
  } else {
    console.log('\n💥 Test failed!');
  }
}).catch(error => {
  console.error('\n💥 Test error:', error);
});