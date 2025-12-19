# BidForge AI Agents Architecture

## Overview

BidForge AI uses a multi-agent orchestration system to process RFP documents and generate professional bid proposals. The system is coordinated by a **Master Orchestrator** that manages agent execution with time-window based scheduling and optional feedback refinement loops.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          MASTER ORCHESTRATOR                                 │
│                    (Claude Sonnet - Anthropic API)                          │
│  • Coordinates all agent execution                                          │
│  • Manages time budgets per agent                                           │
│  • Evaluates outputs for generation agent refinement                        │
│  • Emits real-time progress events via SSE                                  │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    │               │               │
                    ▼               ▼               ▼
        ┌───────────────┐   ┌───────────────┐   ┌───────────────┐
        │  INTAKE       │   │   SKETCH      │   │  ANALYSIS     │
        │  AGENT        │──▶│   AGENT       │──▶│  AGENT        │
        │  (30s)        │   │  (60s)        │   │  (45s)        │
        └───────────────┘   └───────────────┘   └───────────────┘
                                                        │
                    ┌───────────────────────────────────┘
                    │
                    ▼
        ┌───────────────┐   ┌───────────────┐   ┌───────────────┐
        │  DECISION     │   │  GENERATION   │   │   REVIEW      │
        │  AGENT        │──▶│  AGENT        │──▶│   AGENT       │
        │  (30s)        │   │  (150s)       │   │  (45s)        │
        └───────────────┘   └───────────────┘   └───────────────┘
                                    ▲
                                    │ Feedback Loop
                                    │ (if score < 75)
                                    └─────────────────
```

---

## Agent Details

### 1. Intake Agent
**File:** `server/agents/intake-agent.ts`

**Purpose:** Loads and validates project documents from the database.

**Time Budget:** 30 seconds

**Responsibilities:**
- Fetches all documents for the specified project from PostgreSQL
- Validates that documents exist and are processed
- Creates document info objects with metadata (ID, name, type, content)
- Reports unprocessed document counts

**Input:**
- Project ID
- Existing workflow state (checks if documents already loaded)

**Output:**
```typescript
{
  documents: DocumentInfoType[],
  logs: string[]
}
```

**Error Conditions:**
- No documents found for project

---

### 2. Sketch Agent
**File:** `server/agents/sketch-agent.ts`

**Purpose:** Analyzes construction drawings and sketches using computer vision.

**Time Budget:** 60 seconds

**Responsibilities:**
- Processes image files (drawings, sketches, blueprints)
- Extracts dimensions, materials, and specifications
- Identifies components and quantities
- Detects regional building codes and standards
- Runs via Python subprocess for vision model integration

**Input:**
- Image file paths
- Project context for better analysis
- Existing analysis (skips if already processed during upload)

**Output:**
```typescript
{
  sketchId: string,
  documentType: string,        // e.g., "Floor Plan", "Elevation"
  projectPhase: string,        // e.g., "Design", "Construction"
  dimensions: Array<{
    type: string,
    value: number,
    unit: string,
    location: string | null,
    confidence: number
  }>,
  materials: Array<{
    name: string,
    grade: string | null,
    specification: string | null,
    quantity: number | null,
    unit: string | null,
    standard: string | null,
    confidence: number
  }>,
  specifications: string[],
  components: Array<{ type, size, count, location, confidence }>,
  quantities: Record<string, unknown>,
  standards: string[],
  regionalCodes: string[],     // GCC compliance codes
  annotations: string[],
  confidenceScore: number,
  processingTime: number,
  warnings: string[]
}
```

**Note:** Sketch analysis can be performed during document upload, in which case this agent reuses the existing analysis.

---

### 3. Analysis Agent
**File:** `server/agents/analysis-agent.ts`

**Purpose:** Analyzes RFQ documents to assess quality, risk, and feasibility.

**Time Budget:** 45 seconds

**Supported Models:**
- Anthropic Claude Sonnet 4
- Google Gemini 2.5 Flash
- xAI Grok 4 Fast
- DeepSeek Chat
- OpenAI GPT-4o

**Responsibilities:**
- Evaluates document quality and clarity
- Assesses project doability
- Calculates vendor risk score
- Identifies key findings and red flags
- Spots opportunities for competitive advantage
- Generates prioritized recommendations

**Input:**
- Documents array from Intake Agent
- Compiled context (project summary, historical data)

**Output:**
```typescript
{
  qualityScore: number,        // 0-100
  clarityScore: number,        // 0-100
  doabilityScore: number,      // 0-100
  vendorRiskScore: number,     // 0-100
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

---

### 4. Decision Agent
**File:** `server/agents/decision-agent.ts`

**Purpose:** Makes strategic go/no-go decisions and determines bid strategy.

**Time Budget:** 30 seconds

**Responsibilities:**
- Evaluates analysis scores against thresholds
- Makes PROCEED/REJECT decision
- Determines bid strategy (aggressive, balanced, conservative)
- Logs decision reasoning to database for audit trail

**Decision Rules:**
| Condition | Threshold | Decision |
|-----------|-----------|----------|
| Risk Level | Critical | REJECT |
| Doability Score | < 30% | REJECT |
| Vendor Risk Score | > 80% | REJECT |
| Otherwise | - | PROCEED |

**Bid Strategies:**
- **Aggressive:** High doability, low risk → competitive pricing
- **Balanced:** Moderate scores → standard approach
- **Conservative:** Higher risk indicators → risk mitigation focus

**Output:**
```typescript
{
  bidStrategy: {
    approach: 'aggressive' | 'balanced' | 'conservative',
    pricingApproach: string,
    riskMitigation: string[],
    keyDifferentiators: string[]
  },
  decisionLog: {
    decision: 'PROCEED' | 'REJECT',
    reason: string,
    triggeredRule: string,
    doabilityScore: number,
    vendorRiskScore: number
  }
}
```

---

### 5. Generation Agent
**File:** `server/agents/generation-agent.ts`

**Purpose:** Generates professional HTML bid proposals based on analyzed RFQ documents.

**Time Budget:** 150 seconds (longest - DeepSeek needs ~100-120s)

**Refinement:** YES (only agent with feedback loop)

**Supported Models:**
- Anthropic Claude Sonnet 4
- Google Gemini 2.5 Flash
- xAI Grok 4 Fast
- DeepSeek Chat (default)
- OpenAI GPT-4o

**Responsibilities:**
- Generates comprehensive bid proposal in HTML format
- Incorporates analysis findings and recommendations
- Applies company branding (colors, logo, fonts)
- Follows selected tone (professional, persuasive, technical, concise)
- Addresses all RFP requirements identified in analysis
- Uses RAG context from historical winning bids

**Bid Sections Generated:**
1. Executive Summary
2. Company Overview
3. Technical Approach
4. Project Understanding
5. Methodology & Work Plan
6. Team & Qualifications
7. Timeline & Milestones
8. Pricing Summary
9. Risk Mitigation
10. Terms & Conditions
11. Appendices

**Input:**
- Documents from Intake
- Analysis from Analysis Agent
- Bid strategy from Decision Agent
- Company branding profile
- Selected AI model
- Optional refinement feedback

**Output:**
```typescript
{
  content: string,           // Full HTML bid document
  rawContent: string,        // Clean HTML for editor
  summary: string,
  wordCount: number,
  sectionsIncluded: string[]
}
```

---

### 6. Review Agent
**File:** `server/agents/review-agent.ts`

**Purpose:** Reviews generated bid proposals for quality and completeness.

**Time Budget:** 45 seconds

**Model:** OpenAI GPT-4o (fixed - for consistency)

**Responsibilities:**
- Evaluates completeness against RFQ requirements
- Assesses clarity and organization
- Checks competitiveness of value proposition
- Verifies technical accuracy
- Validates professional tone and formatting
- Provides actionable improvement suggestions

**Scoring Criteria:**
| Criterion | Weight |
|-----------|--------|
| Completeness | 25% |
| Clarity | 20% |
| Competitiveness | 20% |
| Technical Accuracy | 20% |
| Professionalism | 15% |

**Pass Threshold:** Score >= 70

**Output:**
```typescript
{
  passed: boolean,
  score: number,             // 0-100
  feedback: string[],        // Specific issues found
  suggestions: string[],     // Actionable improvements
  attempts: number           // Review iteration count
}
```

---

## Master Orchestrator

**File:** `server/agents/master-orchestrator.ts`

**Model:** Claude Sonnet 4 (Anthropic) - for evaluation only

### Time-Window Configuration

| Agent | Time Budget | Refinement | Notes |
|-------|-------------|------------|-------|
| Intake | 30s | No | Simple DB load |
| Sketch | 60s | No | Vision API call |
| Analysis | 45s | No | Structured scoring |
| Decision | 30s | No | Quick rules check |
| Generation | 150s | Yes | DeepSeek needs ~100s |
| Review | 45s | No | Final quality check |

**Total Workflow Time:** ~5-6 minutes typical

### Refinement Loop (Generation Agent Only)

```
┌─────────────────────────────────────────────────────┐
│              GENERATION AGENT                        │
│                                                      │
│  1. Generate initial bid proposal                    │
│  2. Submit to orchestrator for evaluation            │
│                                                      │
│     ┌───────────────────────────────────┐           │
│     │   ORCHESTRATOR EVALUATION         │           │
│     │   (Claude Sonnet 4)               │           │
│     │                                   │           │
│     │   • Score output (0-100)          │           │
│     │   • Identify improvements needed  │           │
│     │   • Flag critical issues          │           │
│     │                                   │           │
│     │   Score >= 75? ──YES──▶ ACCEPT    │           │
│     │       │                           │           │
│     │      NO                           │           │
│     │       │                           │           │
│     │       ▼                           │           │
│     │   Generate feedback               │           │
│     │   Request refinement ────────────┐│           │
│     └───────────────────────────────────┘│           │
│                                          │           │
│  3. Incorporate feedback                 │◀──────────┘
│  4. Regenerate improved proposal         │
│  5. Repeat until accepted or time runs out           │
│                                                      │
└─────────────────────────────────────────────────────┘
```

### Progress Events (SSE)

The orchestrator emits real-time events via Server-Sent Events at:
```
GET /api/agent-progress/progress/:projectId
```

Event types:
- `agent_start` - Agent beginning execution
- `agent_output` - Agent produced output
- `evaluation` - Orchestrator evaluated output
- `refinement_request` - Requesting agent refinement
- `agent_complete` - Agent finished
- `workflow_complete` - All agents done
- `error` - Error occurred

---

## Supporting Components

### Context Builder
**File:** `server/agents/context-builder.ts`

Compiles rich context for agents including:
- Project metadata
- Document summaries
- Historical bid data (RAG)
- Company branding profile
- GCC compliance requirements

### Memory Manager
**File:** `server/agents/memory-manager.ts`

Manages agent state persistence:
- Working context per project
- Intermediate artifacts
- Conversation history
- Agent execution logs

### Base Agent
**File:** `server/agents/base-agent.ts`

Abstract base class providing:
- Logging infrastructure
- Execution wrapping
- Error handling
- Artifact storage
- Context retrieval

### Multishot Agent
**File:** `server/agents/multishot-agent.ts`

Extended base agent supporting:
- Feedback data handling
- Refinement context injection
- Iteration tracking

---

## Workflow Cancellation

Users can cancel an ongoing workflow at any time:

```
POST /api/agents/:projectId/cancel
```

This sets the workflow status to `cancelled` and stops further agent execution.

---

## Model Configuration

### Analysis & Generation Models

| Model ID | Provider | Model Name | Notes |
|----------|----------|------------|-------|
| `anthropic` | Anthropic | claude-sonnet-4-20250514 | High quality |
| `gemini` | Google | gemini-2.5-flash | Fast, good for analysis |
| `grok` | xAI | grok-4-fast | Balanced speed/quality |
| `deepseek` | DeepSeek | deepseek-chat | Default, cost-effective |
| `openai` | OpenAI | gpt-4o | Premium option |

### API Configuration

Models use LangChain for unified interface. xAI and DeepSeek use OpenAI-compatible APIs with custom base URLs:

```typescript
// xAI Grok
new ChatOpenAI({
  model: 'grok-4-fast',
  apiKey: process.env.XAI_API_KEY,
  configuration: { baseURL: 'https://api.x.ai/v1' }
});

// DeepSeek
new ChatOpenAI({
  model: 'deepseek-chat',
  apiKey: process.env.DEEPSEEK_API_KEY,
  configuration: { baseURL: 'https://api.deepseek.com' }
});
```

---

## Database Schema

Agent execution is tracked in these tables:

### agent_executions
- Stores each agent run with timing, status, and outputs

### agent_states
- Persists workflow state between agents

### decision_logs
- Audit trail of bid/no-bid decisions with reasoning

---

## Error Handling

1. **Agent Timeout:** If an agent exceeds its time budget, the orchestrator uses the best available result or marks failure
2. **API Errors:** Retried with exponential backoff
3. **Parse Errors:** Schema validation with sensible defaults
4. **Workflow Cancellation:** Clean shutdown with status update

---

## Future Enhancements

- [ ] Parallel agent execution for independent tasks
- [ ] Agent result caching for faster reruns
- [ ] Custom agent configuration per project type
- [ ] A/B testing of model performance
- [ ] Agent performance analytics dashboard
