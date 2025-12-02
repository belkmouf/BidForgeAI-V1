import type { Project, Document } from '@shared/schema';

const API_BASE = '/api';

// Projects API
export async function createProject(data: { name: string; clientName: string; status?: string; metadata?: any }) {
  const res = await fetch(`${API_BASE}/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<Project>;
}

export async function listProjects() {
  const res = await fetch(`${API_BASE}/projects`);
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<Project[]>;
}

export async function getProject(id: string) {
  const res = await fetch(`${API_BASE}/projects/${id}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<Project>;
}

export async function updateProjectStatus(id: string, status: string) {
  const res = await fetch(`${API_BASE}/projects/${id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<Project>;
}

// Documents API
export async function uploadDocument(projectId: string, file: File) {
  const formData = new FormData();
  formData.append('file', file);
  
  const res = await fetch(`${API_BASE}/projects/${projectId}/upload`, {
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
  const res = await fetch(`${API_BASE}/projects/${projectId}/documents`);
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<Document[]>;
}

// AI Model type
export type AIModel = 'openai' | 'anthropic' | 'gemini' | 'deepseek';

// Bid Generation API
export async function generateBid(projectId: string, instructions: string, tone?: string, model?: AIModel) {
  const res = await fetch(`${API_BASE}/projects/${projectId}/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ instructions, tone, model: model || 'openai' }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<{ html: string; chunksUsed: number; model: AIModel }>;
}

export async function refineBid(projectId: string, currentHtml: string, feedback: string, model?: AIModel) {
  const res = await fetch(`${API_BASE}/projects/${projectId}/refine`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ currentHtml, feedback, model: model || 'openai' }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<{ html: string; model: AIModel }>;
}

// Dashboard API
export async function getDashboardStats() {
  const res = await fetch(`${API_BASE}/dashboard/stats`);
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<{
    pipeline: Record<string, number>;
    winRate: number;
    totalProjects: number;
  }>;
}
