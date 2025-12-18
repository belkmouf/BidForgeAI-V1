import type { Project, Document, Bid } from '@shared/schema';
import { apiRequest, useAuthStore } from './auth';

const API_BASE = '/api';

// Projects API
export async function createProject(data: { name: string; clientName: string; description?: string; status?: string; metadata?: any }) {
  const res = await apiRequest(`${API_BASE}/projects`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<Project>;
}

export async function listProjects(includeArchived: boolean = false) {
  const url = includeArchived 
    ? `${API_BASE}/projects?includeArchived=true`
    : `${API_BASE}/projects`;
  const res = await apiRequest(url);
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<Project[]>;
}

export async function getProject(id: string) {
  const res = await apiRequest(`${API_BASE}/projects/${id}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<Project>;
}

export async function updateProjectStatus(id: string, status: string) {
  const res = await apiRequest(`${API_BASE}/projects/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<Project>;
}

export async function archiveProject(id: string) {
  const res = await apiRequest(`${API_BASE}/projects/${id}/archive`, {
    method: 'PATCH',
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<Project>;
}

export async function unarchiveProject(id: string) {
  const res = await apiRequest(`${API_BASE}/projects/${id}/unarchive`, {
    method: 'PATCH',
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<Project>;
}

export async function deleteProject(id: string) {
  const res = await apiRequest(`${API_BASE}/projects/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<{ message: string }>;
}

// Documents API
export async function uploadDocument(projectId: string, file: File) {
  const formData = new FormData();
  formData.append('file', file);
  
  const res = await apiRequest(`${API_BASE}/projects/${projectId}/upload`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ error: 'Upload failed' }));
    throw new Error(errorData.error || 'Upload failed');
  }
  return res.json() as Promise<{ 
    message: string; 
    filesProcessed: number;
    totalChunks: number;
    documents: Array<{ filename: string; documentId: number; chunksCreated: number }>;
  }>;
}

export interface ProcessingProgress {
  stage: 'uploading' | 'parsing' | 'chunking' | 'embedding' | 'complete' | 'error';
  filename: string;
  currentChunk?: number;
  totalChunks?: number;
  percentage: number;
  message: string;
}

export async function uploadDocumentWithProgress(
  projectId: string, 
  file: File, 
  onProgress: (progress: ProcessingProgress) => void
): Promise<{ 
  message: string; 
  filesProcessed: number;
  totalChunks: number;
  documents: Array<{ filename: string; documentId: number; chunksCreated: number }>;
}> {
  const formData = new FormData();
  formData.append('file', file);
  
  onProgress({
    stage: 'uploading',
    filename: file.name,
    percentage: 5,
    message: 'Starting upload...'
  });
  
  const { accessToken } = useAuthStore.getState();
  const headers: HeadersInit = {};
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }
  
  const response = await fetch(`${API_BASE}/projects/${projectId}/upload-with-progress`, {
    method: 'POST',
    headers,
    body: formData,
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Upload failed' }));
    throw new Error(errorData.error || 'Upload failed');
  }
  
  const contentType = response.headers.get('Content-Type') || '';
  
  if (!contentType.includes('text/event-stream')) {
    const result = await response.json();
    onProgress({
      stage: 'complete',
      filename: file.name,
      percentage: 100,
      message: 'Processing complete!'
    });
    return result;
  }
  
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('Unable to read response stream');
  }
  
  const decoder = new TextDecoder();
  let buffer = '';
  let finalResult: any = null;
  
  while (true) {
    const { done, value } = await reader.read();
    
    if (done) break;
    
    buffer += decoder.decode(value, { stream: true });
    
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (line.startsWith('data: ')) {
        try {
          const data = JSON.parse(line.slice(6).trim());
          
          if (data.type === 'progress') {
            onProgress({
              stage: data.stage,
              filename: data.filename,
              currentChunk: data.currentChunk,
              totalChunks: data.totalChunks,
              percentage: data.percentage,
              message: data.message
            });
          } else if (data.type === 'complete') {
            finalResult = data;
            onProgress({
              stage: 'complete',
              filename: file.name,
              percentage: 100,
              message: 'Processing complete!'
            });
          } else if (data.type === 'error') {
            throw new Error(data.message);
          }
        } catch (e) {
          if (e instanceof Error && e.message !== 'Unexpected end of JSON input') {
            console.warn('Failed to parse SSE line:', line, e);
          }
        }
      }
    }
  }
  
  const trimmedBuffer = buffer.trim();
  if (trimmedBuffer.startsWith('data: ')) {
    try {
      const data = JSON.parse(trimmedBuffer.slice(6).trim());
      if (data.type === 'complete') {
        finalResult = data;
        onProgress({
          stage: 'complete',
          filename: file.name,
          percentage: 100,
          message: 'Processing complete!'
        });
      }
    } catch {
    }
  }
  
  if (finalResult) {
    return {
      message: 'Upload complete',
      filesProcessed: finalResult.filesProcessed,
      totalChunks: finalResult.totalChunks,
      documents: finalResult.documents
    };
  }
  
  throw new Error('No completion event received');
}

export async function listDocuments(projectId: string, bustCache: boolean = false) {
  const url = bustCache 
    ? `${API_BASE}/projects/${projectId}/documents?_=${Date.now()}`
    : `${API_BASE}/projects/${projectId}/documents`;
  const res = await apiRequest(url);
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<Document[]>;
}

export async function deleteDocument(documentId: number) {
  const res = await apiRequest(`${API_BASE}/documents/${documentId}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<{ message: string }>;
}

// AI Model type (order: Anthropic first, then Gemini, DeepSeek, OpenAI last)
export type AIModel = 'anthropic' | 'gemini' | 'deepseek' | 'openai';

// Agent Workflow API
export interface AgentWorkflowResponse {
  message: string;
  projectId: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  currentAgent?: string;
  mode: 'multishot';
}

export async function startAgentWorkflow(projectId: string, model?: AIModel): Promise<AgentWorkflowResponse> {
  const res = await apiRequest(`${API_BASE}/agents/multishot/process`, {
    method: 'POST',
    body: JSON.stringify({ projectId, model: model || 'anthropic' }),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ error: 'Failed to start agent workflow' }));
    throw new Error(errorData.error || 'Failed to start agent workflow');
  }
  return res.json();
}

export async function cancelAgentWorkflow(projectId: string): Promise<{ message: string }> {
  const res = await apiRequest(`${API_BASE}/agents/multishot/${projectId}/cancel`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getAgentWorkflowState(projectId: string): Promise<{
  status: string;
  currentAgent: string | null;
  outputs: Record<string, unknown>;
} | null> {
  const res = await apiRequest(`${API_BASE}/agent-progress/state/${projectId}`);
  if (!res.ok) {
    if (res.status === 404) return null;
    throw new Error(await res.text());
  }
  return res.json();
}

// SSE endpoint for agent progress
export function getAgentProgressSSEUrl(projectId: string): string {
  return `${API_BASE}/agent-progress/progress/${projectId}`;
}

// Bid Generation API
export async function generateBid(projectId: string, instructions: string, tone?: string, model?: AIModel) {
  const res = await apiRequest(`${API_BASE}/projects/${projectId}/generate`, {
    method: 'POST',
    body: JSON.stringify({ instructions, tone, model: model || 'anthropic' }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<{ html: string; rawContent?: string; chunksUsed: number; model: AIModel; bid?: { id: number } }>;
}

export async function refineBid(projectId: string, currentHtml: string, feedback: string, model?: AIModel) {
  const res = await apiRequest(`${API_BASE}/projects/${projectId}/refine`, {
    method: 'POST',
    body: JSON.stringify({ currentHtml, feedback, model: model || 'anthropic' }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<{ html: string; rawContent?: string; model: AIModel }>;
}

// Bids API
export async function listBids(projectId: string) {
  const res = await apiRequest(`${API_BASE}/projects/${projectId}/bids`);
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return data.bids as Bid[];
}

export async function getLatestBid(projectId: string) {
  const res = await apiRequest(`${API_BASE}/projects/${projectId}/bids/latest`);
  if (!res.ok) {
    if (res.status === 404) return null;
    throw new Error(await res.text());
  }
  const data = await res.json();
  return data.bid as Bid;
}

export async function getBidById(bidId: number) {
  const res = await apiRequest(`${API_BASE}/bids/${bidId}`);
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return data.bid as Bid;
}

// Template API
export async function wrapInTemplate(content: string, projectName: string, clientName: string, options?: object) {
  const res = await apiRequest(`${API_BASE}/templates/wrap`, {
    method: 'POST',
    body: JSON.stringify({ content, projectName, clientName, options }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<{ html: string }>;
}

// Dashboard API
export async function getDashboardStats() {
  const res = await apiRequest(`${API_BASE}/dashboard/stats`);
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<{
    pipeline: Record<string, number>;
    winRate: number;
    totalProjects: number;
  }>;
}

export async function getProjectCosts() {
  const res = await apiRequest(`${API_BASE}/dashboard/project-costs`);
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<Record<string, number>>;
}

// Public Sharing API
export async function generateShareLink(bidId: number) {
  const res = await apiRequest(`${API_BASE}/bids/${bidId}/share`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<{ shareUrl: string; shareToken: string }>;
}

export async function getPublicBid(token: string) {
  const res = await fetch(`${API_BASE}/public/bids/${token}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<{ bid: Bid; projectName: string; clientName: string }>;
}

// AI Instructions API
export interface AIInstruction {
  id: number;
  companyId: number;
  name: string;
  instructions: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export async function getAIInstructions() {
  const res = await apiRequest(`${API_BASE}/ai-instructions`);
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<{ instructions: AIInstruction[] }>;
}

export async function createAIInstruction(data: { name: string; instructions: string; isDefault?: boolean }) {
  const res = await apiRequest(`${API_BASE}/ai-instructions`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<{ instruction: AIInstruction }>;
}

export async function updateAIInstruction(id: number, data: { name?: string; instructions?: string }) {
  const res = await apiRequest(`${API_BASE}/ai-instructions/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<{ instruction: AIInstruction }>;
}

export async function deleteAIInstruction(id: number) {
  const res = await apiRequest(`${API_BASE}/ai-instructions/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<{ success: boolean }>;
}

// Templates API
export interface Template {
  id: number;
  companyId: number;
  name: string;
  description: string | null;
  category: string;
  sections: { title: string; content: string }[] | null;
  createdAt: string;
  updatedAt: string;
}

export async function getTemplates() {
  const res = await apiRequest(`${API_BASE}/templates`);
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<Template[]>;
}

export async function getTemplate(id: number) {
  const res = await apiRequest(`${API_BASE}/templates/${id}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<Template>;
}

export async function createTemplate(data: { name: string; description?: string; category: string; sections?: { title: string; content: string }[] }) {
  const res = await apiRequest(`${API_BASE}/templates`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<Template>;
}

export async function updateTemplate(id: number, data: { name?: string; description?: string; category?: string; sections?: { title: string; content: string }[] }) {
  const res = await apiRequest(`${API_BASE}/templates/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<Template>;
}

export async function deleteTemplate(id: number) {
  const res = await apiRequest(`${API_BASE}/templates/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<{ success: boolean }>;
}

export async function uploadTemplateFile(file: File, data: { name: string; description?: string; category: string }) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('name', data.name);
  formData.append('category', data.category);
  if (data.description) formData.append('description', data.description);

  const res = await apiRequest(`${API_BASE}/templates/upload`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<Template>;
}

// Document Summary API
export interface DocumentSummaryResponse {
  stats: {
    documentCount: number;
    totalSize: number;
    totalChunks: number;
    allProcessed: boolean;
  };
  readinessScore: {
    score: number;
    checks: {
      documentsUploaded: boolean;
      documentsProcessed: boolean;
      analysisComplete: boolean;
      missingInfo: string[];
    };
  };
  documents: Array<{
    id: number;
    filename: string;
    description?: string;
    isProcessed: boolean;
    uploadedAt: string;
    pageCount?: number;
    fileSize?: number;
    fileType?: string;
    keyInformation?: {
      projectType?: string;
      location?: string;
      deadline?: string;
      budget?: string;
      requirements?: string[];
    };
    extractedEntities?: Array<{
      type: string;
      value: string;
      confidence: number;
      context?: string;
    }>;
    processingTimeMs?: number;
    processingStatus?: string;
    chunkCount: number;
    status: string;
  }>;
  projectSummary: {
    id: number;
    projectId: string;
    overview?: string;
    scopeOfWork?: string[];
    keyRequirements?: {
      budget?: string;
      timeline?: string;
      certifications?: string[];
      labor?: string;
      insurance?: string[];
      bonding?: string;
    };
    riskFactors?: string[];
    opportunities?: string[];
    missingInformation?: string[];
    coverageScore?: number;
    completenessScore?: number;
    isUserEdited: boolean;
    generatedAt: string;
    updatedAt: string;
  } | null;
  analysis: {
    coverageScore: number;
    conflictCount: number;
    winProbability: number;
    riskLevel: string;
  };
}

export async function getDocumentSummary(projectId: string) {
  const res = await apiRequest(`${API_BASE}/projects/${projectId}/document-summary`);
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<DocumentSummaryResponse>;
}

export async function generateProjectSummary(projectId: string) {
  const res = await apiRequest(`${API_BASE}/projects/${projectId}/generate-summary`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<{ summary: DocumentSummaryResponse['projectSummary'] }>;
}

export async function updateProjectSummary(projectId: string, updates: Partial<DocumentSummaryResponse['projectSummary']>) {
  const res = await apiRequest(`${API_BASE}/projects/${projectId}/summary`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<{ summary: DocumentSummaryResponse['projectSummary'] }>;
}

export async function extractDocumentEntities(documentId: number) {
  const res = await apiRequest(`${API_BASE}/documents/${documentId}/extract-entities`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<{
    keyInformation: any;
    extractedEntities: any[];
    processingTimeMs: number;
  }>;
}

export async function exportProjectSummary(projectId: string, format: 'pdf' | 'json' = 'pdf') {
  const res = await apiRequest(`${API_BASE}/projects/${projectId}/summary/export?format=${format}`);
  if (!res.ok) throw new Error(await res.text());

  if (format === 'pdf') {
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `project-summary-${projectId}.pdf`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  } else {
    return res.json();
  }
}

// ============ DOCUMENT SUMMARY API CALLS ============

export async function getDocumentSummary(documentId: number) {
  const res = await apiRequest(`${API_BASE}/documents/${documentId}/summary`);
  if (!res.ok) {
    if (res.status === 404) {
      throw new Error('Summary not found');
    }
    throw new Error('Failed to fetch document summary');
  }
  return res.json();
}

export async function updateSummary(
  summaryId: number,
  updates: {
    summaryContent?: string;
    structuredData?: any;
  }
) {
  const res = await apiRequest(`${API_BASE}/summaries/${summaryId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(updates),
  });
  if (!res.ok) throw new Error('Failed to update summary');
  return res.json();
}

export async function getProjectSummaries(projectId: string) {
  const res = await apiRequest(`${API_BASE}/projects/${projectId}/summaries`);
  if (!res.ok) throw new Error('Failed to fetch project summaries');
  return res.json();
}

export async function regenerateDocumentSummary(documentId: number) {
  const res = await apiRequest(`${API_BASE}/documents/${documentId}/regenerate-summary`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error('Failed to regenerate summary');
  return res.json();
}
