import { z } from 'zod';
import { Annotation } from '@langchain/langgraph';

export const DocumentInfo = z.object({
  id: z.number(),
  name: z.string(),
  type: z.string(),
  content: z.string().optional(),
  processedAt: z.date().optional(),
});

export const AnalysisResult = z.object({
  qualityScore: z.number().min(0).max(100),
  clarityScore: z.number().min(0).max(100),
  doabilityScore: z.number().min(0).max(100),
  vendorRiskScore: z.number().min(0).max(100),
  overallRiskLevel: z.enum(['Low', 'Medium', 'High', 'Critical']),
  keyFindings: z.array(z.string()),
  redFlags: z.array(z.string()),
  opportunities: z.array(z.string()),
  recommendations: z.array(z.object({
    action: z.string(),
    priority: z.enum(['high', 'medium', 'low']),
    timeEstimate: z.string().optional(),
  })),
});

export const DraftResult = z.object({
  content: z.string(),
  format: z.enum(['html', 'markdown', 'plain']),
  sections: z.array(z.object({
    title: z.string(),
    content: z.string(),
  })).optional(),
  generatedAt: z.date(),
  modelUsed: z.string(),
});

export const ReviewResult = z.object({
  passed: z.boolean(),
  score: z.number().min(0).max(100),
  feedback: z.array(z.string()),
  suggestions: z.array(z.string()),
  attempts: z.number(),
  reviewedAt: z.date(),
});

export const BidStrategy = z.object({
  approach: z.enum(['aggressive', 'balanced', 'conservative']),
  pricePositioning: z.enum(['low', 'mid', 'premium']),
  focusAreas: z.array(z.string()),
  riskMitigations: z.array(z.object({
    risk: z.string(),
    mitigation: z.string(),
  })),
  confidenceLevel: z.number().min(0).max(100),
  recommendedMargin: z.string(),
});

export const AgentStateSchema = z.object({
  projectId: z.string(),
  userId: z.number(),
  
  currentAgent: z.string(),
  status: z.enum(['pending', 'running', 'completed', 'failed', 'cancelled']),
  
  documents: z.array(DocumentInfo).optional(),
  analysis: AnalysisResult.optional(),
  bidStrategy: BidStrategy.optional(),
  draft: DraftResult.optional(),
  review: ReviewResult.optional(),
  
  errors: z.array(z.string()).optional(),
  logs: z.array(z.string()).optional(),
  
  startedAt: z.date(),
  updatedAt: z.date(),
  completedAt: z.date().optional(),
});

export type AgentState = z.infer<typeof AgentStateSchema>;
export type DocumentInfoType = z.infer<typeof DocumentInfo>;
export type AnalysisResultType = z.infer<typeof AnalysisResult>;
export type BidStrategyType = z.infer<typeof BidStrategy>;
export type DraftResultType = z.infer<typeof DraftResult>;
export type ReviewResultType = z.infer<typeof ReviewResult>;

export const BidWorkflowAnnotation = Annotation.Root({
  projectId: Annotation<string>({
    reducer: (_, b) => b,
    default: () => '',
  }),
  userId: Annotation<number>({
    reducer: (_, b) => b,
    default: () => 0,
  }),
  currentAgent: Annotation<string>({
    reducer: (_, b) => b,
    default: () => 'intake',
  }),
  status: Annotation<'pending' | 'running' | 'completed' | 'failed' | 'cancelled'>({
    reducer: (_, b) => b,
    default: () => 'pending',
  }),
  documents: Annotation<DocumentInfoType[]>({
    reducer: (a, b) => (b && b.length > 0) ? b : (a || []),
    default: () => [],
  }),
  analysis: Annotation<AnalysisResultType | undefined>({
    reducer: (a, b) => b !== undefined ? b : a,
    default: () => undefined,
  }),
  bidStrategy: Annotation<BidStrategyType | undefined>({
    reducer: (a, b) => b !== undefined ? b : a,
    default: () => undefined,
  }),
  draft: Annotation<DraftResultType | undefined>({
    reducer: (a, b) => b !== undefined ? b : a,
    default: () => undefined,
  }),
  review: Annotation<ReviewResultType | undefined>({
    reducer: (a, b) => b !== undefined ? b : a,
    default: () => undefined,
  }),
  errors: Annotation<string[]>({
    reducer: (a, b) => [...(a || []), ...(b || [])],
    default: () => [],
  }),
  logs: Annotation<string[]>({
    reducer: (a, b) => [...(a || []), ...(b || [])],
    default: () => [],
  }),
  startedAt: Annotation<Date>({
    reducer: (a, b) => b || a,
    default: () => new Date(),
  }),
  updatedAt: Annotation<Date>({
    reducer: (_, b) => b || new Date(),
    default: () => new Date(),
  }),
  completedAt: Annotation<Date | undefined>({
    reducer: (_, b) => b,
    default: () => undefined,
  }),
});

export type BidWorkflowState = typeof BidWorkflowAnnotation.State;
