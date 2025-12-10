import type { Project, Document, Bid } from '@shared/schema';
import { apiRequest } from './auth';

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

export async function listProjects() {
  const res = await apiRequest(`${API_BASE}/projects`);
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

export async function listDocuments(projectId: string) {
  const res = await apiRequest(`${API_BASE}/projects/${projectId}/documents`);
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
