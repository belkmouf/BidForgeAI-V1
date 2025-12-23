/**
 * RagReady.io Integration
 * 
 * This module provides integration with RagReady.io's RAG-as-a-Service API
 * for document intelligence and semantic search capabilities.
 * 
 * Security: API key is stored in environment variables (RAGREADY_API_KEY)
 * Company isolation: Each company has their own collection ID stored in settings
 */

import { db } from '../db';
import { companies } from '@shared/schema';
import { eq } from 'drizzle-orm';

const RAGREADY_API_KEY = process.env.RAGREADY_API_KEY;
const RAGREADY_BASE_URL = process.env.RAGREADY_BASE_URL || 'https://www.ragready.io';

interface RagReadySearchResult {
  chunk_id: string;
  content: string;
  score: number;
  metadata?: {
    document_id?: string;
    page?: number;
    source?: string;
    [key: string]: unknown;
  };
}

interface RagReadySearchResponse {
  results: RagReadySearchResult[];
  query: string;
  total_results?: number;
}

interface RagReadyDocument {
  id: string;
  filename: string;
  status: string;
  created_at: string;
  chunk_count?: number;
  metadata?: Record<string, unknown>;
}

interface RagReadyDocumentsResponse {
  documents: RagReadyDocument[];
  total?: number;
}

/**
 * Get RagReady collection ID for a specific company
 * Collection IDs partition data in RagReady - no sensitive data stored
 */
export async function getCompanyCollectionId(companyId: number): Promise<string | null> {
  try {
    const [company] = await db
      .select()
      .from(companies)
      .where(eq(companies.id, companyId))
      .limit(1);

    if (!company) return null;

    const settings = company.settings as Record<string, any> | null;
    return settings?.ragreadyCollectionId || null;
  } catch (error) {
    console.error('[RagReady] Error fetching company collection:', error);
    return null;
  }
}

/**
 * Save RagReady collection ID for a company
 * Only stores the collection ID (non-sensitive) - API key is in env vars
 */
export async function saveCompanyCollectionId(
  companyId: number, 
  collectionId: string
): Promise<boolean> {
  try {
    const [company] = await db
      .select()
      .from(companies)
      .where(eq(companies.id, companyId))
      .limit(1);

    if (!company) return false;

    const currentSettings = (company.settings as Record<string, any>) || {};
    const updatedSettings = {
      ...currentSettings,
      ragreadyCollectionId: collectionId,
    };

    await db
      .update(companies)
      .set({ 
        settings: updatedSettings,
        updatedAt: new Date()
      })
      .where(eq(companies.id, companyId));

    return true;
  } catch (error) {
    console.error('[RagReady] Error saving company collection:', error);
    return false;
  }
}

/**
 * Remove RagReady collection ID from a company
 */
export async function removeCompanyCollectionId(companyId: number): Promise<boolean> {
  try {
    const [company] = await db
      .select()
      .from(companies)
      .where(eq(companies.id, companyId))
      .limit(1);

    if (!company) return false;

    const currentSettings = (company.settings as Record<string, any>) || {};
    const { ragreadyCollectionId, ...restSettings } = currentSettings;

    await db
      .update(companies)
      .set({ 
        settings: restSettings,
        updatedAt: new Date()
      })
      .where(eq(companies.id, companyId));

    return true;
  } catch (error) {
    console.error('[RagReady] Error removing company collection:', error);
    return false;
  }
}

/**
 * Check if RagReady integration is configured (API key in env vars)
 */
export function isRagReadyConfigured(): boolean {
  return !!RAGREADY_API_KEY;
}

/**
 * Get authorization headers for RagReady API
 */
function getAuthHeaders(): HeadersInit {
  if (!RAGREADY_API_KEY) {
    throw new Error('RAGREADY_API_KEY is not configured in environment variables');
  }
  
  return {
    'Authorization': `Bearer ${RAGREADY_API_KEY}`,
    'Content-Type': 'application/json',
  };
}

/**
 * Get collection ID for a company (for data isolation)
 */
async function getEffectiveCollectionId(companyId?: number, explicitCollectionId?: string): Promise<string | undefined> {
  // Explicit collection ID takes priority
  if (explicitCollectionId) return explicitCollectionId;
  
  // Try company-specific collection
  if (companyId) {
    const companyCollection = await getCompanyCollectionId(companyId);
    if (companyCollection) return companyCollection;
  }
  
  return undefined;
}

/**
 * Search documents using RagReady's semantic search
 */
export async function searchRagReady(
  query: string,
  options: {
    companyId?: number;
    topK?: number;
    collectionId?: string;
    metadataFilter?: Record<string, unknown>;
  } = {}
): Promise<RagReadySearchResponse> {
  if (!isRagReadyConfigured()) {
    throw new Error('RagReady integration is not configured. Please add RAGREADY_API_KEY to your environment.');
  }

  const { companyId, topK = 5, collectionId, metadataFilter } = options;
  const effectiveCollectionId = await getEffectiveCollectionId(companyId, collectionId);

  try {
    const response = await fetch(`${RAGREADY_BASE_URL}/v1/search`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        query,
        top_k: topK,
        collection_id: effectiveCollectionId,
        metadata_filter: metadataFilter,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`RagReady search failed: ${response.status} - ${errorText}`);
    }

    const data = await response.json() as RagReadySearchResponse;
    return data;
  } catch (error: any) {
    console.error('[RagReady] Search error:', error.message);
    throw error;
  }
}

/**
 * List documents from RagReady
 */
export async function listRagReadyDocuments(
  options: {
    companyId?: number;
    collectionId?: string;
    limit?: number;
    offset?: number;
  } = {}
): Promise<RagReadyDocumentsResponse> {
  if (!isRagReadyConfigured()) {
    throw new Error('RagReady integration is not configured. Please add RAGREADY_API_KEY to your environment.');
  }

  const { companyId, collectionId, limit = 50, offset = 0 } = options;
  const effectiveCollectionId = await getEffectiveCollectionId(companyId, collectionId);

  try {
    const params = new URLSearchParams();
    if (effectiveCollectionId) params.append('collection_id', effectiveCollectionId);
    if (limit) params.append('limit', String(limit));
    if (offset) params.append('offset', String(offset));

    const url = `${RAGREADY_BASE_URL}/v1/documents${params.toString() ? '?' + params.toString() : ''}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`RagReady list documents failed: ${response.status} - ${errorText}`);
    }

    const data = await response.json() as RagReadyDocumentsResponse;
    return data;
  } catch (error: any) {
    console.error('[RagReady] List documents error:', error.message);
    throw error;
  }
}

/**
 * Get a specific document's details from RagReady
 */
export async function getRagReadyDocument(documentId: string): Promise<RagReadyDocument> {
  if (!isRagReadyConfigured()) {
    throw new Error('RagReady integration is not configured. Please add RAGREADY_API_KEY to your environment.');
  }

  try {
    const response = await fetch(`${RAGREADY_BASE_URL}/v1/documents/${documentId}`, {
      method: 'GET',
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`RagReady get document failed: ${response.status} - ${errorText}`);
    }

    const data = await response.json() as RagReadyDocument;
    return data;
  } catch (error: any) {
    console.error('[RagReady] Get document error:', error.message);
    throw error;
  }
}

/**
 * Get document chunks/content from RagReady
 */
export async function getRagReadyDocumentChunks(
  documentId: string
): Promise<{ chunks: Array<{ id: string; content: string; metadata?: Record<string, unknown> }> }> {
  if (!isRagReadyConfigured()) {
    throw new Error('RagReady integration is not configured. Please add RAGREADY_API_KEY to your environment.');
  }

  try {
    const response = await fetch(`${RAGREADY_BASE_URL}/v1/documents/${documentId}/chunks`, {
      method: 'GET',
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`RagReady get chunks failed: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return data;
  } catch (error: any) {
    console.error('[RagReady] Get chunks error:', error.message);
    throw error;
  }
}

/**
 * Enhanced search that combines RagReady results with local context
 */
export async function hybridSearchWithRagReady(
  query: string,
  localResults: Array<{ content: string; score: number; source: string }>,
  options: { companyId?: number; topK?: number } = {}
): Promise<Array<{ content: string; score: number; source: string }>> {
  const { companyId, topK = 10 } = options;

  if (!isRagReadyConfigured()) {
    return localResults.slice(0, topK);
  }

  try {
    const ragReadyResponse = await searchRagReady(query, { companyId, topK });
    
    // Convert RagReady results to unified format
    const ragReadyResults = ragReadyResponse.results.map(r => ({
      content: r.content,
      score: r.score,
      source: `RagReady: ${r.metadata?.document_id || 'External Document'}`,
    }));

    // Merge and sort by score
    const combined = [...localResults, ...ragReadyResults]
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);

    return combined;
  } catch (error: any) {
    console.warn('[RagReady] Hybrid search falling back to local results:', error.message);
    return localResults.slice(0, topK);
  }
}

export default {
  isRagReadyConfigured,
  getCompanyCollectionId,
  saveCompanyCollectionId,
  removeCompanyCollectionId,
  searchRagReady,
  listRagReadyDocuments,
  getRagReadyDocument,
  getRagReadyDocumentChunks,
  hybridSearchWithRagReady,
};
