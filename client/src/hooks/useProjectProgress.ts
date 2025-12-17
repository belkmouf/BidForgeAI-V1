import { useQuery } from '@tanstack/react-query';
import { getDocumentSummary, type DocumentSummaryResponse } from '@/lib/api';

export interface ProjectProgress {
  documentsProcessed: boolean;
  analysisComplete: boolean;
  conflictsReviewed: boolean;
  documentCount: number;
  processedCount: number;
  hasAnalysis: boolean;
  conflictCount: number;
  isLoading: boolean;
}

export function useProjectProgress(projectId: string | undefined): ProjectProgress {
  const { data: documentSummary, isLoading: docsLoading } = useQuery({
    queryKey: ['document-summary', projectId],
    queryFn: () => getDocumentSummary(projectId!),
    enabled: !!projectId,
    staleTime: 30000,
  });

  const { data: analysis, isLoading: analysisLoading } = useQuery({
    queryKey: ['rfp-analysis', projectId],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/analysis`, { credentials: 'include' });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!projectId,
    staleTime: 30000,
  });

  const { data: conflicts, isLoading: conflictsLoading } = useQuery({
    queryKey: ['conflicts', projectId],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/conflicts`, { credentials: 'include' });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!projectId,
    staleTime: 30000,
  });

  const documentCount = documentSummary?.stats?.documentCount || 0;
  const processedCount = documentSummary?.documents?.filter((d: any) => d.isProcessed)?.length || 0;
  const documentsProcessed = processedCount > 0;

  const hasAnalysis = !!analysis?.analysis;
  const analysisComplete = hasAnalysis;

  const conflictCount = conflicts?.conflicts?.length || 0;
  const conflictsReviewed = conflictCount === 0 || hasAnalysis;

  return {
    documentsProcessed,
    analysisComplete,
    conflictsReviewed,
    documentCount,
    processedCount,
    hasAnalysis,
    conflictCount,
    isLoading: docsLoading || analysisLoading || conflictsLoading,
  };
}
