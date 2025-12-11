import { storage } from '../storage.js';
import { generateEmbedding } from './openai.js';
import { logger, logContext } from './logger.js';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import type { CompanyInfo } from './website-fetcher.js';
import type { BrandingProfile, CompanyProductService, SocialMediaLinks } from '../../shared/schema.js';

const CHUNK_SIZE = 1000;
const CHUNK_OVERLAP = 100;

interface CompanyIntelligenceResult {
  documentId: number;
  chunksCreated: number;
  brandingProfileUpdated: boolean;
}

/**
 * Service to persist website-fetched company data and integrate with RAG system
 */
export class CompanyIntelligenceService {
  private textSplitter: RecursiveCharacterTextSplitter;

  constructor() {
    this.textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: CHUNK_SIZE,
      chunkOverlap: CHUNK_OVERLAP,
      separators: ['\n\n', '\n', '. ', ', ', ' ', ''],
    });
  }

  /**
   * Save fetched company info to branding profile and RAG knowledge base
   * Uses merge strategy to avoid overwriting user-entered data
   */
  async saveCompanyIntelligence(
    companyInfo: CompanyInfo,
    userId: number,
    companyId: number
  ): Promise<CompanyIntelligenceResult> {
    const startTime = Date.now();
    
    try {
      // 1. Convert to branding profile format and MERGE with existing (don't reset onboarding)
      const brandingProfile = this.convertToBrandingProfile(companyInfo);
      const user = await storage.updateBrandingProfileFromWebsite(userId, brandingProfile);
      
      // 2. Create comprehensive company knowledge document for RAG with source metadata
      const knowledgeContent = this.buildKnowledgeDocument(companyInfo);
      
      // 3. Save to knowledge base with idempotent upsert (avoid duplicates)
      let documentId = 0;
      let chunksCreated = 0;

      if (knowledgeContent.length > 50 && companyInfo.website) {
        const result = await this.upsertKnowledgeBaseDocument(
          companyId,
          knowledgeContent,
          companyInfo.name || 'Company Profile',
          companyInfo.website,
          companyInfo.confidence
        );
        documentId = result.documentId;
        chunksCreated = result.chunksCreated;
      }

      const duration = Date.now() - startTime;
      logContext.system('Company intelligence saved', {
        event: 'company_intelligence_saved',
        severity: 'low',
        metadata: {
          userId,
          companyId,
          documentId,
          chunksCreated,
          duration,
          confidence: companyInfo.confidence
        }
      });

      return {
        documentId,
        chunksCreated,
        brandingProfileUpdated: !!user
      };

    } catch (error: any) {
      logger.error('Failed to save company intelligence', {
        error: error.message,
        userId,
        companyId
      });
      throw error;
    }
  }

  /**
   * Update only the RAG knowledge base without changing branding profile
   */
  async updateKnowledgeBase(
    companyInfo: CompanyInfo,
    companyId: number
  ): Promise<{ documentId: number; chunksCreated: number }> {
    const knowledgeContent = this.buildKnowledgeDocument(companyInfo);
    
    if (knowledgeContent.length < 50 || !companyInfo.website) {
      return { documentId: 0, chunksCreated: 0 };
    }

    return await this.upsertKnowledgeBaseDocument(
      companyId,
      knowledgeContent,
      companyInfo.name || 'Company Profile',
      companyInfo.website,
      companyInfo.confidence
    );
  }

  /**
   * Convert CompanyInfo to BrandingProfile format
   * Builds a comprehensive about statement that includes products and services
   */
  private convertToBrandingProfile(info: CompanyInfo): BrandingProfile {
    const products: CompanyProductService[] = (info.products || []).map(p => ({
      name: p.name,
      description: p.description,
      category: p.category,
      type: p.type
    }));

    const services: CompanyProductService[] = (info.services || []).map(s => ({
      name: s.name,
      description: s.description,
      category: s.category,
      type: s.type
    }));

    const socialMedia: SocialMediaLinks = {};
    if (info.linkedin) socialMedia.linkedin = info.linkedin;
    if (info.twitter) socialMedia.twitter = info.twitter;
    if (info.facebook) socialMedia.facebook = info.facebook;
    if (info.instagram) socialMedia.instagram = info.instagram;
    if (info.youtube) socialMedia.youtube = info.youtube;

    // Build comprehensive about statement including products and services
    const comprehensiveAbout = this.buildComprehensiveAbout(info, services, products);

    return {
      companyName: info.name,
      websiteUrl: info.website,
      aboutUs: comprehensiveAbout,
      fullAboutContent: info.fullAboutContent,
      logoUrl: info.logo,
      contactEmail: info.email,
      contactPhone: info.phone,
      streetAddress: info.address,
      industry: info.industry,
      founded: info.founded,
      companySize: info.size,
      products: products.length > 0 ? products : undefined,
      services: services.length > 0 ? services : undefined,
      socialMedia: Object.keys(socialMedia).length > 0 ? socialMedia : undefined,
      dataSource: 'website',
      lastFetchedAt: new Date().toISOString(),
      fetchConfidence: info.confidence
    };
  }

  /**
   * Build a comprehensive about statement that includes company description,
   * products, and services for use in bid generation
   */
  private buildComprehensiveAbout(
    info: CompanyInfo, 
    services: CompanyProductService[], 
    products: CompanyProductService[]
  ): string {
    const parts: string[] = [];

    // Start with the company description
    if (info.description) {
      parts.push(info.description);
    }

    // Add services section if available
    if (services.length > 0) {
      const serviceNames = services
        .filter(s => s.name && s.name.length > 2)
        .map(s => s.name)
        .slice(0, 15); // Limit to 15 services
      
      if (serviceNames.length > 0) {
        parts.push(`\n\nOur Services: ${serviceNames.join(', ')}.`);
      }
    }

    // Add products section if available
    if (products.length > 0) {
      const productNames = products
        .filter(p => p.name && p.name.length > 2)
        .map(p => p.name)
        .slice(0, 15); // Limit to 15 products
      
      if (productNames.length > 0) {
        parts.push(`\n\nOur Products & Capabilities: ${productNames.join(', ')}.`);
      }
    }

    // Add industry context if available
    if (info.industry) {
      parts.push(`\n\nIndustry: ${info.industry}.`);
    }

    return parts.join('') || info.description || '';
  }

  /**
   * Build a comprehensive knowledge document for RAG from company info
   */
  private buildKnowledgeDocument(info: CompanyInfo): string {
    const sections: string[] = [];

    // Company Overview Section
    const overviewParts: string[] = [];
    if (info.name) {
      overviewParts.push(`Company: ${info.name}`);
    }
    if (info.industry) {
      overviewParts.push(`Industry: ${info.industry}`);
    }
    if (info.founded) {
      overviewParts.push(`Founded: ${info.founded}`);
    }
    if (info.size) {
      overviewParts.push(`Company Size: ${info.size}`);
    }
    if (info.website) {
      overviewParts.push(`Website: ${info.website}`);
    }
    if (overviewParts.length > 0) {
      sections.push('## Company Overview\n' + overviewParts.join('\n'));
    }

    // About Us Section (full content)
    if (info.fullAboutContent) {
      sections.push('## About Us\n' + info.fullAboutContent);
    } else if (info.description) {
      sections.push('## About Us\n' + info.description);
    }

    // Services Section
    if (info.services && info.services.length > 0) {
      const servicesList = info.services
        .filter(s => s.name && s.name.length > 2)
        .map(s => {
          if (s.description) {
            return `- ${s.name}: ${s.description}`;
          }
          return `- ${s.name}`;
        })
        .join('\n');
      
      if (servicesList) {
        sections.push('## Services Offered\n' + servicesList);
      }
    }

    // Products/Capabilities Section
    if (info.products && info.products.length > 0) {
      const productsList = info.products
        .filter(p => p.name && p.name.length > 2)
        .map(p => {
          if (p.description) {
            return `- ${p.name}: ${p.description}`;
          }
          return `- ${p.name}`;
        })
        .join('\n');
      
      if (productsList) {
        sections.push('## Products & Capabilities\n' + productsList);
      }
    }

    // Contact Information Section
    const contactParts: string[] = [];
    if (info.email) contactParts.push(`Email: ${info.email}`);
    if (info.phone) contactParts.push(`Phone: ${info.phone}`);
    if (info.address) contactParts.push(`Address: ${info.address}`);
    if (contactParts.length > 0) {
      sections.push('## Contact Information\n' + contactParts.join('\n'));
    }

    // Social Media Section
    const socialParts: string[] = [];
    if (info.linkedin) socialParts.push(`LinkedIn: ${info.linkedin}`);
    if (info.twitter) socialParts.push(`Twitter: ${info.twitter}`);
    if (info.facebook) socialParts.push(`Facebook: ${info.facebook}`);
    if (info.instagram) socialParts.push(`Instagram: ${info.instagram}`);
    if (info.youtube) socialParts.push(`YouTube: ${info.youtube}`);
    if (socialParts.length > 0) {
      sections.push('## Social Media Presence\n' + socialParts.join('\n'));
    }

    return sections.join('\n\n');
  }

  /**
   * Generate a unique filename for website-sourced documents
   * Used for idempotent upsert operations
   */
  private getWebsiteDocumentFilename(sourceUrl: string, companyId: number): string {
    const urlHash = Buffer.from(sourceUrl).toString('base64').substring(0, 20);
    return `website_profile_${urlHash}_${companyId}.md`;
  }

  /**
   * Upsert a knowledge base document - update if exists, create if not
   * Prevents duplicate documents for the same website source
   */
  private async upsertKnowledgeBaseDocument(
    companyId: number,
    content: string,
    companyName: string,
    sourceUrl: string,
    confidence: number
  ): Promise<{ documentId: number; chunksCreated: number }> {
    const filename = this.getWebsiteDocumentFilename(sourceUrl, companyId);
    
    // Check for existing document from this source
    const existingDoc = await storage.findKnowledgeBaseDocumentBySource(companyId, sourceUrl);
    
    let document;
    
    if (existingDoc) {
      // Delete old chunks and update document
      await storage.deleteKnowledgeBaseChunksByDocument(existingDoc.id);
      document = await storage.updateKnowledgeBaseDocument(existingDoc.id, companyId, {
        content,
        fileSize: Buffer.byteLength(content, 'utf8'),
        isProcessed: false,
        chunkCount: 0
      });
      
      if (!document) {
        throw new Error('Failed to update existing knowledge base document');
      }
      
      logger.info('Updated existing website knowledge document', {
        documentId: existingDoc.id,
        sourceUrl
      });
    } else {
      // Create new document with source metadata in original name
      document = await storage.createKnowledgeBaseDocument({
        companyId,
        filename,
        originalName: `${companyName} - Company Profile (Website: ${sourceUrl}, Confidence: ${Math.round(confidence * 100)}%)`,
        fileType: 'md',
        fileSize: Buffer.byteLength(content, 'utf8'),
        content,
        isProcessed: false,
        chunkCount: 0
      });
      
      logger.info('Created new website knowledge document', {
        documentId: document.id,
        sourceUrl
      });
    }

    // Split content into chunks
    const chunks = await this.textSplitter.splitText(content);
    let chunksCreated = 0;

    // Create embeddings and save chunks
    for (let i = 0; i < chunks.length; i++) {
      const chunkContent = chunks[i];
      
      try {
        const embedding = await generateEmbedding(chunkContent);
        
        await storage.createKnowledgeBaseChunk({
          documentId: document.id,
          companyId,
          content: chunkContent,
          embedding,
          chunkIndex: i
        });
        
        chunksCreated++;
      } catch (error: any) {
        logger.warn('Failed to create embedding for chunk', {
          chunkIndex: i,
          error: error.message
        });
      }
    }

    // Update document as processed
    await storage.updateKnowledgeBaseDocument(document.id, companyId, {
      isProcessed: true,
      chunkCount: chunksCreated
    });

    return {
      documentId: document.id,
      chunksCreated
    };
  }
}

export const companyIntelligenceService = new CompanyIntelligenceService();
