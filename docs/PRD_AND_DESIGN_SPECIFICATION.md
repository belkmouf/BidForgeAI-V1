# BidForge AI - Product Requirements & Design Specification

**Version:** 1.0  
**Last Updated:** December 2024  
**Document Type:** Combined PRD & Design Specification

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Product Vision & Goals](#product-vision--goals)
3. [User Personas & Use Cases](#user-personas--use-cases)
4. [Product Requirements](#product-requirements)
5. [Functional Requirements](#functional-requirements)
6. [User Stories](#user-stories)
7. [Workflow Requirements](#workflow-requirements)
8. [Design Philosophy](#design-philosophy)
9. [Visual Design System](#visual-design-system)
10. [Component Specifications](#component-specifications)
11. [UI/UX Patterns](#uiux-patterns)
12. [Layout Architecture](#layout-architecture)
13. [Responsive Design](#responsive-design)
14. [Accessibility](#accessibility)
15. [Success Metrics](#success-metrics)

---

## Executive Summary

BidForge AI is an enterprise-grade construction bidding automation platform that transforms company collective intelligence into persuasive, compliant, and winning bids. The platform positions itself as "The Forge of Winning Proposals" - an AI-powered solution that acts as an "Iron Man Suit" for revenue teams handling RFPs worth millions to billions.

### Key Value Propositions

- **75% Faster Bid Creation**: Automate proposal generation from days to hours
- **AI-Powered Intelligence**: Learn from past winning bids to improve future proposals
- **Enterprise-Grade Security**: Bank-level encryption with full audit trails
- **Multi-Model AI Comparison**: Generate bids using multiple AI models simultaneously
- **Risk Assessment**: Automated RFP analysis with quality, clarity, and risk scoring

---

## Product Vision & Goals

### Vision Statement

To become the leading AI-powered bidding platform for construction companies, enabling them to win more projects by generating professional, compliant, and persuasive proposals in a fraction of the time.

### Strategic Goals

1. **Efficiency**: Reduce bid creation time from 3 days to under 1 hour
2. **Quality**: Improve win rates by 40% through data-driven insights
3. **Scalability**: Support companies handling 100+ bids per month
4. **Intelligence**: Continuously learn from closed-won projects to improve recommendations
5. **Enterprise Readiness**: Meet security and compliance requirements for Fortune 500 companies

### Target Market

- **Primary**: Mid-to-large construction companies (50-500 employees)
- **Secondary**: Enterprise construction firms (500+ employees)
- **Geographic Focus**: Initially Gulf region, expanding globally
- **Project Value**: RFPs ranging from $100K to $1B+

---

## User Personas & Use Cases

### Primary Personas

#### 1. Bid Manager (Sarah)
- **Role**: Manages multiple concurrent bids
- **Goals**: Reduce time spent on proposal writing, ensure compliance, improve win rates
- **Pain Points**: Manual document review, inconsistent quality, tight deadlines
- **Use Cases**:
  - Upload RFP documents and receive AI-generated summaries
  - Review risk assessments before committing resources
  - Generate initial bid drafts using company knowledge base
  - Refine bids through iterative AI feedback

#### 2. Business Development Director (Ahmed)
- **Role**: Strategic decision-making on which bids to pursue
- **Goals**: Maximize ROI, minimize risk, strategic resource allocation
- **Pain Points**: Lack of data-driven insights, difficulty assessing bid viability
- **Use Cases**:
  - View win probability predictions
  - Review RFP analysis scores (quality, clarity, doability)
  - Access executive analytics dashboard
  - Make go/no-go decisions based on AI recommendations

#### 3. Proposal Writer (Emma)
- **Role**: Creates and refines bid content
- **Goals**: Produce high-quality, compliant proposals efficiently
- **Pain Points**: Repetitive content creation, maintaining consistency
- **Use Cases**:
  - Use AI-generated drafts as starting point
  - Refine content through natural language feedback
  - Compare outputs from multiple AI models
  - Access historical winning bids for reference

#### 4. Company Administrator (Mohammed)
- **Role**: Manages team, company settings, knowledge base
- **Goals**: Maintain company standards, onboard team members
- **Pain Points**: Team coordination, knowledge management
- **Use Cases**:
  - Invite team members and manage roles
  - Upload company templates and knowledge base documents
  - Configure branding profiles
  - Monitor team activity and performance

---

## Product Requirements

### Core Features

#### 1. Document Management
- **Upload Support**: PDF, DOCX, XLSX, CSV, TXT, Images (PNG, JPG, JPEG, GIF, TIFF, BMP, WEBP)
- **Sketch Analysis**: Automatic analysis of construction drawings using vision AI
- **Document Summarization**: AI-generated summaries with editable text areas
- **Version Control**: Track document versions and changes
- **Bulk Operations**: Upload multiple documents simultaneously

#### 2. RFP Analysis Engine
- **Multi-Dimensional Scoring**:
  - Quality Score (0-100): Document completeness and professionalism
  - Clarity Score (0-100): Requirements specificity and unambiguity
  - Doability Score (0-100): Technical and resource feasibility
  - Vendor Risk Score (0-100): Client reliability and payment history
- **Risk Assessment**: Overall risk level (LOW, MEDIUM, HIGH, CRITICAL)
- **Gap Detection**: Identify missing documents and unclear requirements
- **Recommendations**: Actionable insights for bid strategy

#### 3. Conflict Detection
- **Semantic Conflicts**: Detect contradictory statements using embeddings
- **Numeric Conflicts**: Identify conflicting numbers and specifications
- **Temporal Conflicts**: Find timeline inconsistencies
- **Severity Classification**: HIGH, MEDIUM, LOW
- **Resolution Tracking**: Mark conflicts as resolved with notes

#### 4. AI-Powered Bid Generation
- **Multi-Model Support**: OpenAI GPT-4o, Anthropic Claude Sonnet 4, Google Gemini, DeepSeek, Grok
- **RAG Integration**: Context from current project + historical "Closed-Won" projects
- **Iterative Refinement**: Natural language feedback loop
- **Multi-Model Comparison**: Generate with multiple models simultaneously
- **Version History**: Track all bid versions with comparison

#### 5. Win Probability Prediction
- **ML-Based Scoring**: 8-feature model predicting success probability
- **Confidence Intervals**: Statistical confidence in predictions
- **Feature Analysis**: Breakdown of contributing factors
- **Historical Learning**: Improve predictions from past outcomes

#### 6. Team Collaboration
- **Role-Based Access**: system_admin, company_admin, company_user, viewer
- **Invitation System**: Email-based team invitations with role assignment
- **Activity Tracking**: Audit logs for all user actions
- **Company Scoping**: Multi-tenant data isolation

#### 7. Knowledge Base Management
- **Document Upload**: Store company templates, standards, pricing
- **RAG Integration**: Use knowledge base for context in bid generation
- **Version Control**: Track knowledge base document versions
- **Search**: Full-text and semantic search across knowledge base

#### 8. Analytics & Reporting
- **Executive Dashboard**: High-level metrics and KPIs
- **Win Rate Tracking**: Historical win/loss analysis
- **Project Type Breakdown**: Performance by project category
- **Client Performance**: Success rates by client
- **Revenue Analysis**: Bid value and outcome tracking
- **Customizable Widgets**: Drag-and-drop dashboard customization

---

## Functional Requirements

### Authentication & Authorization

#### FR-AUTH-001: User Registration
- **Description**: New users can create accounts with email and password
- **Acceptance Criteria**:
  - Email validation (format and uniqueness)
  - Password strength requirements (min 8 chars, complexity)
  - Automatic company creation for first user
  - Email verification (optional)

#### FR-AUTH-002: User Login
- **Description**: Secure authentication with JWT tokens
- **Acceptance Criteria**:
  - Access token (15-minute expiry)
  - Refresh token (7-day expiry, stored in DB)
  - Session management
  - "Remember me" functionality

#### FR-AUTH-003: Role-Based Access Control
- **Description**: Different permission levels for different roles
- **Acceptance Criteria**:
  - system_admin: Full platform access
  - company_admin: Company-wide management
  - company_user: Project CRUD, bid generation
  - viewer: Read-only access
  - All queries scoped by companyId

### Project Management

#### FR-PROJ-001: Project Creation
- **Description**: Create new bidding projects
- **Acceptance Criteria**:
  - Required fields: name, client_name
  - Optional: description
  - Auto-generate UUID
  - Set initial status: "Active"
  - Set workflow_status: "uploading"
  - Associate with company

#### FR-PROJ-002: Project Workflow States
- **Description**: Sequential state-driven workflow
- **Acceptance Criteria**:
  - States: uploading → summarizing → summary_review → analyzing → analysis_review → conflict_check → generating → review → completed
  - State transitions validated server-side
  - Cannot skip ahead without completing prerequisites
  - Visual stepper component in UI

#### FR-PROJ-003: Project Archiving
- **Description**: Archive completed or cancelled projects
- **Acceptance Criteria**:
  - Soft delete (is_archived flag)
  - Archived projects hidden from default views
  - Can unarchive projects
  - Preserve all project data

### Document Processing

#### FR-DOC-001: Document Upload
- **Description**: Upload RFP documents with drag-and-drop
- **Acceptance Criteria**:
  - Support multiple file formats
  - Progress indicators during upload
  - File size validation (max 50MB per file)
  - Automatic text extraction
  - Image files trigger sketch agent

#### FR-DOC-002: Document Summarization
- **Description**: AI-generated summaries with user editing
- **Acceptance Criteria**:
  - Automatic summarization after upload
  - Editable text area with formatting
  - User must "Accept" or "Save" to proceed
  - Save edited summaries to database
  - Use edited summaries for subsequent analysis

#### FR-DOC-003: Document Chunking & Embeddings
- **Description**: Create RAG-ready chunks with vector embeddings
- **Acceptance Criteria**:
  - Chunk size: 1000 characters
  - Chunk overlap: 200 characters
  - Generate embeddings using OpenAI text-embedding-3-small
  - Store in pgvector with 1536 dimensions
  - Index for fast similarity search

### Bid Generation

#### FR-BID-001: Single-Model Generation
- **Description**: Generate bid using one AI model
- **Acceptance Criteria**:
  - Select model (OpenAI, Anthropic, Gemini, DeepSeek, Grok)
  - Provide instructions and tone
  - Use RAG context from documents and knowledge base
  - Return HTML-formatted bid
  - Save as version 1, mark as latest

#### FR-BID-002: Multi-Model Generation
- **Description**: Generate bids with multiple models simultaneously
- **Acceptance Criteria**:
  - Select multiple models
  - Parallel generation
  - Side-by-side comparison view
  - Choose best version or combine
  - Track which model generated which version

#### FR-BID-003: Bid Refinement
- **Description**: Iteratively improve bids through feedback
- **Acceptance Criteria**:
  - Natural language feedback input
  - Generate new version based on feedback
  - Maintain version history
  - Compare versions side-by-side
  - Increment version number

#### FR-BID-004: Bid Export
- **Description**: Export bids in various formats
- **Acceptance Criteria**:
  - HTML export
  - PDF export (future)
  - Word document export (future)
  - Share via public link with token

### RFP Analysis

#### FR-ANAL-001: Automated Analysis
- **Description**: Analyze RFP documents for quality, clarity, and risk
- **Acceptance Criteria**:
  - Calculate quality score (0-100)
  - Calculate clarity score (0-100)
  - Calculate doability score (0-100)
  - Calculate vendor risk score (0-100)
  - Determine overall risk level
  - Generate recommendations

#### FR-ANAL-002: Missing Document Detection
- **Description**: Identify required documents not provided
- **Acceptance Criteria**:
  - List missing documents
  - Provide request templates
  - WhatsApp/Email integration for requests
  - Track request status

#### FR-ANAL-003: Unclear Requirements Detection
- **Description**: Flag ambiguous or unclear requirements
- **Acceptance Criteria**:
  - List unclear requirements
  - Suggest clarification questions
  - Link to source document sections
  - Allow user to mark as resolved

### Conflict Detection

#### FR-CONF-001: Semantic Conflict Detection
- **Description**: Find contradictory statements using embeddings
- **Acceptance Criteria**:
  - Compare document chunks for contradictions
  - Calculate semantic similarity
  - Flag high-confidence conflicts
  - Provide source locations

#### FR-CONF-002: Numeric Conflict Detection
- **Description**: Identify conflicting numbers and specifications
- **Acceptance Criteria**:
  - Extract numeric values from documents
  - Compare across documents
  - Flag inconsistencies
  - Provide context and suggested resolution

#### FR-CONF-003: Temporal Conflict Detection
- **Description**: Find timeline inconsistencies
- **Acceptance Criteria**:
  - Extract dates and deadlines
  - Compare across documents
  - Flag impossible timelines
  - Suggest resolution

---

## User Stories

### Epic 1: Project Setup

**US-001: As a Bid Manager, I want to create a new project, so that I can start working on a new bid.**
- **Given** I am logged in
- **When** I click "New Project" and fill in project details
- **Then** A new project is created with status "Active" and workflow_status "uploading"

**US-002: As a Bid Manager, I want to upload RFP documents, so that the system can analyze them.**
- **Given** I have created a project
- **When** I drag and drop documents onto the upload area
- **Then** Documents are uploaded and processing begins automatically

### Epic 2: Document Analysis

**US-003: As a Bid Manager, I want to see AI-generated summaries, so that I can quickly understand document contents.**
- **Given** Documents have been uploaded
- **When** Summarization completes
- **Then** I see formatted summaries in an editable text area

**US-004: As a Bid Manager, I want to edit summaries, so that I can correct any AI mistakes.**
- **Given** I am viewing a document summary
- **When** I edit the summary text and click "Save"
- **Then** The edited summary is saved and used for subsequent analysis

**US-005: As a Business Development Director, I want to see RFP risk scores, so that I can make go/no-go decisions.**
- **Given** Documents have been analyzed
- **When** I view the analysis page
- **Then** I see quality, clarity, doability, and risk scores with recommendations

### Epic 3: Bid Generation

**US-006: As a Proposal Writer, I want to generate a bid using AI, so that I have a starting point.**
- **Given** I have completed document analysis
- **When** I select an AI model and click "Generate"
- **Then** A bid is generated using context from my documents and knowledge base

**US-007: As a Proposal Writer, I want to compare outputs from multiple AI models, so that I can choose the best one.**
- **Given** I want to generate a bid
- **When** I select multiple models and generate
- **Then** I see side-by-side comparison of all generated bids

**US-008: As a Proposal Writer, I want to refine a bid through feedback, so that I can improve it iteratively.**
- **Given** I have a generated bid
- **When** I provide feedback and click "Refine"
- **Then** A new version is generated incorporating my feedback

### Epic 4: Team Collaboration

**US-009: As a Company Administrator, I want to invite team members, so that they can collaborate on bids.**
- **Given** I am a company admin
- **When** I enter an email and select a role, then send invitation
- **Then** An invitation email is sent with a unique code

**US-010: As a Team Member, I want to accept an invitation, so that I can join the company.**
- **Given** I received an invitation email
- **When** I click the invitation link and create an account
- **Then** My account is linked to the company with the assigned role

### Epic 5: Analytics

**US-011: As a Business Development Director, I want to see win rate analytics, so that I can track performance.**
- **Given** I am viewing the analytics dashboard
- **When** I navigate to the reports page
- **Then** I see win rate, project breakdown, and revenue analysis

**US-012: As a Bid Manager, I want to see win probability predictions, so that I can prioritize efforts.**
- **Given** I have created a project
- **When** I view the project analysis
- **Then** I see a win probability score with confidence interval and feature breakdown

---

## Workflow Requirements

### 5-Step Sequential Workflow with Quality Gates

The system implements a strict sequential workflow with quality assurance checkpoints to ensure data integrity and prevent errors downstream:

```
Step 1: Upload & Ingest
    ↓
Step 2: Quality Check ⚠️ [QUALITY GATE]
    ↓
Step 3: RFP Analysis
    ↓
Step 4: Conflict Detection
    ↓
Step 5: Bid Generation
    ↓
Completed
```

#### Step Definitions & Routes

| Step | Route | State | Description | Quality Gate |
|------|-------|-------|-------------|--------------|
| **1. Upload & Ingest** | `/projects/:id/upload` | `uploading` | User uploads RFP documents, system processes and extracts content | None - Entry point |
| **2. Quality Check** | `/projects/:id/quality` | `quality_check` | System validates document quality, completeness, and readiness | **REQUIRED** - Must pass to continue |
| **3. RFP Analysis** | `/projects/:id/analysis` | `analyzing` → `analysis_review` | AI analyzes RFP for quality, clarity, doability, and risk scores | Recommended - User must acknowledge |
| **4. Conflict Detection** | `/projects/:id/conflicts` | `conflict_check` | System detects and presents conflicts between documents | Optional - Can skip but recommended |
| **5. Bid Generation** | `/projects/:id/generate` | `generating` → `review` | AI generates bid content, user refines and finalizes | None - User-driven |
| **Completed** | `/projects/:id` | `completed` | Bid ready for export/submission | Final state |

#### Detailed Step Breakdown

##### Step 1: Upload & Ingest (`/projects/:id/upload`)

**Purpose**: Collect and process all RFP documents

**User Actions**:
- Drag & drop or browse to upload files
- View upload progress for each file
- See file previews and metadata
- Remove files if needed
- Add more files if needed

**System Actions**:
- Validate file types and sizes
- Extract text from documents (PDF, DOCX, etc.)
- Process images through sketch agent (if applicable)
- Generate document summaries
- Create RAG chunks with embeddings
- Store documents in database

**Completion Criteria**:
- At least one document uploaded
- All files successfully processed
- Text extraction completed

**Transition**: Auto-advance to Quality Check when processing completes (or manual "Continue" button)

---

##### Step 2: Quality Check (`/projects/:id/quality`) ⚠️ QUALITY GATE

**Purpose**: Validate document quality and completeness before proceeding

**User Actions**:
- Review quality score dashboard
- See detailed breakdown by dimension
- Review missing information alerts
- Upload additional documents if needed
- Fix document issues
- Acknowledge quality status

**System Actions**:
- Calculate quality score (0-100)
- Assess completeness (required documents present?)
- Check readability (text extraction quality)
- Evaluate structure (document organization)
- Detect missing critical information
- Generate quality report

**Quality Gate Rules**:
- **Score ≥ 80**: Green - Can proceed immediately
- **Score 60-79**: Yellow - Can proceed with warning, recommended to fix issues
- **Score < 60**: Red - **BLOCKED** - Must address critical issues before proceeding
- **Missing Critical Documents**: **BLOCKED** - Must upload required documents

**Completion Criteria**:
- Quality score meets threshold OR user explicitly overrides (with acknowledgment)
- All critical missing documents addressed (if any)
- User acknowledges quality status

**Transition**: Only when quality gate passes (or override acknowledged)

---

##### Step 3: RFP Analysis (`/projects/:id/analysis`)

**Purpose**: Understand the opportunity, assess risks, and get strategic recommendations

**User Actions**:
- Review multi-dimensional scores (Quality, Clarity, Doability, Risk)
- See risk level assessment
- Read opportunities and recommendations
- Request missing documents (if applicable)
- Acknowledge analysis findings

**System Actions**:
- Calculate Quality Score (document completeness/professionalism)
- Calculate Clarity Score (requirement specificity)
- Calculate Doability Score (technical/resource feasibility)
- Calculate Vendor Risk Score (client reliability)
- Determine overall Risk Level (LOW/MEDIUM/HIGH/CRITICAL)
- Identify opportunities
- Generate strategic recommendations
- Detect missing documents

**Completion Criteria**:
- Analysis completed
- User has reviewed scores and recommendations
- User acknowledges findings (click "Continue" or "Acknowledge")

**Transition**: After user acknowledges analysis

---

##### Step 4: Conflict Detection (`/projects/:id/conflicts`)

**Purpose**: Identify and resolve inconsistencies in documents

**User Actions**:
- Review conflict list (by type and severity)
- Expand conflict cards to see details
- Resolve conflicts with notes
- Dismiss non-applicable conflicts
- Filter and sort conflicts
- Review resolution summary

**System Actions**:
- Detect semantic conflicts (contradictory statements)
- Detect numeric conflicts (inconsistent numbers)
- Detect temporal conflicts (timeline issues)
- Calculate conflict severity
- Suggest resolutions
- Track resolution status

**Completion Criteria**:
- User has reviewed conflicts (at minimum)
- Critical conflicts resolved (recommended)
- User acknowledges review (can proceed even if conflicts remain)

**Transition**: After user acknowledges conflict review (conflicts can be resolved later)

---

##### Step 5: Bid Generation (`/projects/:id/generate`)

**Purpose**: Generate, refine, and finalize the bid proposal

**User Actions**:
- Select AI model(s) for generation
- Provide generation instructions
- Select tone
- Generate bid content
- Compare multiple model outputs
- Refine bid through feedback
- Edit bid in rich text editor
- Export or share bid

**System Actions**:
- Generate bid using selected AI model(s)
- Use RAG context from documents and knowledge base
- Apply user instructions and tone
- Create bid version
- Store in database
- Enable refinement iterations

**Completion Criteria**:
- Bid generated (at minimum)
- User can refine indefinitely
- User marks as complete when ready

**Transition**: User-driven - can refine multiple times, mark complete when satisfied

---

#### State Transition Rules

**Strict Sequential Flow**:
- Steps must be completed in order
- Cannot skip ahead without completing previous step
- Can return to completed steps to review/modify
- Changes in earlier steps may require re-processing later steps

**Quality Gate Enforcement**:
- Step 2 (Quality Check) has mandatory gate
- Server-side validation prevents bypassing quality gate
- Override option available with explicit user acknowledgment
- Audit log records quality gate decisions

**Persistence**:
- All step data auto-saves
- State stored in database
- Can resume from any completed step
- Unsaved changes warning on navigation

**UI Feedback**:
- Visual stepper shows progress
- Current step highlighted
- Completed steps clickable
- Pending steps disabled
- Progress percentage displayed

#### User Actions Summary

| Step | User Action | Required? | Can Override? |
|------|-------------|-----------|---------------|
| Upload & Ingest | Upload documents | Yes | No |
| Quality Check | Review and acknowledge | Yes | Yes (with warning) |
| RFP Analysis | Review and acknowledge | Yes | No |
| Conflict Detection | Review conflicts | Recommended | Yes (can skip) |
| Bid Generation | Generate and refine | Yes | No |
| Completed | Export/submit | Optional | N/A |

---

## Design Philosophy

### "Guided Journey with Quality Gates" - A Step-by-Step Experience

BidForge AI follows a **"Progressive Disclosure with Quality Assurance"** philosophy that transforms the complex bid creation process into an intuitive, step-by-step journey. Each step is a dedicated experience with clear quality gates, ensuring users never feel overwhelmed while maintaining professional standards.

### Core Design Principles

1. **One Step, One Focus**: Each step has a single, clear purpose - no cognitive overload
2. **Quality Before Progress**: Users cannot proceed until quality checks pass - prevents errors downstream
3. **Visual Progress Storytelling**: Clear visual indicators show where you are, where you've been, and what's next
4. **Contextual Help**: Just-in-time guidance at each step, not overwhelming upfront tutorials
5. **Celebrate Milestones**: Acknowledge completion of each step to build confidence
6. **Graceful Error Recovery**: When quality checks fail, provide clear, actionable feedback

### The 5-Step Journey Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    THE BIDFORGE JOURNEY                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Step 1: Upload & Ingest                                       │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  "Let's start with your documents"                        │ │
│  │  • Drag & drop interface                                  │ │
│  │  • Real-time upload progress                             │ │
│  │  • File type validation                                  │ │
│  │  • Visual file preview                                   │ │
│  └─────────────────────────────────────────────────────────┘ │
│                            ↓                                     │
│  Step 2: Quality Check                                          │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  "Ensuring your documents are ready"                      │ │
│  │  • Automatic quality assessment                           │ │
│  │  • Completeness scoring                                   │ │
│  │  • Missing information detection                          │ │
│  │  • Document health dashboard                              │ │
│  │  • ⚠️ Quality Gate: Must pass to continue                │ │
│  └─────────────────────────────────────────────────────────┘ │
│                            ↓                                     │
│  Step 3: RFP Analysis                                           │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  "Understanding the opportunity"                         │ │
│  │  • Multi-dimensional scoring                             │ │
│  │  • Risk assessment                                       │ │
│  │  • Opportunity identification                           │ │
│  │  • Strategic recommendations                            │ │
│  └─────────────────────────────────────────────────────────┘ │
│                            ↓                                     │
│  Step 4: Conflict Detection                                    │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  "Finding inconsistencies"                               │ │
│  │  • Semantic conflict detection                           │ │
│  │  • Numeric inconsistency flagging                        │ │
│  │  • Timeline conflict resolution                         │ │
│  │  • Interactive conflict resolution                      │ │
│  └─────────────────────────────────────────────────────────┘ │
│                            ↓                                     │
│  Step 5: Bid Generation                                         │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  "Crafting your winning proposal"                        │ │
│  │  • Multi-model AI generation                            │ │
│  │  • Real-time preview                                    │ │
│  │  • Iterative refinement                                 │ │
│  │  • Export & share                                       │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Multi-Page vs Single-Page: The Recommendation

**Recommended Approach: Hybrid "Progressive Pages" Model**

After careful consideration, we recommend a **hybrid approach** that combines the best of both worlds:

#### Primary Structure: Dedicated Pages Per Step
- **Route Structure**: `/projects/:id/upload`, `/projects/:id/quality`, `/projects/:id/analysis`, `/projects/:id/conflicts`, `/projects/:id/generate`
- **Benefits**:
  - ✅ Deep focus on one task at a time
  - ✅ Clean URL structure for bookmarking/sharing
  - ✅ Better browser history navigation
  - ✅ Easier to implement step-specific optimizations
  - ✅ Reduced cognitive load
  - ✅ Better mobile experience (full-screen focus)

#### Supporting Elements: Persistent Progress Indicator
- **Global Stepper**: Always visible at top of page showing all 5 steps
- **Breadcrumb Navigation**: Quick access to completed steps
- **Context Preservation**: All data persists across page transitions
- **Smooth Transitions**: Page-to-page animations maintain continuity

#### Why This Works Better Than Single-Page

1. **Cognitive Clarity**: Users know exactly what they're doing at each step
2. **Quality Gates**: Natural stopping points enforce quality checks
3. **Mobile Optimization**: Full-screen focus on mobile devices
4. **Performance**: Only load what's needed for current step
5. **Error Recovery**: Easier to return to specific step when issues arise
6. **User Confidence**: Clear sense of progress through the journey

### Creative UX Patterns for Each Step

#### Step 1: Upload & Ingest - "The Foundation"

**Design Concept**: Welcoming, spacious upload zone with visual feedback

**Key Elements**:
- **Hero Upload Zone**: Large, inviting drop area (min 400px height)
- **Visual Feedback**: 
  - Empty state: Subtle grid pattern with upload icon
  - Dragging: Animated border pulse, background color shift
  - Uploading: Progress rings around each file, percentage display
  - Complete: Checkmark animation, file preview thumbnails
- **File Preview Cards**: 
  - Document type icon (PDF, DOCX, etc.)
  - File name with truncation
  - File size
  - Processing status badge
  - Quick preview on hover
- **Smart Suggestions**: 
  - "You typically upload 3-5 documents. Add more?"
  - "Common documents: RFP, Specifications, Drawings"
- **Bulk Actions**: Select multiple files for batch operations

**Quality Indicators**:
- File count badge
- Total size display
- Supported format list
- Error messages inline with files

**Transition**: Animated "Continue" button appears when files are uploaded, with countdown to auto-advance (optional)

---

#### Step 2: Quality Check - "The Inspector"

**Design Concept**: Dashboard-style quality report with clear pass/fail gates

**Key Elements**:
- **Quality Score Card**: 
  - Large circular progress indicator (0-100%)
  - Color-coded: Red (<60%), Yellow (60-80%), Green (>80%)
  - Animated fill on load
- **Quality Dimensions**:
  - **Completeness**: "Do you have all required documents?"
  - **Readability**: "Can we extract text clearly?"
  - **Structure**: "Are documents well-organized?"
  - **Content Quality**: "Is information sufficient?"
- **Visual Breakdown**:
  - Each dimension as a card with score
  - Mini charts showing strengths/weaknesses
  - Icon indicators (✓, ⚠️, ✗)
- **Missing Information Panel**:
  - Expandable list of missing items
  - "Add Missing Information" CTA
  - Links to upload more documents
- **Document Health Dashboard**:
  - Grid of document cards
  - Health status per document (Good, Needs Review, Critical)
  - Click to see document-specific issues
- **Quality Gate UI**:
  - Large, prominent "Quality Check Passed ✓" or "Issues Found ⚠️"
  - If failed: Clear list of blockers
  - "Fix Issues" button that highlights problem areas
  - "Proceed Anyway" option (with warning) for experienced users

**Creative Elements**:
- **Progress Animation**: Quality score animates from 0 to actual score
- **Pulse Effect**: Quality gate badge pulses when ready to proceed
- **Color Psychology**: Green = confidence, Yellow = caution, Red = action needed
- **Micro-interactions**: Hover over quality dimensions to see detailed breakdown

**Transition**: Only when quality gate passes (or user explicitly overrides)

---

#### Step 3: RFP Analysis - "The Strategist"

**Design Concept**: Executive dashboard with actionable insights

**Key Elements**:
- **Score Dashboard**: 
  - Four large score cards in grid:
    - Quality Score (document quality)
    - Clarity Score (requirement clarity)
    - Doability Score (feasibility)
    - Risk Score (vendor/client risk)
  - Each card: Large number, trend indicator, color coding
- **Risk Level Badge**: 
  - Prominent badge at top: LOW / MEDIUM / HIGH / CRITICAL
  - Color-coded background
  - Expandable explanation
- **Opportunities Section**:
  - "Key Opportunities" cards
  - Highlighted strengths
  - Competitive advantages identified
- **Recommendations Panel**:
  - Actionable suggestions
  - Prioritized list
  - "Apply Recommendation" buttons
- **Missing Documents Alert**:
  - Sticky banner if documents are missing
  - "Request Documents" button
  - WhatsApp/Email integration
- **Visual Storytelling**:
  - Radar chart showing all scores
  - Comparison to industry benchmarks
  - Historical comparison (if available)

**Creative Elements**:
- **Score Animations**: Numbers count up on load
- **Interactive Charts**: Hover to see detailed breakdowns
- **Risk Visualization**: Animated risk meter
- **Recommendation Cards**: Swipeable or expandable cards
- **Executive Summary**: Collapsible high-level overview

**Transition**: "Acknowledge & Continue" button after reviewing analysis

---

#### Step 4: Conflict Detection - "The Detective"

**Design Concept**: Interactive conflict resolution interface

**Key Elements**:
- **Conflict Overview**:
  - Total conflicts count (large number)
  - Breakdown by type (Semantic, Numeric, Temporal)
  - Breakdown by severity (Critical, High, Medium, Low)
  - Visual pie chart or bar chart
- **Conflict List**:
  - Expandable/collapsible conflict cards
  - Each card shows:
    - Severity badge (color-coded)
    - Conflict type icon
    - Source document + excerpt
    - Target document + excerpt
    - Conflict description
    - AI-suggested resolution
  - Side-by-side document comparison view
- **Resolution Actions**:
  - "Resolve" button with resolution notes
  - "Dismiss" button (with reason)
  - "Mark as Reviewed" for non-critical conflicts
- **Filter & Sort**:
  - Filter by type, severity
  - Sort by severity, date
  - Search conflicts
- **Progress Indicator**:
  - "X of Y conflicts resolved"
  - Visual progress bar
  - Completion percentage

**Creative Elements**:
- **Conflict Cards**: 
  - Expandable with smooth animation
  - Highlight conflicting text on hover
  - Side-by-side comparison view
- **Resolution Flow**:
  - Step-by-step resolution wizard for critical conflicts
  - Auto-save resolution notes
  - Undo/redo capability
- **Visual Indicators**:
  - Animated icons for different conflict types
  - Color-coded severity indicators
  - Checkmark animation on resolve
- **Smart Grouping**: Group related conflicts together

**Transition**: "Continue to Bid Generation" button (conflicts can be resolved later, but user acknowledges review)

---

#### Step 5: Bid Generation - "The Forge"

**Design Concept**: Creative workspace with AI-powered generation

**Key Elements**:
- **Three-Panel Layout**:
  - **Left Panel**: Source materials (documents, summaries, analysis)
  - **Center Panel**: Rich text editor with live preview
  - **Right Panel**: AI generation controls and history
- **AI Generation Panel**:
  - Model selection (checkboxes for multiple)
  - Instructions textarea with suggestions
  - Tone selector (Professional, Friendly, Technical, etc.)
  - "Generate" button with loading state
  - Generation progress indicator
- **Multi-Model Comparison**:
  - Tabbed interface or split view
  - Side-by-side comparison
  - "Choose Best" or "Combine" options
- **Bid History**:
  - Version timeline
  - Compare versions
  - Restore previous version
- **Refinement Interface**:
  - "Refine" button opens feedback modal
  - Natural language feedback input
  - Iteration counter
- **Export Options**:
  - Export as HTML
  - Export as PDF (future)
  - Share link generation
  - Print preview

**Creative Elements**:
- **Generation Animation**: 
  - Typing effect simulation
  - Progress indicator with AI model icons
  - "AI is thinking..." states
- **Live Preview**: 
  - Real-time rendering as you type
  - Formatting toolbar
  - Table support
  - Image insertion
- **Version Comparison**:
  - Diff view showing changes
  - Highlight additions/deletions
  - Side-by-side comparison
- **Success Celebration**:
  - Confetti animation on completion
  - "Bid Ready!" success message
  - Share options

**Transition**: "Mark as Complete" button, moves to completed state

---

### Global Navigation & Progress Indicator

#### Persistent Progress Stepper

**Design**: Always visible at top of page (sticky header)

```
┌─────────────────────────────────────────────────────────────────┐
│  [← Back]  BidForge AI  [Project Name]                    [⚙️] │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐  │
│  │   1.    │───▶│   2.    │───▶│   3.    │───▶│   4.    │  │
│  │ Upload  │    │ Quality │    │Analysis │    │Conflict │  │
│  │   ✓     │    │   ✓     │    │   ●     │    │   ○     │  │
│  └─────────┘    └─────────┘    └─────────┘    └─────────┘  │
│                                                                 │
│                            ┌─────────┐                        │
│                            │   5.    │                        │
│                            │ Generate│                        │
│                            │   ○     │                        │
│                            └─────────┘                        │
│                                                                 │
│  Legend: ✓ Complete  ● Current  ○ Pending                    │
└─────────────────────────────────────────────────────────────────┘
```

**Features**:
- Clickable completed steps (quick navigation)
- Current step highlighted with pulsing animation
- Progress percentage display
- Estimated time remaining
- Step names with icons

#### Breadcrumb Navigation

Secondary navigation showing: `Projects > [Project Name] > [Current Step]`

#### Context Preservation

- All data auto-saves on each step
- Can return to any completed step
- Changes persist across navigation
- Unsaved changes warning on navigation away

---

### Design Goals

- **Journey Clarity**: Users always know where they are and what's next
- **Quality Assurance**: Quality gates prevent proceeding with poor data
- **Confidence Building**: Clear progress and completion indicators
- **Error Prevention**: Quality checks catch issues early
- **Professional Experience**: Enterprise-grade UI suitable for billion-dollar projects
- **Mobile-First**: Each step optimized for mobile devices
- **Accessibility**: WCAG 2.1 AA compliant throughout journey

---

### Implementation Recommendations

#### Page Structure & Routing

**Recommended Route Structure**:
```
/projects/:id/upload      → Step 1: Upload & Ingest
/projects/:id/quality      → Step 2: Quality Check (Quality Gate)
/projects/:id/analysis     → Step 3: RFP Analysis
/projects/:id/conflicts    → Step 4: Conflict Detection
/projects/:id/generate     → Step 5: Bid Generation
/projects/:id              → Completed/Overview (default view)
```

**Route Protection**:
- Each route checks if previous steps are completed
- Redirect to appropriate step if trying to skip ahead
- Allow navigation to completed steps for review
- Store current step in URL for bookmarking

#### Component Architecture

**Shared Components**:
- `<ProgressStepper />` - Global progress indicator
- `<StepLayout />` - Wrapper for each step page
- `<QualityGate />` - Quality gate blocker component
- `<StepNavigation />` - Back/Continue buttons
- `<StepStatus />` - Status badges and indicators

**Step-Specific Components**:
- `<UploadZone />` - Drag & drop upload area
- `<QualityDashboard />` - Quality score visualization
- `<AnalysisScores />` - RFP analysis score cards
- `<ConflictList />` - Conflict resolution interface
- `<BidGenerator />` - AI generation panel

#### State Management

**Workflow State**:
- Store current step in database (`workflow_status`)
- Track completion status for each step
- Store step-specific data (quality scores, conflicts, etc.)
- Enable state restoration on page reload

**Quality Gate Logic**:
```typescript
interface QualityGateResult {
  passed: boolean;
  score: number; // 0-100
  blockers: string[]; // Critical issues
  warnings: string[]; // Non-critical issues
  canOverride: boolean; // Allow user override
}

function checkQualityGate(projectId: string): QualityGateResult {
  // Calculate quality score
  // Identify blockers
  // Determine if override allowed
  return { passed, score, blockers, warnings, canOverride };
}
```

#### User Experience Enhancements

**Progressive Disclosure**:
- Show only relevant information for current step
- Hide advanced options behind "Show More" links
- Provide contextual help tooltips
- Show examples and best practices

**Feedback & Validation**:
- Real-time validation on inputs
- Clear error messages with solutions
- Success confirmations for completed actions
- Progress indicators for long operations

**Mobile Optimization**:
- Full-screen focus on each step
- Simplified navigation (swipe between steps?)
- Touch-friendly controls
- Responsive layouts for all components

**Performance Considerations**:
- Lazy load step components
- Prefetch next step data
- Cache completed step data
- Optimize images and assets per step

#### Visual Design Patterns

**Color Coding by Step**:
- **Step 1 (Upload)**: Blue - Foundation, building
- **Step 2 (Quality)**: Amber/Yellow - Caution, validation
- **Step 3 (Analysis)**: Teal - Intelligence, insight
- **Step 4 (Conflicts)**: Orange - Attention, resolution
- **Step 5 (Generate)**: Green - Creation, success

**Animation Principles**:
- **Entrance**: Fade in + slide up (0.3s ease-out)
- **Transitions**: Smooth page transitions (0.4s)
- **Loading**: Skeleton screens, not spinners
- **Success**: Subtle celebration (confetti, checkmark)
- **Errors**: Shake animation for invalid inputs

**Typography Hierarchy**:
- **Step Title**: 2xl, bold, display font
- **Step Description**: lg, regular, body font
- **Content Headings**: xl, semibold
- **Body Text**: base, regular
- **Helper Text**: sm, muted color

#### Accessibility Features

**Keyboard Navigation**:
- Tab through all interactive elements
- Enter/Space to activate buttons
- Arrow keys for stepper navigation
- Escape to close modals

**Screen Reader Support**:
- Announce step changes
- Describe quality gate status
- Read conflict details
- Announce completion states

**Visual Indicators**:
- High contrast mode support
- Focus indicators on all interactive elements
- Color + icon for status (not color alone)
- Text alternatives for all icons

---

## Visual Design System

### Color Palette: "Gulf Executive"

#### Primary Colors

| Color Name | Hex | HSL | Usage |
|------------|-----|-----|-------|
| **Charcoal 900** | `#1a1a1a` | - | Primary text, headers |
| **Charcoal 800** | `#2c2c2c` | - | Secondary elements |
| **Charcoal 700** | `#3d3d3d` | - | Borders, dividers |
| **Deep Teal 900** | `#0a4d4f` | HSL(181, 80%, 25%) | Deep, serious teal |
| **Deep Teal 700** | `#0d7377` | HSL(181, 60%, 40%) | Primary brand color |
| **Deep Teal 500** | `#14a39e` | HSL(181, 50%, 50%) | Interactive elements |
| **Antique Gold 800** | `#8a6f2f` | HSL(42, 40%, 55%) | Dark gold for text |
| **Antique Gold 600** | `#b8995a` | HSL(42, 40%, 55%) | Refined gold accent |
| **Antique Gold 400** | `#d4bd8a` | HSL(42, 40%, 55%) | Hover states |

#### Extended Color Scales

**Charcoal Scale:**
- `charcoal-900`: #1a1a1a (Darkest)
- `charcoal-800`: #2c2c2c
- `charcoal-700`: #3d3d3d
- `charcoal-600`: #4f4f4f
- `charcoal-500`: #666666 (Lightest)

**Teal Scale:**
- `teal-900`: #0a4d4f (Darkest)
- `teal-800`: #0c6265
- `teal-700`: #0d7377 (Primary)
- `teal-600`: #108387
- `teal-500`: #14a39e
- `teal-400`: #3db8b3
- `teal-300`: #66ccc8
- `teal-200`: #99e0dd
- `teal-100`: #e6f5f5 (Lightest)

**Gold Scale:**
- `gold-900`: #6b5322 (Darkest)
- `gold-800`: #8a6f2f
- `gold-700`: #9d7d38
- `gold-600`: #b8995a (Primary)
- `gold-500`: #c8a962
- `gold-400`: #d4bd8a
- `gold-300`: #e0d1a8
- `gold-200`: #ece5c7
- `gold-100`: #f8f4ed (Lightest)

#### Background Colors

- **Main Background**: HSL(220, 20%, 88%) - Soft blue-gray for depth
- **Card Background**: #FFFFFF - Pure white for content areas
- **Sidebar**: #1a1a1a - Charcoal for strong contrast
- **Muted Background**: HSL(0, 0%, 96%) - Light gray for subtle sections

#### Border Styling

- **Border Color**: HSL(0, 0%, 70%) - Visible gray borders
- **Border Width**: `border-2` (2px) for cards and form elements
- **Border Radius**: 
  - `rounded-xl` (0.75rem) for cards
  - `rounded-md` (0.375rem) for buttons
  - `rounded-lg` (0.5rem) for inputs

### Typography System

#### Font Families

| Font | Usage | Source | Weights |
|------|-------|--------|---------|
| **Syne** | Headings (h1-h6), display text | Google Fonts | 500, 600, 700, 800 |
| **Inter** | Body text, paragraphs, UI elements | Google Fonts | 300, 400, 500, 600, 700 |
| **Fraunces** | Accent text, quotes, special emphasis | Google Fonts | 300, 500, 700 |
| **JetBrains Mono** | Code blocks, technical data | Google Fonts | 400, 500 |

#### Font Hierarchy

```css
/* Display Headings */
h1 {
  font-family: 'Syne', sans-serif;
  font-weight: 700;
  font-size: clamp(2.5rem, 2rem + 2.5vw, 4rem);
  line-height: 1.2;
  letter-spacing: -0.02em;
}

h2 {
  font-family: 'Syne', sans-serif;
  font-weight: 600;
  font-size: clamp(2rem, 1.7rem + 1.5vw, 3rem);
  line-height: 1.3;
  letter-spacing: -0.01em;
}

/* Body Text */
body {
  font-family: 'Inter', sans-serif;
  font-weight: 400;
  font-size: clamp(1rem, 0.95rem + 0.25vw, 1.125rem);
  line-height: 1.6;
}

/* Accent Text */
.accent {
  font-family: 'Fraunces', serif;
  font-weight: 500;
  font-style: italic;
}
```

#### Typography Scale

- **H1**: 2.5rem - 4rem (40px - 64px)
- **H2**: 2rem - 3rem (32px - 48px)
- **H3**: 1.5rem - 2rem (24px - 32px)
- **H4**: 1.25rem - 1.5rem (20px - 24px)
- **Body**: 1rem - 1.125rem (16px - 18px)
- **Small**: 0.875rem (14px)
- **XSmall**: 0.75rem (12px)

### Spacing System

Following 8px base unit:

- **xs**: 0.25rem (4px)
- **sm**: 0.5rem (8px)
- **md**: 1rem (16px)
- **lg**: 1.5rem (24px)
- **xl**: 2rem (32px)
- **2xl**: 3rem (48px)
- **3xl**: 4rem (64px)

### Shadows & Elevation

```css
/* Card Shadows */
.shadow-sm { box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05); }
.shadow { box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1); }
.shadow-md { box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
.shadow-lg { box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1); }
.shadow-xl { box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1); }
.shadow-2xl { box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25); }

/* Hover Elevation */
.hover\:shadow-2xl:hover { box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25); }
```

---

## Component Specifications

### Cards

**Purpose**: Primary container for content throughout the application

**Specifications**:
- Border: `border-2 border-border` (visible gray border)
- Background: `bg-card` (white in light mode)
- Border Radius: `rounded-xl` (0.75rem)
- Shadow: `shadow` (subtle elevation)
- Padding: `p-5` or `p-6` (20px - 24px)
- Hover: `hover:shadow-xl hover:-translate-y-1` (lift effect)

**Variants**:
- **Default Card**: Standard content container
- **Premium Card**: Glassmorphism with `backdrop-blur-sm` and gradient overlay
- **Interactive Card**: Hover effects with border color change

### Buttons

**Purpose**: Primary actions and navigation

**Specifications**:
- Base: `px-6 py-2.5 rounded-md font-medium transition-all duration-300`
- Focus: `focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2`

**Variants**:

| Variant | Appearance | Usage |
|---------|------------|-------|
| **Default** | Teal background, white text | Primary actions |
| **Secondary** | Gold background, dark text | Secondary actions |
| **Outline** | Transparent with border | Tertiary actions |
| **Destructive** | Red background | Dangerous actions |
| **Ghost** | Transparent, no border | Subtle actions |

**Sizes**:
- `sm`: `px-4 py-1.5 text-sm`
- `default`: `px-6 py-2.5 text-base`
- `lg`: `px-8 py-3 text-lg`
- `icon`: `p-2` (square)

### Form Inputs

**Purpose**: User data entry

**Specifications**:
- Border: `border-2 border-input`
- Background: `bg-card`
- Border Radius: `rounded-md` (0.375rem)
- Padding: `px-3 py-2`
- Focus Ring: `focus:ring-2 focus:ring-primary focus:ring-offset-2`
- Placeholder: `placeholder:text-muted-foreground`

**States**:
- **Default**: Gray border
- **Focus**: Teal ring
- **Error**: Red border, error message below
- **Disabled**: Gray background, reduced opacity

### Badges

**Purpose**: Status indicators and labels

**Specifications**:
- Base: `inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium`
- Colors:
  - **Primary**: Teal background
  - **Secondary**: Gold background
  - **Success**: Green background
  - **Warning**: Yellow background
  - **Error**: Red background
  - **Info**: Blue background

**Model Badges**:
- **Claude**: Orange (`#FF6B35`)
- **Gemini**: Blue (`#4285F4`)
- **DeepSeek**: Purple (`#8B5CF6`)
- **OpenAI**: Green (`#10A37F`)
- **Grok**: Red (`#FF0000`)

### Navigation

**Purpose**: Primary navigation structure

**Sidebar Specifications**:
- Background: `bg-charcoal-900` (#1a1a1a)
- Width: `w-64` (256px) desktop, collapsible on mobile
- Active State: Gold accent (`text-gold-400`)
- Hover: `hover:bg-charcoal-800`
- Icons: `w-5 h-5` with text label

**Top Navigation** (if used):
- Background: Transparent → solid on scroll
- Backdrop: `backdrop-blur-md`
- Height: `h-16` (64px)
- Sticky: `sticky top-0 z-50`

### Stepper Component

**Purpose**: Visual workflow progress indicator

**Specifications**:
- Layout: Horizontal with connecting lines
- States:
  - **Completed**: Teal circle with checkmark
  - **Current**: Gold circle with number, animated pulse
  - **Pending**: Gray circle with number
- Labels: Step name below circle
- Responsive: Stack vertically on mobile

### Data Visualization

**Charts (Recharts)**:
- Colors: Use design system color tokens
- Grid: Subtle gray lines
- Axes: Proper labels with appropriate formatting
- Tooltips: Card-styled with backdrop blur
- Responsive: Adapt to container size

**Progress Indicators**:
- Linear: Teal fill, gray track
- Circular: Teal fill, animated
- Step: Visual stepper component

---

## UI/UX Patterns

### Layout Patterns

#### 1. Dashboard Grid
- **Purpose**: Overview metrics and quick actions
- **Layout**: Responsive grid (1-4 columns based on screen size)
- **Spacing**: Consistent gaps between cards
- **Cards**: Premium styling with hover effects

#### 2. Project Workspace
- **Purpose**: Main bid creation interface
- **Layout**: Split-panel with resizable sections
  - **Left Panel**: Document upload and management
  - **Center Panel**: Rich text editor (TipTap)
  - **Right Panel**: AI generation controls and bid history
- **Responsive**: Stack panels vertically on mobile

#### 3. Workflow Layout
- **Purpose**: Sequential workflow navigation
- **Layout**: 
  - **Top**: Stepper component showing progress
  - **Main**: Current step content
  - **Bottom**: Navigation buttons (Back/Next)
- **Gating**: Disable "Next" until current step complete

#### 4. List Views
- **Purpose**: Display collections (projects, documents, bids)
- **Layout**: Card-based or table-based
- **Features**: 
  - Search and filter
  - Sort options
  - Pagination
  - Bulk actions

### Interaction Patterns

#### Hover Effects
- **Cards**: Lift (`-translate-y-1`), shadow increase
- **Buttons**: Scale (`scale-105`), shadow increase
- **Links**: Color change to teal
- **Icons**: Scale and color change

#### Loading States
- **Spinner**: Circular teal spinner
- **Skeleton**: Gray placeholder boxes
- **Progress Bar**: Linear teal progress indicator
- **Message**: "Processing..." with spinner

#### Empty States
- **Icon**: Large gradient icon container
- **Message**: Clear explanation of empty state
- **Action**: Prominent CTA button
- **Illustration**: Optional decorative element

#### Error States
- **Inline Errors**: Red text below input
- **Toast Notifications**: Top-right corner, auto-dismiss
- **Error Pages**: 404, 500 with helpful messaging
- **Validation**: Real-time feedback on forms

### Animation Patterns

#### Entrance Animations
- **Fade In**: `opacity: 0 → 1` over 0.8s
- **Slide Up**: `translateY(60px) → 0` with fade
- **Stagger**: Sequential animation for lists

#### Micro-interactions
- **Button Press**: Subtle scale down (`scale-95`)
- **Card Hover**: Smooth lift and shadow increase
- **Icon Hover**: Scale and color transition
- **Form Focus**: Ring animation

#### Page Transitions
- **Route Changes**: Fade transition (0.3s)
- **Modal Open/Close**: Scale and fade
- **Drawer Open/Close**: Slide animation

---

## Layout Architecture

### Page Structure

```
┌─────────────────────────────────────────────────────────┐
│                    Top Navigation                        │
│              (Optional, if not using sidebar)            │
└─────────────────────────────────────────────────────────┘
┌──────────┬──────────────────────────────────────────────┐
│          │                                               │
│ Sidebar  │              Main Content Area                │
│          │                                               │
│          │                                               │
│          │                                               │
└──────────┴──────────────────────────────────────────────┘
```

### Responsive Breakpoints

| Breakpoint | Width | Usage |
|------------|-------|-------|
| **sm** | 640px | Mobile landscape |
| **md** | 768px | Tablet portrait |
| **lg** | 1024px | Tablet landscape, small desktop |
| **xl** | 1280px | Desktop |
| **2xl** | 1536px | Large desktop |

### Grid System

- **Container**: Max-width `1280px`, centered
- **Columns**: 12-column grid (Tailwind default)
- **Gutters**: Consistent spacing (`gap-6` = 24px)

### Z-Index Scale

- **Base**: 0
- **Dropdown**: 1000
- **Sticky**: 1020
- **Fixed**: 1030
- **Modal Backdrop**: 1040
- **Modal**: 1050
- **Popover**: 1060
- **Tooltip**: 1070

---

## Responsive Design

### Mobile-First Approach

All designs start with mobile and enhance for larger screens.

### Mobile Considerations

- **Sidebar**: Collapsible drawer on mobile
- **Navigation**: Bottom navigation bar option
- **Cards**: Full-width, stacked vertically
- **Tables**: Horizontal scroll or card conversion
- **Forms**: Full-width inputs, stacked labels
- **Buttons**: Full-width on mobile, auto-width on desktop
- **Touch Targets**: Minimum 44x44px for all interactive elements

### Tablet Considerations

- **Sidebar**: Collapsible, can be toggled
- **Grid**: 2-column layouts
- **Cards**: 2-column grid
- **Forms**: 2-column where appropriate

### Desktop Considerations

- **Sidebar**: Always visible, fixed width
- **Grid**: 3-4 column layouts
- **Cards**: 3-4 column grid
- **Forms**: Multi-column layouts
- **Hover States**: Full interaction patterns

---

## Accessibility

### WCAG 2.1 AA Compliance

#### Color Contrast
- **Text on Background**: Minimum 4.5:1 ratio
- **Large Text**: Minimum 3:1 ratio
- **Interactive Elements**: Minimum 3:1 ratio

#### Keyboard Navigation
- **Tab Order**: Logical flow through interactive elements
- **Focus Indicators**: Visible focus rings on all focusable elements
- **Skip Links**: Skip to main content
- **Keyboard Shortcuts**: Documented and consistent

#### Screen Reader Support
- **Semantic HTML**: Proper use of headings, landmarks, ARIA
- **Alt Text**: All images have descriptive alt text
- **Labels**: All form inputs have associated labels
- **ARIA Attributes**: Proper use of aria-label, aria-describedby, etc.

#### Visual Accessibility
- **Font Sizes**: Minimum 16px for body text
- **Line Height**: Minimum 1.5 for readability
- **Spacing**: Adequate spacing between interactive elements
- **Focus States**: High-contrast focus indicators

### Accessibility Features

1. **High Contrast Mode**: Support for system high contrast preferences
2. **Reduced Motion**: Respect `prefers-reduced-motion` media query
3. **Keyboard Shortcuts**: Common actions accessible via keyboard
4. **Error Messages**: Clear, descriptive error messages
5. **Form Validation**: Real-time validation with helpful messages

---

## Success Metrics

### Key Performance Indicators (KPIs)

#### User Engagement
- **Daily Active Users (DAU)**: Target 70% of monthly users
- **Session Duration**: Average 30+ minutes
- **Pages per Session**: Average 5+ pages
- **Return Rate**: 60%+ users return within 7 days

#### Feature Adoption
- **Document Upload**: 90%+ of projects have documents uploaded
- **AI Generation**: 80%+ of projects use AI generation
- **Multi-Model Comparison**: 40%+ of generations use multiple models
- **Bid Refinement**: 60%+ of bids are refined at least once

#### Business Metrics
- **Win Rate Improvement**: 40% increase in win rates
- **Time Savings**: 75% reduction in bid creation time
- **User Satisfaction**: 4.5+ star rating
- **Net Promoter Score (NPS)**: 50+

#### Technical Metrics
- **Page Load Time**: < 2 seconds
- **API Response Time**: < 500ms (p95)
- **Uptime**: 99.9% availability
- **Error Rate**: < 0.1% of requests

### Measurement Methods

1. **Analytics**: Google Analytics or similar for user behavior
2. **Application Monitoring**: Error tracking and performance monitoring
3. **User Surveys**: Quarterly satisfaction surveys
4. **A/B Testing**: Test design variations for optimization
5. **User Interviews**: Qualitative feedback from key users

---

## Appendix

### Design Tokens Reference

```css
/* Colors */
--primary: hsl(181, 60%, 40%);
--secondary: hsl(42, 40%, 55%);
--background: hsl(220, 20%, 88%);
--foreground: hsl(0, 0%, 10%);
--muted: hsl(0, 0%, 96%);
--border: hsl(0, 0%, 70%);

/* Typography */
--font-display: 'Syne', sans-serif;
--font-body: 'Inter', sans-serif;
--font-accent: 'Fraunces', serif;

/* Spacing */
--spacing-unit: 8px;

/* Shadows */
--shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
--shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
--shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.1);
--shadow-xl: 0 20px 25px rgba(0, 0, 0, 0.1);
```

### Component Library

All components built on Shadcn UI (New York style) with customizations:
- Accordion
- Alert
- Alert Dialog
- Avatar
- Badge
- Button
- Card
- Checkbox
- Dialog
- Dropdown Menu
- Form
- Input
- Label
- Select
- Sheet
- Table
- Tabs
- Textarea
- Tooltip

### Design Resources

- **Figma File**: [Link to design file]
- **Component Library**: Shadcn UI
- **Icons**: Lucide React
- **Illustrations**: Custom or [source]
- **Fonts**: Google Fonts (Syne, Inter, Fraunces)

---

**Document End**

*This document serves as the single source of truth for both product requirements and design specifications for BidForge AI. It should be updated as the product evolves.*

