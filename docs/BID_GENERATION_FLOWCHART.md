# Bid Generation Flowcharts

## Quick Reference Diagrams

### Direct Bid Generation Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    USER REQUEST                              │
│         POST /api/bids/projects/:id/generate                 │
└───────────────────────────┬───────────────────────────────────┘
                            │
                            ▼
                  ┌──────────────────┐
                  │ Input Sanitize   │
                  │ • Instructions   │
                  │ • Tone           │
                  └────────┬─────────┘
                           │
                           ▼
            ┌───────────────────────────────┐
            │  BidGenerationService         │
            │  .generateBid()               │
            └───────────────┬───────────────┘
                            │
                            ▼
            ┌───────────────────────────────┐
            │  buildContext() [PARALLEL]     │
            ├───────────────────────────────┤
            │ 1. Project Metadata           │
            │ 2. RAG Search (Vector+Text)   │
            │ 3. Knowledge Base Search      │
            │ 4. Company Profile            │
            │ 5. Sketch Analysis            │
            └───────────────┬───────────────┘
                            │
                            ▼
            ┌───────────────────────────────┐
            │  Combine Contexts            │
            │  • RAG chunks                │
            │  • Knowledge base            │
            │  • Company info              │
            │  • Project details           │
            └───────────────┬───────────────┘
                            │
                            ▼
            ┌───────────────────────────────┐
            │  generateBidWithModel()       │
            │  • Retry logic (3x)           │
            │  • Token tracking             │
            │  • Cost calculation           │
            └───────────────┬───────────────┘
                            │
                            ▼
            ┌───────────────────────────────┐
            │  Sanitize & Template         │
            │  • HTML sanitization          │
            │  • Premium template wrap      │
            └───────────────┬───────────────┘
                            │
                            ▼
            ┌───────────────────────────────┐
            │  Save to Database             │
            │  • Bid record                 │
            │  • Version tracking           │
            │  • Cost tracking              │
            └───────────────┬───────────────┘
                            │
                            ▼
                    ┌───────────────┐
                    │ Return Bid    │
                    └───────────────┘
```

---

### Multi-Agent Workflow Flow

```
┌─────────────────────────────────────────────────────────────┐
│              MULTI-AGENT WORKFLOW REQUEST                    │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
        ┌───────────────────────────────────────┐
        │  MultishotWorkflowOrchestrator         │
        │  .runWorkflow()                        │
        └───────────────┬───────────────────────┘
                        │
                        ▼
        ┌───────────────────────────────────────┐
        │  Initialize Workflow State            │
        │  • Load project summary               │
        │  • Setup progress tracking             │
        └───────────────┬───────────────────────┘
                        │
                        ▼
        ┌───────────────────────────────────────┐
        │  STEP 1: INTAKE AGENT                 │
        │  • Load project documents             │
        │  • Validate availability              │
        │  • Extract metadata                   │
        └───────────────┬───────────────────────┘
                        │
                        ▼
        ┌───────────────────────────────────────┐
        │  STEP 2: SKETCH AGENT (if images)     │
        │  • Analyze project images             │
        │  • Extract technical details          │
        └───────────────┬───────────────────────┘
                        │
                        ▼
        ┌───────────────────────────────────────┐
        │  STEP 3: ANALYSIS AGENT               │
        │  • Calculate quality scores           │
        │  • Assess risk levels                 │
        │  • Identify opportunities             │
        │  • Generate recommendations           │
        └───────────────┬───────────────────────┘
                        │
                        ├───► [Conditional Check]
                        │     shouldProceedAfterAnalysis()
                        │
                        ├───► REJECT ──► Complete (No Bid)
                        │
                        └───► PROCEED ──►
                                    │
                                    ▼
                    ┌───────────────────────────────┐
                    │  STEP 4: DECISION AGENT       │
                    │  • Evaluate analysis          │
                    │  • Go/No-Go decision          │
                    │  • Determine bid strategy     │
                    └───────────────┬───────────────┘
                                    │
                                    ├───► REJECT ──► Complete (No Bid)
                                    │
                                    └───► PROCEED ──►
                                                │
                                                ▼
                            ┌───────────────────────────────┐
                            │  STEP 5: GENERATION AGENT     │
                            │  • Build context (RAG+KB)     │
                            │  • Generate bid draft         │
                            │  • Format output              │
                            └───────────────┬───────────────┘
                                            │
                                            ▼
                            ┌───────────────────────────────┐
                            │  STEP 6: REVIEW AGENT         │
                            │  • Quality review             │
                            │  • Score (0-100)              │
                            │  • Generate feedback          │
                            └───────────────┬───────────────┘
                                            │
                                            ├───► [Conditional Check]
                                            │     shouldRetryGeneration()
                                            │
                                            ├───► PASS (≥70) ──►
                                            │                  │
                                            │                  ▼
                                            │      ┌───────────────────────┐
                                            │      │  Save Final Bid       │
                                            │      └───────────────────────┘
                                            │
                                            └───► RETRY (<70) ──►
                                                      │
                                                      │ (max 3 attempts)
                                                      │
                                                      └───► Loop back to GENERATION
```

---

### Agent Interaction Diagram

```
┌──────────────────────────────────────────────────────────────┐
│                    ORCHESTRATOR                                │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │         MasterOrchestrator                           │   │
│  │  • Multi-shot refinement                             │   │
│  │  • Progress events                                   │   │
│  │  • Iteration tracking                                │   │
│  └───────────────────┬──────────────────────────────────┘   │
│                      │                                        │
│  ┌───────────────────┴──────────────────────────────────┐   │
│  │         AgentOrchestrator (LangGraph)                │   │
│  │  • State machine                                     │   │
│  │  • Conditional edges                                 │   │
│  │  • Retry logic                                       │   │
│  └───────────────────┬──────────────────────────────────┘   │
└──────────────────────┼───────────────────────────────────────┘
                       │
                       │ Executes Agents
                       │
        ┌──────────────┼──────────────┐
        │              │               │
        ▼              ▼               ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ INTAKE       │ │ ANALYSIS     │ │ DECISION     │
│ AGENT        │ │ AGENT        │ │ AGENT        │
│              │ │              │ │              │
│ • Documents  │ │ • Scores     │ │ • Go/No-Go   │
│ • Validation │ │ • Risks      │ │ • Strategy   │
└──────┬───────┘ └──────┬───────┘ └──────┬───────┘
       │                │                 │
       │                │                 │
       └────────────────┴─────────────────┘
                        │
                        ▼
              ┌──────────────────┐
              │ GENERATION       │
              │ AGENT            │
              │                  │
              │ • Context Builder│
              │ • RAG + KB       │
              │ • AI Generation  │
              └────────┬─────────┘
                       │
                       ▼
              ┌──────────────────┐
              │ REVIEW           │
              │ AGENT            │
              │                  │
              │ • Quality Check  │
              │ • Feedback       │
              │ • Pass/Retry     │
              └────────┬─────────┘
                       │
                       ├───► Pass ──► Complete
                       │
                       └───► Retry ──► Back to Generation
```

---

### Context Building Process

```
┌─────────────────────────────────────────────────────────────┐
│              CONTEXT BUILDER                                  │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
        ┌───────────────────────────────────────┐
        │  Parallel Context Assembly            │
        └───────────────┬───────────────────────┘
                        │
        ┌───────────────┼───────────────┐
        │               │               │
        ▼               ▼               ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ RAG SEARCH   │ │ KNOWLEDGE    │ │ COMPANY      │
│              │ │ BASE         │ │ PROFILE      │
│ • Vector     │ │              │ │              │
│ • Full-text  │ │ • Historical │ │ • Info       │
│ • Current    │ │ • Best       │ │ • Branding    │
│   docs       │ │   practices  │ │ • Templates  │
└──────┬───────┘ └──────┬───────┘ └──────┬───────┘
       │                │                 │
       └────────────────┴─────────────────┘
                        │
                        ▼
        ┌───────────────────────────────┐
        │  Compiled Context             │
        │                               │
        │  • Project metadata           │
        │  • RAG chunks (top-k)         │
        │  • Knowledge base chunks      │
        │  • Company profile            │
        │  • Sketch analysis            │
        │  • Analysis results           │
        │  • Bid strategy               │
        └───────────────┬───────────────┘
                        │
                        ▼
        ┌───────────────────────────────┐
        │  AI Model Prompt               │
        │  • System instructions        │
        │  • Combined context           │
        │  • User instructions          │
        │  • Tone preferences           │
        └───────────────────────────────┘
```

---

### Retry Logic Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    AGENT EXECUTION                          │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
            ┌───────────────────────────────┐
            │  executeWithTimeout()         │
            │  • Timeout: 60s (default)     │
            │  • Max retries: 3             │
            └───────────────┬───────────────┘
                            │
                            ▼
            ┌───────────────────────────────┐
            │  Attempt 1                    │
            │  Execute agent                │
            └───────────────┬───────────────┘
                            │
                            ├───► Success ──► Return Result
                            │
                            └───► Error/Timeout ──►
                                        │
                                        ▼
                        ┌───────────────────────────────┐
                        │  Exponential Backoff         │
                        │  delay = 2^attempt * 1000ms  │
                        │  • Attempt 1: 2s             │
                        │  • Attempt 2: 4s             │
                        │  • Attempt 3: 8s             │
                        └───────────────┬───────────────┘
                                        │
                                        ▼
                        ┌───────────────────────────────┐
                        │  Attempt 2                    │
                        │  Retry execution              │
                        └───────────────┬───────────────┘
                                        │
                                        ├───► Success ──► Return Result
                                        │
                                        └───► Error/Timeout ──►
                                                    │
                                                    ▼
                                    ┌───────────────────────────────┐
                                    │  Attempt 3 (Final)            │
                                    │  Last retry                  │
                                    └───────────────┬───────────────┘
                                                    │
                                                    ├───► Success ──► Return Result
                                                    │
                                                    └───► Failure ──► Throw Error
```

---

### Review Retry Loop

```
┌─────────────────────────────────────────────────────────────┐
│                    GENERATION AGENT                         │
│                  (Generates Bid Draft)                      │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
            ┌───────────────────────────────┐
            │  REVIEW AGENT                 │
            │  • Quality check              │
            │  • Score calculation          │
            └───────────────┬───────────────┘
                            │
                            ▼
            ┌───────────────────────────────┐
            │  Review Score                 │
            │  Score: 0-100                  │
            └───────────────┬───────────────┘
                            │
                            ├───► Score ≥ 70 ──►
                            │                  │
                            │                  ▼
                            │      ┌───────────────────────┐
                            │      │  PASS                 │
                            │      │  • Save bid           │
                            │      │  • Complete workflow  │
                            │      └───────────────────────┘
                            │
                            └───► Score < 70 ──►
                                        │
                                        ▼
                        ┌───────────────────────────────┐
                        │  Generate Feedback             │
                        │  • Issues identified           │
                        │  • Suggestions provided        │
                        └───────────────┬───────────────┘
                                        │
                                        ▼
                        ┌───────────────────────────────┐
                        │  Check Retry Count             │
                        │  Current: N                    │
                        │  Max: 3                        │
                        └───────────────┬───────────────┘
                                        │
                                        ├───► Attempts < 3 ──►
                                        │                  │
                                        │                  ▼
                                        │      ┌───────────────────────┐
                                        │      │  RETRY                │
                                        │      │  • Pass feedback      │
                                        │      │  • Regenerate         │
                                        │      │  • Increment count    │
                                        │      └───────────┬───────────┘
                                        │                  │
                                        │                  └───► Loop back to Generation
                                        │
                                        └───► Attempts ≥ 3 ──►
                                                    │
                                                    ▼
                                    ┌───────────────────────────────┐
                                    │  ACCEPT BEST ATTEMPT           │
                                    │  • Save final bid              │
                                    │  • Log retry limit reached     │
                                    └───────────────────────────────┘
```

---

## Key Components Summary

### Services
- **BidGenerationService**: Unified bid generation logic
- **SearchService**: RAG and knowledge base search
- **Storage**: Database operations

### Orchestrators
- **MultishotWorkflowOrchestrator**: High-level workflow coordinator
- **MasterOrchestrator**: Multi-shot refinement handler
- **AgentOrchestrator**: LangGraph state machine

### Agents
1. **Intake**: Document loading and validation
2. **Sketch**: Image/sketch analysis (conditional)
3. **Analysis**: RFQ quality and risk assessment
4. **Decision**: Go/no-go and strategy determination
5. **Generation**: Bid proposal creation
6. **Review**: Quality assurance and feedback

### Context Builders
- **IntakeContextBuilder**: Document-focused
- **AnalysisContextBuilder**: Analysis-focused
- **GenerationContextBuilder**: Full RAG + KB
- **ReviewContextBuilder**: Review-focused

