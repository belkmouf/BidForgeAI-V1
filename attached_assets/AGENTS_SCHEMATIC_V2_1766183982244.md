Objective: Redesign existing agents to support parallel execution, cross-modal conflict detection, and multi-model ensemble reviews.

## Core Technical Stack

Orchestrator: Claude 3.5/4 Sonnet (Anthropic **API**) for complex reasoning.

Enforcement: Gemini 2.5 Flash for fast factual and regional compliance checks.

Logic: Grok 4 Fast for rapid strategic Go/No-Go decisions.

Database/**ORM**: PostgreSQL with Drizzle **ORM** (for agent_executions and agent_states tables).

Communication: Server-Sent Events (**SSE**) for real-time progress updates.

## Updated Architecture Blueprint

The system is shifting from a sequential pipeline to a Blackboard Architecture with integrated validation gates.

Phase 1: Parallel Enrichment Sketch Agent: Extract blueprint dimensions and materials in parallel with text analysis.

Analysis Agent: Perform document quality and risk assessment simultaneously.

Phase 2: The **USP** Gate (Cross-Modal Conflict Detection) Function: Compare Bill of Quantities (**BOQ**) text against Drawing counts.

Constraint: **HARD** **STOP** if a discrepancy (e.g., 24 vs 12 structures) is found with >80% confidence.

Phase 3: Technical & Regional Validation Tech Spec Validator: Enforce material minimums (e.g., Concrete 35 N/mm²).

Regional Compliance: Enforce **GCC**-specific codes (BS EN) and **OMR** currency.

## Implementation Roadmap for Replit Agent

To ensure the Replit Agent builds this correctly, follow this modular execution plan.

Module 1: Orchestrator & Parallelization (The Scaffold) Task: Refactor master-orchestrator.ts to use Promise.all for the Sketch and Analysis agents.

Goal: Reduce initial latency by ~45 seconds.

Module 2: Cross-Modal Conflict Agent (The **USP**) Task: Create server/agents/conflict-detection-agent.ts.

Requirement: Implement the logic to reconcile **BOQ** quantities with vision-extracted drawing counts.

Module 3: Validation Gates (The Guardrails) Task: Build technical-spec-validator.ts and completeness-validator.ts.

Requirement: Implement *Hard Stop* logic that triggers a WorkflowResult error if critical violations occur.

Module 4: Ensemble Review (The Final Gate) Task: Replace the single-model review with an ensemble of Claude and Gemini.

Rule: Set a Pass Threshold of 85% (up from 70%) to ensure enterprise-grade quality.