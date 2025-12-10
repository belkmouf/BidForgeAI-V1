import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { WebsiteFetcher, type CompanyInfo } from './website-fetcher';
import { validationScorer } from './validation-scorer';

// Mock dependencies
jest.mock('./cache.js', () => ({
  cache: {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn()
  }
}));

jest.mock('./logger.js', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  },
  logContext: {
    system: jest.fn(),
    security: jest.fn(),
    performance: jest.fn()
  }
}));

jest.mock('axios');
import axios from 'axios';
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('WebsiteFetcher', () => {
  let fetcher: WebsiteFetcher;

  beforeEach(() => {
    fetcher = new WebsiteFetcher();
    jest.clearAllMocks();
  });

  describe('normalizeUrl', () => {
    test('should add https protocol to urls without protocol', () => {
      const result = (fetcher as any).normalizeUrl('example.com');
      expect(result).toBe('https://example.com/');
    });

    test('should preserve existing protocol', () => {
      const result = (fetcher as any).normalizeUrl('http://example.com');
      expect(result).toBe('http://example.com/');
    });

    test('should throw error for invalid urls', () => {
      expect(() => {
        (fetcher as any).normalizeUrl('invalid-url');
      }).toThrow('Invalid URL format');
    });
  });

  describe('extractCompanyName', () => {
    test('should extract company name from title', () => {
      const mockHtml = '<title>Acme Corporation - Home</title>';
      const $ = require('cheerio').load(mockHtml);
      const result = (fetcher as any).extractCompanyName($, 'Acme Corporation - Home', 'https://example.com');
      expect(result).toBe('Acme Corporation');
    });

    test('should remove common suffixes from title', () => {
      const mockHtml = '<title>Test Company | Official Website</title>';
      const $ = require('cheerio').load(mockHtml);
      const result = (fetcher as any).extractCompanyName($, 'Test Company | Official Website', 'https://example.com');
      expect(result).toBe('Test Company');
    });

    test('should extract from OpenGraph site name', () => {
      const mockHtml = '<meta property="og:site_name" content="Best Company" />';
      const $ = require('cheerio').load(mockHtml);
      const result = (fetcher as any).extractCompanyName($, '', 'https://example.com');
      expect(result).toBe('Best Company');
    });
  });

  describe('extractContactInfo', () => {
    test('should extract email addresses from mailto links', () => {
      const mockHtml = '<a href="mailto:contact@example.com">Contact Us</a>';
      const $ = require('cheerio').load(mockHtml);
      const result = (fetcher as any).extractContactInfo($);
      expect(result.email).toBe('contact@example.com');
    });

    test('should prefer business emails over personal ones', () => {
      const mockHtml = `
        <a href="mailto:john@example.com">John</a>
        <a href="mailto:info@example.com">Info</a>
      `;
      const $ = require('cheerio').load(mockHtml);
      const result = (fetcher as any).extractContactInfo($);
      expect(result.email).toBe('info@example.com');
    });

    test('should extract phone numbers from tel links', () => {
      const mockHtml = '<a href="tel:+1234567890">Call Us</a>';
      const $ = require('cheerio').load(mockHtml);
      const result = (fetcher as any).extractContactInfo($);
      expect(result.phone).toBe('+1234567890');
    });
  });

  describe('extractSocialMedia', () => {
    test('should extract LinkedIn company pages', () => {
      const mockHtml = '<a href="https://linkedin.com/company/acme-corp">LinkedIn</a>';
      const $ = require('cheerio').load(mockHtml);
      const result = (fetcher as any).extractSocialMedia($);
      expect(result.linkedin).toBe('https://linkedin.com/company/acme-corp');
    });

    test('should prefer company pages over individual profiles', () => {
      const mockHtml = `
        <a href="https://linkedin.com/in/john-doe">John</a>
        <a href="https://linkedin.com/company/acme-corp">Company</a>
      `;
      const $ = require('cheerio').load(mockHtml);
      const result = (fetcher as any).extractSocialMedia($);
      expect(result.linkedin).toBe('https://linkedin.com/company/acme-corp');
    });

    test('should extract Twitter/X links', () => {
      const mockHtml = '<a href="https://twitter.com/acmecorp">Twitter</a>';
      const $ = require('cheerio').load(mockHtml);
      const result = (fetcher as any).extractSocialMedia($);
      expect(result.twitter).toBe('https://twitter.com/acmecorp');
    });

    test('should clean tracking parameters from social URLs', () => {
      const mockHtml = '<a href="https://facebook.com/acmecorp?utm_source=website&ref=footer">Facebook</a>';
      const $ = require('cheerio').load(mockHtml);
      const result = (fetcher as any).extractSocialMedia($);
      expect(result.facebook).toBe('https://facebook.com/acmecorp');
    });
  });

  describe('getCacheTTL', () => {
    test('should return longer TTL for higher confidence', () => {
      const highConfidenceTTL = (fetcher as any).getCacheTTL(0.9);
      const lowConfidenceTTL = (fetcher as any).getCacheTTL(0.2);
      expect(highConfidenceTTL).toBeGreaterThan(lowConfidenceTTL);
    });

    test('should return 24 hours for high confidence', () => {
      const result = (fetcher as any).getCacheTTL(0.8);
      expect(result).toBe(86400); // 24 hours
    });

    test('should return 30 minutes for very low confidence', () => {
      const result = (fetcher as any).getCacheTTL(0.1);
      expect(result).toBe(1800); // 30 minutes
    });
  });
});

describe('ValidationScorer', () => {
  describe('validateCompanyName', () => {
    test('should validate normal company names', () => {
      const result = (validationScorer as any).validateCompanyName('Acme Corporation');
      expect(result.isValid).toBe(true);
      expect(result.confidence).toBeGreaterThan(0.8);
    });

    test('should detect navigation text in company names', () => {
      const result = (validationScorer as any).validateCompanyName('Welcome to Our Company');
      expect(result.isValid).toBe(false);
      expect(result.issues).toContain('Name appears to contain website navigation text');
    });

    test('should boost confidence for business suffixes', () => {
      const result = (validationScorer as any).validateCompanyName('Tech Solutions Inc');
      expect(result.confidence).toBeGreaterThan(0.8);
    });
  });

  describe('validateEmail', () => {
    test('should validate proper email format', () => {
      const result = (validationScorer as any).validateEmail('contact@company.com');
      expect(result.isValid).toBe(true);
      expect(result.confidence).toBeGreaterThan(0.8);
    });

    test('should detect invalid email format', () => {
      const result = (validationScorer as any).validateEmail('invalid-email');
      expect(result.isValid).toBe(false);
      expect(result.confidence).toBe(0);
    });

    test('should boost confidence for business email patterns', () => {
      const businessResult = (validationScorer as any).validateEmail('info@company.com');
      const personalResult = (validationScorer as any).validateEmail('john@gmail.com');
      expect(businessResult.confidence).toBeGreaterThan(personalResult.confidence);
    });

    test('should detect placeholder emails', () => {
      const result = (validationScorer as any).validateEmail('test@example.com');
      expect(result.issues).toContain('Appears to be a placeholder email');
    });
  });

  describe('validatePhone', () => {
    test('should validate normal phone numbers', () => {
      const result = (validationScorer as any).validatePhone('(555) 123-4567');
      expect(result.isValid).toBe(true);
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    test('should detect too short phone numbers', () => {
      const result = (validationScorer as any).validatePhone('123');
      expect(result.issues).toContain('Phone number appears to be too short');
    });

    test('should detect fake phone patterns', () => {
      const result = (validationScorer as any).validatePhone('1111111111');
      expect(result.issues).toContain('Appears to be a placeholder phone number');
    });
  });

  describe('validateWebsite', () => {
    test('should validate proper URLs', () => {
      const result = (validationScorer as any).validateWebsite('https://example.com');
      expect(result.isValid).toBe(true);
      expect(result.confidence).toBeGreaterThan(0.8);
    });

    test('should detect invalid protocols', () => {
      const result = (validationScorer as any).validateWebsite('ftp://example.com');
      expect(result.issues).toContain('Invalid protocol (should be http or https)');
    });

    test('should prefer HTTPS over HTTP', () => {
      const httpsResult = (validationScorer as any).validateWebsite('https://example.com');
      const httpResult = (validationScorer as any).validateWebsite('http://example.com');
      expect(httpsResult.confidence).toBeGreaterThan(httpResult.confidence);
    });

    test('should detect suspicious domains', () => {
      const result = (validationScorer as any).validateWebsite('https://example.tk');
      expect(result.issues).toContain('Uses a suspicious domain extension');
    });
  });
});