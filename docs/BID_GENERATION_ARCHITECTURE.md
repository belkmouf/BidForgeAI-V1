# Bid Generation Architecture & Orchestration

## Overview

BidForge AI supports **two distinct bid generation paths**:

1. **Direct Bid Generation** - Fast, single-pass generation using RAG
2. **Multi-Agent Workflow** - Comprehensive analysis and generation using orchestrated AI agents

Both paths leverage the same underlying services (RAG, knowledge base, context building) but differ in their approach to bid creation.

---

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         CLIENT REQUEST                                   │
│                    POST /api/bids/projects/:id/generate                  │
└────────────────────────────┬────────────────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────────┐
                    │  Input Sanitization │
                    │  (Prompt Injection) │
                    └──────────┬──────────┘
                               │
                ┌───────────────┴───────────────┐
                │                               │
                ▼                               ▼
    ┌───────────────────────┐      ┌──────────────────────────┐
    │  DIRECT GENERATION    │      │  MULTI-AGENT WORKFLOW    │
    │  (Single Model)       │      │  (Orchestrated Agents)   │
    └───────────┬───────────┘      └──────────────┬───────────┘
                │                                  │
                ▼                                  ▼
    ┌───────────────────────┐      ┌──────────────────────────┐
    │ BidGenerationService  │      │ MultishotWorkflowOrch.   │
    │                       │      │                          │
    │ • buildContext()      │      │ • runWorkflow()          │
    │ • generateBid()       │      │ • Orchestrates 5 agents  │
    │ • RAG + Knowledge     │      │ • Progress tracking      │
    │ • Caching             │      │ • Retry logic            │
    └───────────┬───────────┘      └──────────────┬───────────┘
                │                                  │
                └──────────────┬───────────────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │   Context Builder   │
                    │  • Project Context  │
                    │  • RAG Search       │
                    │  • Knowledge Base   │
                    │  • Company Profile  │
                    │  • Sketch Analysis  │
                    └───────────┬─────────┘
                                │
                                ▼
                    ┌─────────────────────┐
                    │   AI Model Calls    │
                    │  • OpenAI GPT-4o    │
                    │  • Anthropic Claude │
                    │  • Google Gemini    │
                    │  • DeepSeek         │
                    │  • xAI Grok 4 Fast  │
                    └───────────┬─────────┘
                                │
                                ▼
                    ┌─────────────────────┐
                    │  HTML Sanitization  │
                    │  & Template Wrapper │
                    └───────────┬─────────┘
                                │
                                ▼
                    ┌─────────────────────┐
                    │   Database Save     │
                    │  • Bid record       │
                    │  • Version tracking │
                    │  • Cost tracking    │
                    └─────────────────────┘
```

---

## Path 1: Direct Bid Generation Flow

### High-Level Flow

```
User Request
    │
    ├─► Input Sanitization (instructions, tone)
    │
    ├─► BidGenerationService.generateBid()
    │   │
    │   ├─► buildContext() [PARALLEL]
    │   │   ├─► Fetch Project Metadata
    │   │   ├─► RAG Search (Vector + Full-text)
    │   │   ├─► Knowledge Base Search
    │   │   ├─► Company Profile Context
    │   │   └─► Sketch Analysis (if images exist)
    │   │
    │   ├─► Combine Contexts
    │   │
    │   ├─► generateBidWithModel()
    │   │   ├─► Retry Logic (exponential backoff)
    │   │   ├─► Token Usage Tracking
    │   │   └─► Cost Calculation
    │   │
    │   ├─► Sanitize HTML Output
    │   │
    │   ├─► Wrap in Premium Template
    │   │
    │   └─► Save to Database
    │
    └─► Return Bid Response
```

### Detailed Component Breakdown

#### 1. **BidGenerationService** (`server/lib/bid-generation-service.ts`)

**Purpose**: Unified service for all bid generation logic, eliminating code duplication.

**Key Methods**:

- **`buildContext()`**: Assembles all relevant context for bid generation
  - Executes searches in parallel for performance
  - Uses caching to reduce API costs
  - Combines: RAG chunks, knowledge base, company profile, sketch analysis

- **`generateBid()`**: Main generation method
  - Builds context
  - Calls AI model with retry logic
  - Sanitizes output
  - Wraps in template
  - Saves to database

- **`generateBidComparison()`**: Multi-model comparison
  - Generates bids with multiple AI models in parallel
  - Returns comparison results

**Context Building Process**:

```typescript
// Parallel execution for performance
const [project, ragResults, kbResults, companyProfile, sketchAnalysis] = await Promise.all([
  storage.getProject(projectId, companyId),
  searchService.searchDocuments(embedding, companyId, limit),
  companyId ? searchService.searchKnowledgeBase(embedding, companyId, limit) : Promise.resolve([]),
  getCompanyProfile(companyId),
  analyzeSketches(projectId, companyId)
]);
```

#### 2. **RAG (Retrieval-Augmented Generation)**

**Hybrid Search Strategy**:
- **Vector Similarity Search**: Uses pgvector cosine distance (`<=>`)
- **Full-Text Search**: PostgreSQL `tsvector` for keyword matching
- **Combined Ranking**: Merges results with deduplication

**Sources**:
- **Project Documents**: Current RFQ documents
- **Historical Projects**: "Closed-Won" projects from knowledge base
- **Knowledge Base Chunks**: Company-specific knowledge

#### 3. **Caching Strategy**

- **Embedding Cache**: Stores document embeddings to avoid recomputation
- **RAG Result Cache**: Caches search results for similar queries
- **Context Cache**: Caches full context for identical projects

---

## Path 2: Multi-Agent Workflow Flow

### High-Level Flow

```
User Request (Agent Workflow)
    │
    ├─► MultishotWorkflowOrchestrator.runWorkflow()
    │   │
    │   ├─► Initialize Workflow State
    │   │
    │   ├─► Fetch Project Summary
    │   │
    │   └─► Execute Workflow Steps (Sequential)
    │       │
    │       ├─► Step 1: INTAKE AGENT
    │       │   ├─► Load project documents
    │       │   ├─► Validate document availability
    │       │   └─► Return document metadata
    │       │
    │       ├─► Step 2: SKETCH AGENT (Conditional)
    │       │   ├─► Analyze project images/sketches
    │       │   ├─► Extract technical details
    │       │   └─► Return sketch analysis
    │       │
    │       ├─► Step 3: ANALYSIS AGENT
    │       │   ├─► Analyze RFQ documents
    │       │   ├─► Calculate quality/clarity/doability scores
    │       │   ├─► Identify risks and opportunities
    │       │   └─► Return analysis results
    │       │
    │       ├─► Step 4: DECISION AGENT
    │       │   ├─► Evaluate analysis results
    │       │   ├─► Make go/no-go decision
    │       │   ├─► Determine bid strategy
    │       │   └─► Return decision + strategy
    │       │
    │       ├─► Step 5: GENERATION AGENT
    │       │   ├─► Build comprehensive context
    │       │   ├─► Generate bid proposal
    │       │   ├─► Use compiled context (RAG + KB)
    │       │   └─► Return draft bid
    │       │
    │       └─► Step 6: REVIEW AGENT
    │           ├─► Review generated bid
    │           ├─► Score quality (0-100)
    │           ├─► Provide feedback
    │           └─► Decision: Pass or Retry
    │               │
    │               └─► If Retry: Loop back to GENERATION
    │
    └─► Save Final Bid to Database
```

### Agent Orchestration Details

#### Orchestrator Architecture

The system uses **two orchestrator implementations**:

1. **`AgentOrchestrator`** (`server/agents/orchestrator.ts`)
   - LangGraph-based state machine
   - Defines workflow graph with conditional edges
   - Handles state transitions

2. **`MultishotWorkflowOrchestrator`** (`server/agents/multishot-orchestrator.ts`)
   - Higher-level workflow coordinator
   - Manages agent execution sequence
   - Handles progress tracking and SSE events
   - Integrates with `MasterOrchestrator` for multi-shot refinement

#### Workflow Graph Structure (LangGraph)

```
┌──────────┐
│  START   │
└────┬─────┘
     │
     ▼
┌──────────────┐
│ INTAKE NODE  │ ──► Load & validate documents
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ ANALYSIS     │ ──► Analyze RFQ quality & risk
│ NODE         │
└──────┬───────┘
       │
       ├─► [Conditional: shouldProceedAfterAnalysis]
       │
       ├─► PROCEED ──► ┌──────────────┐
       │               │ DECISION     │ ──► Go/no-go + strategy
       │               │ NODE         │
       │               └──────┬───────┘
       │                      │
       │                      ▼
       │               ┌──────────────┐
       │               │ GENERATION   │ ──► Generate bid draft
       │               │ NODE         │
       │               └──────┬───────┘
       │                      │
       │                      ▼
       │               ┌──────────────┐
       │               │ REVIEW NODE  │ ──► Quality review
       │               └──────┬───────┘
       │                      │
       │                      ├─► [Conditional: shouldRetryGeneration]
       │                      │
       │                      ├─► PASS ──► ┌──────────────┐
       │                      │            │ COMPLETE     │
       │                      │            │ NODE         │
       │                      │            └──────┬───────┘
       │                      │                   │
       │                      └─► RETRY ──────────┘
       │
       └─► REJECT ──► ┌──────────────┐
                      │ COMPLETE     │
                      │ NODE         │
                      └──────┬───────┘
                             │
                             ▼
                      ┌──────────────┐
                      │     END      │
                      └──────────────┘
```

---

## Agent Details

### 1. Intake Agent

**Purpose**: Load and validate project documents

**Responsibilities**:
- Fetch all documents for the project
- Validate document availability
- Extract document metadata (name, type, content)
- Check processing status

**Input**: Project ID
**Output**: Array of `DocumentInfo` objects

**Code Location**: `server/agents/intake-agent.ts`

---

### 2. Sketch Agent (Conditional)

**Purpose**: Analyze project images and technical drawings

**Responsibilities**:
- Detect if project has images
- Extract technical details from sketches
- Identify construction requirements from visuals
- Return structured analysis

**Condition**: Only runs if `state.hasImages === true`

**Code Location**: `server/agents/sketch-agent.ts`

---

### 3. Analysis Agent

**Purpose**: Comprehensive RFQ document analysis

**Responsibilities**:
- Calculate quality scores (0-100)
- Assess clarity, doability, vendor risk
- Identify red flags and opportunities
- Generate recommendations

**Output Schema**:
```typescript
{
  qualityScore: number,
  clarityScore: number,
  doabilityScore: number,
  vendorRiskScore: number,
  overallRiskLevel: 'Low' | 'Medium' | 'High' | 'Critical',
  keyFindings: string[],
  redFlags: string[],
  opportunities: string[],
  recommendations: Array<{
    action: string,
    priority: 'high' | 'medium' | 'low',
    timeEstimate?: string
  }>
}
```

**AI Model**: Configurable (OpenAI GPT-4o, Anthropic Claude Sonnet 4, Google Gemini 2.5 Flash, DeepSeek, xAI Grok 4 Fast) with low temperature (0.1) for consistency

**Code Location**: `server/agents/analysis-agent.ts`

---

### 4. Decision Agent

**Purpose**: Strategic go/no-go decision and bid strategy

**Responsibilities**:
- Evaluate analysis results
- Apply decision rules:
  - Critical risk → REJECT
  - Low doability (< 30) → REJECT
  - High vendor risk → REJECT
  - Otherwise → PROCEED
- Determine bid strategy:
  - `aggressive`: Low price, high volume
  - `balanced`: Competitive pricing, standard approach
  - `conservative`: Premium pricing, risk mitigation
- Save decision log to database

**Decision Rules**:
```typescript
if (overallRiskLevel === 'Critical') → REJECT
if (doabilityScore < 30) → REJECT
if (vendorRiskScore > 80) → REJECT
else → PROCEED
```

**Output Schema**:
```typescript
{
  bidStrategy: {
    approach: 'aggressive' | 'balanced' | 'conservative',
    pricePositioning: 'low' | 'mid' | 'premium',
    focusAreas: string[],
    riskMitigations: Array<{ risk: string, mitigation: string }>,
    confidenceLevel: number,
    recommendedMargin: string
  },
  decisionLog: {
    decision: 'PROCEED' | 'REJECT',
    reason: string,
    triggeredRule: string
  }
}
```

**Code Location**: `server/agents/decision-agent.ts`

---

### 5. Generation Agent

**Purpose**: Generate the actual bid proposal

**Responsibilities**:
- Build comprehensive context using Context Builder
- Include: documents, analysis, decision strategy, project summary
- Generate bid content using AI model
- Format output (HTML/Markdown)
- Store intermediate artifacts

**Context Sources**:
- Compiled context from Context Builder (RAG + Knowledge Base)
- Analysis results from Analysis Agent
- Bid strategy from Decision Agent
- Project summary
- Previous review feedback (if retry)

**AI Model**: Configurable (OpenAI GPT-4o, Anthropic Claude Sonnet 4, Google Gemini 2.5 Flash, DeepSeek, xAI Grok 4 Fast)

**Code Location**: `server/agents/generation-agent.ts`

---

### 6. Review Agent

**Purpose**: Quality assurance for generated bids

**Responsibilities**:
- Evaluate bid completeness
- Assess clarity and organization
- Check competitiveness
- Verify technical accuracy
- Score quality (0-100)
- Provide actionable feedback

**Review Criteria**:
1. **Completeness** - Addresses all RFQ requirements
2. **Clarity** - Well-organized and clear
3. **Competitiveness** - Compelling value proposition
4. **Technical Accuracy** - Correct technical details
5. **Professionalism** - Appropriate tone and formatting

**Pass Threshold**: Score >= 70

**Retry Logic**:
- If score < 70: Return feedback and trigger retry
- Feedback is passed back to Generation Agent
- Maximum retries: Configurable (default: 3)

**Output Schema**:
```typescript
{
  passed: boolean,
  score: number (0-100),
  feedback: string[],
  suggestions: string[],
  attempts: number
}
```

**Code Location**: `server/agents/review-agent.ts`

---

## Orchestrator Implementation Details

### MasterOrchestrator

**Purpose**: Handles multi-shot refinement and agent execution

**Features**:
- Multi-shot agent support (agents that can refine based on feedback)
- Progress event emission
- Iteration tracking
- Feedback loop management

**Code Location**: `server/agents/master-orchestrator.ts`

### AgentOrchestrator (LangGraph)

**Purpose**: State machine-based workflow execution

**Key Methods**:

1. **`buildGraph()`**: Constructs the workflow graph
   ```typescript
   workflow
     .addNode('intake_node', this.createAgentNode('intake'))
     .addNode('analysis_node', this.createAgentNode('analysis'))
     .addNode('decision_node', this.createAgentNode('decision'))
     .addNode('generation_node', this.createAgentNode('generation'))
     .addNode('review_node', this.createAgentNode('review'))
     .addConditionalEdges('review_node', this.shouldRetryGeneration, {
       pass: 'complete_node',
       retry: 'generation_node'
     })
   ```

2. **`executeWithTimeout()`**: Executes agents with timeout and retry
   - Exponential backoff on retries
   - Configurable timeout per agent
   - Error handling and logging

3. **`createAgentNode()`**: Wraps agent execution in graph node
   - Handles state updates
   - Manages errors
   - Tracks execution time

**State Management**:
- Uses LangGraph's `BidWorkflowAnnotation` for state
- State is immutable and passed between nodes
- Each agent updates relevant state fields

**Code Location**: `server/agents/orchestrator.ts`

### MultishotWorkflowOrchestrator

**Purpose**: High-level workflow coordinator

**Features**:
- Sequential agent execution
- Progress tracking via SSE
- Project summary integration
- Workflow state persistence
- Cost estimation

**Workflow Steps**:
```typescript
const workflowSteps: WorkflowStep[] = [
  { name: 'intake', agent: intakeAgent, required: true },
  { name: 'sketch', agent: sketchAgent, required: false, condition: (state) => state.hasImages },
  { name: 'analysis', agent: analysisAgent, required: true },
  { name: 'decision', agent: decisionAgent, required: true },
  { name: 'generation', agent: generationAgent, required: true },
  { name: 'review', agent: reviewAgent, required: true },
];
```

**Execution Flow**:
1. Initialize workflow state
2. Fetch project summary
3. For each step:
   - Check conditional (if applicable)
   - Execute agent via `MasterOrchestrator`
   - Handle multi-shot refinement (if needed)
   - Update state with agent output
   - Check for early termination (decision agent rejection)
4. Save final bid to database
5. Calculate and log costs

**Code Location**: `server/agents/multishot-orchestrator.ts`

---

## Context Building System

### Context Builder Pattern

All agents use a **Context Builder** to compile relevant context from multiple memory tiers:

1. **Working Context**: Current agent's temporary state
2. **Relevant Artifacts**: Stored intermediate results
3. **Session Summary**: Summary of current workflow session
4. **Long-Term Memory**: Historical project data

**Context Builder Classes**:
- `IntakeContextBuilder`: Document-focused context
- `AnalysisContextBuilder`: Analysis-focused context
- `GenerationContextBuilder`: Full RAG + Knowledge Base context
- `ReviewContextBuilder`: Review-focused context

**Code Location**: `server/agents/context-builder.ts`

### Memory Management

**Three-Tier Memory System**:

1. **Working Context**: In-memory, per-agent state
2. **Session Memory**: Project-scoped, workflow session data
3. **Long-Term Memory**: Persistent, historical project data

**Memory Manager**: `server/agents/memory-manager.ts`

---

## Error Handling & Retry Logic

### Direct Generation Retry

**Location**: `BidGenerationService.generateBidWithModel()`

**Strategy**:
- Exponential backoff: `delay = 2^attempt * 1000ms`
- Maximum retries: Configurable (default: 3)
- Retries on: API errors, rate limits, timeouts

### Orchestrator Retry

**Location**: `AgentOrchestrator.executeWithTimeout()`

**Strategy**:
- Per-agent timeout: Configurable (default: 60s)
- Retry with exponential backoff
- Logs retry attempts
- Fails after max retries

### Review Retry Loop

**Location**: LangGraph conditional edge `shouldRetryGeneration`

**Strategy**:
- If review score < 70: Retry generation
- Pass feedback to Generation Agent
- Maximum retries: 3 attempts
- After max retries: Accept best attempt or fail

---

## Performance Optimizations

### 1. Parallel Context Building

```typescript
// All searches execute in parallel
const [ragResults, kbResults, project, companyProfile] = await Promise.all([
  searchService.searchDocuments(...),
  searchService.searchKnowledgeBase(...),
  storage.getProject(...),
  getCompanyProfile(...)
]);
```

### 2. Caching Strategy

- **Embedding Cache**: Avoids recomputing document embeddings
- **RAG Result Cache**: Caches search results
- **Context Cache**: Caches full context for identical projects

### 3. Database Indexing

- Vector indexes on `embedding` columns
- Full-text indexes on `content` columns
- Composite indexes on `(company_id, project_id)`

### 4. Streaming Progress (SSE)

- Real-time progress updates via Server-Sent Events
- Client can track workflow progress
- Reduces perceived latency

---

## Data Flow Summary

### Direct Generation Data Flow

```
User Input (instructions, tone, model)
    ↓
BidGenerationService
    ↓
Context Building (Parallel)
    ├─► RAG Search → Vector + Full-text
    ├─► Knowledge Base Search
    ├─► Company Profile
    └─► Sketch Analysis
    ↓
Context Combination
    ↓
AI Model Call (with retry)
    ↓
HTML Sanitization
    ↓
Template Wrapping
    ↓
Database Save
    ↓
Response to Client
```

### Multi-Agent Workflow Data Flow

```
User Input (workflow trigger)
    ↓
MultishotWorkflowOrchestrator
    ↓
Intake Agent → Document Metadata
    ↓
Sketch Agent (if images) → Sketch Analysis
    ↓
Analysis Agent → Analysis Results
    ↓
Decision Agent → Strategy + Go/No-Go
    ↓
Generation Agent → Bid Draft
    │   ├─► Context Builder (RAG + KB)
    │   └─► AI Model Call
    ↓
Review Agent → Quality Score + Feedback
    ├─► Pass (≥70) → Complete
    └─► Fail (<70) → Retry Generation (max 3x)
    ↓
Database Save
    ↓
Response to Client
```

---

## Key Differences: Direct vs Agent Workflow

| Aspect | Direct Generation | Multi-Agent Workflow |
|--------|------------------|---------------------|
| **Speed** | Fast (single pass) | Slower (multiple steps) |
| **Analysis** | Basic RAG context | Comprehensive analysis |
| **Decision Making** | None | Go/no-go + strategy |
| **Quality Assurance** | None | Review agent with retry |
| **Use Case** | Quick bids, known projects | Complex RFQs, new clients |
| **Cost** | Lower (1 AI call) | Higher (5-8 AI calls) |
| **Context** | RAG + Knowledge Base | Full analysis + strategy |

---

## Integration Points

### Route Handlers

**Direct Generation**: `server/routes/bids.ts`
- `POST /api/bids/projects/:id/generate`
- Uses `BidGenerationService`

**Agent Workflow**: `server/routes/agent-progress.ts` (implied)
- Triggers `MultishotWorkflowOrchestrator.runWorkflow()`
- SSE for progress updates

### Job Processors

**Background Jobs**: `server/lib/job-processors.ts`
- `processBidGeneration()` uses `BidGenerationService`
- Async processing for long-running generations

### Storage Layer

**Database Operations**: `server/storage.ts`
- Project/document retrieval
- Bid saving
- Decision log storage
- State persistence

---

## Security Considerations

1. **Input Sanitization**: All user inputs (instructions, tone) are sanitized to prevent prompt injection
2. **Company Isolation**: All queries are scoped by `companyId`
3. **Authentication**: All routes require JWT authentication
4. **HTML Sanitization**: AI-generated HTML is sanitized before storage/display
5. **Rate Limiting**: Applied at route level

---

## Monitoring & Observability

1. **Structured Logging**: All operations logged with context
2. **Progress Events**: SSE events for real-time tracking
3. **Cost Tracking**: Token usage and LMM costs recorded
4. **Performance Metrics**: Generation time, retry counts tracked
5. **Error Tracking**: Comprehensive error logging

---

## Future Enhancements

1. **Streaming Generation**: Real-time token streaming for long bids
2. **Custom Agent Workflows**: User-configurable agent sequences
3. **A/B Testing**: Compare different generation strategies
4. **Advanced Caching**: More sophisticated cache invalidation
5. **Multi-Model Ensemble**: Combine outputs from multiple models

---

## Conclusion

The BidForge AI bid generation system provides two complementary approaches:

- **Direct Generation**: Optimized for speed and efficiency
- **Multi-Agent Workflow**: Comprehensive analysis and quality assurance

Both paths leverage shared infrastructure (RAG, knowledge base, context building) while serving different use cases. The orchestrator system provides robust error handling, retry logic, and progress tracking for complex multi-step workflows.

