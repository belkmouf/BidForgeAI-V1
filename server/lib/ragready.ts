/**
 * RagReady.io Integration
 * 
 * This module provides integration with RagReady.io's RAG-as-a-Service API
 * for document intelligence and semantic search capabilities.
 */

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
 * Check if RagReady integration is configured
 */
export function isRagReadyConfigured(): boolean {
  return !!RAGREADY_API_KEY;
}

/**
 * Get authorization headers for RagReady API
 */
function getAuthHeaders(): HeadersInit {
  if (!RAGREADY_API_KEY) {
    throw new Error('RAGREADY_API_KEY is not configured');
  }
  
  return {
    'Authorization': `Bearer ${RAGREADY_API_KEY}`,
    'Content-Type': 'application/json',
  };
}

/**
 * Search documents using RagReady's semantic search
 * 
 * @param query - The search query
 * @param options - Search options
 * @returns Search results with relevance scores
 */
export async function searchRagReady(
  query: string,
  options: {
    topK?: number;
    collectionId?: string;
    metadataFilter?: Record<string, unknown>;
  } = {}
): Promise<RagReadySearchResponse> {
  if (!isRagReadyConfigured()) {
    throw new Error('RagReady integration is not configured. Please add RAGREADY_API_KEY.');
  }

  const { topK = 5, collectionId, metadataFilter } = options;

  try {
    const response = await fetch(`${RAGREADY_BASE_URL}/v1/search`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        query,
        top_k: topK,
        collection_id: collectionId,
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
 * 
 * @param options - List options
 * @returns List of documents
 */
export async function listRagReadyDocuments(
  options: {
    collectionId?: string;
    limit?: number;
    offset?: number;
  } = {}
): Promise<RagReadyDocumentsResponse> {
  if (!isRagReadyConfigured()) {
    throw new Error('RagReady integration is not configured. Please add RAGREADY_API_KEY.');
  }

  const { collectionId, limit = 50, offset = 0 } = options;

  try {
    const params = new URLSearchParams();
    if (collectionId) params.append('collection_id', collectionId);
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
 * 
 * @param documentId - The document ID
 * @returns Document details
 */
export async function getRagReadyDocument(documentId: string): Promise<RagReadyDocument> {
  if (!isRagReadyConfigured()) {
    throw new Error('RagReady integration is not configured. Please add RAGREADY_API_KEY.');
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
 * 
 * @param documentId - The document ID
 * @returns Document chunks
 */
export async function getRagReadyDocumentChunks(
  documentId: string
): Promise<{ chunks: Array<{ id: string; content: string; metadata?: Record<string, unknown> }> }> {
  if (!isRagReadyConfigured()) {
    throw new Error('RagReady integration is not configured. Please add RAGREADY_API_KEY.');
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
 * 
 * @param query - The search query
 * @param options - Search options
 * @returns Combined search results
 */
export async function hybridSearchWithRagReady(
  query: string,
  localResults: Array<{ content: string; score: number; source: string }>,
  options: { topK?: number } = {}
): Promise<Array<{ content: string; score: number; source: string }>> {
  const { topK = 10 } = options;

  // If RagReady is not configured, return local results only
  if (!isRagReadyConfigured()) {
    return localResults.slice(0, topK);
  }

  try {
    const ragReadyResponse = await searchRagReady(query, { topK });
    
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
  searchRagReady,
  listRagReadyDocuments,
  getRagReadyDocument,
  getRagReadyDocumentChunks,
  hybridSearchWithRagReady,
};
