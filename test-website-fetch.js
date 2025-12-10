import { websiteFetcher } from './server/lib/website-fetcher.js';
import { logger } from './server/lib/logger.js';

async function testWebsiteFetch() {
  try {
    console.log('Testing website fetch for: https://aboulkher.com/');
    
    const result = await websiteFetcher.fetchCompanyInfo('https://aboulkher.com/', {
      useCache: false,
      timeout: 15000
    });
    
    console.log('\n=== EXTRACTION RESULTS ===');
    console.log(JSON.stringify(result, null, 2));
    
    console.log('\n=== VALIDATION SUMMARY ===');
    if (result.validation) {
      console.log(`Overall Confidence: ${(result.validation.overallConfidence * 100).toFixed(1)}%`);
      console.log(`Overall Score: ${result.validation.overallScore}%`);
      console.log(`Valid Fields: ${result.validation.summary.valid}/${result.validation.summary.total}`);
      
      console.log('\n=== FIELD VALIDATION ===');
      result.validation.fieldResults.forEach(field => {
        const status = field.isValid ? '✅' : '❌';
        const confidence = `${(field.confidence * 100).toFixed(1)}%`;
        console.log(`${status} ${field.field}: ${confidence} confidence`);
        
        if (field.issues.length > 0) {
          console.log(`   Issues: ${field.issues.join(', ')}`);
        }
        if (field.suggestions && field.suggestions.length > 0) {
          console.log(`   Suggestions: ${field.suggestions.join(', ')}`);
        }
      });
    }
    
  } catch (error) {
    console.error('Error fetching website:', error.message);
    console.error(error.stack);
  }
}

testWebsiteFetch();