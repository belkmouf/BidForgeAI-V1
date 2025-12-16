import type { Project, Document, Bid } from '@shared/schema';
import { apiRequest, useAuthStore } from './auth';

const API_BASE = '/api';

// Projects API
export async function createProject(data: { name: string; clientName: string; status?: string; metadata?: any }) {
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
