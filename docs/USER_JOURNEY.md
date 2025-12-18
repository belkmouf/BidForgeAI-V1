# BidForge AI - User Journey Guide

This document outlines the complete user journey from initial registration through bid generation and submission.

---

## Phase 1: Account Setup

### 1.1 Company Registration

**Route:** `/register`

1. User navigates to the registration page
2. Fills in required fields:
   - Email address
   - Password (minimum 8 characters)
   - Full name
   - Company name
3. Clicks "Create Account"
4. System creates:
   - New company record with auto-generated slug
   - User account linked to company with `company_admin` role
   - Initial session with access/refresh tokens
5. User is redirected to branding setup

### 1.2 Company Branding Setup

**Route:** `/setup/branding`

1. New users are automatically directed here after registration
2. Split-screen layout shows form on left, live preview on right
3. User enters branding information:
   - Company name (pre-filled from registration)
   - Website URL (optional - enables auto-fill)
   - Primary brand color (color picker)
   - Logo URL
   - About Us description
   - Contact information (name, title, phone, email)
   - Address details (street, city, state, zip)
   - License number (if applicable)
4. **Optional:** Click "Auto-fill from Website" to fetch data automatically
5. Preview panel shows how branding appears in bid documents
6. Click "Complete Setup"
7. User's `onboardingStatus` changes from `pending` to `complete`
8. Redirected to Dashboard

### 1.3 Team Invitation (Company Admin Only)

**Route:** `/settings` → "My Team" tab

1. Company admin navigates to Settings
2. Selects "My Team" tab
3. Clicks "Invite Team Member"
4. Enters:
   - Email address
   - Role (Company Admin or Company User)
5. System generates unique invite code with 7-day expiration
6. Invite link appears - admin copies and shares with team member
7. Team member receives link and navigates to `/invite/:code`
8. New user creates account with:
   - Password
   - Full name
9. Account created and linked to existing company

---

## Phase 2: Dashboard Overview

### 2.1 Main Dashboard

**Route:** `/dashboard`

After login/onboarding, users land on the dashboard showing:
- Active projects count
- Win rate percentage
- Recent activity feed
- Quick action buttons
- Project status breakdown chart

### 2.2 Navigation Structure

**Sidebar Menu:**
- Dashboard - Overview and metrics
- Projects - All bidding projects
- Analytics - Performance insights
- Templates - Bid templates management
- WhatsApp - Communication integration
- Admin - System administration (admin only)
- Settings - User and company settings

---

## Phase 3: Project Creation

### 3.1 Create New Project

**Route:** `/projects/new`

1. User clicks "New Project" from Dashboard or Projects list
2. Fills in project details:
   - **Project Name:** Descriptive title for the bid
   - **Client Name:** The organization issuing the RFP
   - **Description:** Brief overview of the project scope
3. Clicks "Create Project"
4. System creates project with:
   - Unique UUID
   - Status: "Active"
   - Workflow Status: "uploading"
   - Company association
5. User is redirected to document upload page

---

## Phase 4: Document Upload & Processing

### 4.1 Upload Files

**Route:** `/projects/:id/documents`

1. User arrives at document upload page
2. **Drag & Drop Zone:**
   - Drag files directly onto the upload area, OR
   - Click to browse and select files
3. **Supported formats:**
   - PDF (contracts, specifications)
   - DOCX (Word documents)
   - XLSX/CSV (spreadsheets, BOQs)
   - TXT (plain text)
   - Images (PNG, JPG, JPEG, GIF, TIFF, BMP, WEBP) for drawings/sketches
4. **Upload process:**
   - Progress bar shows upload status
   - Each file is processed asynchronously:
     - Text extraction (PDF, DOCX, etc.)
     - Image analysis via Python Vision AI (for drawings)
     - Content chunking for RAG
     - Embedding generation (OpenAI text-embedding-3-small)
5. Files appear in list with status:
   - "Processing" - Being analyzed
   - "Done" - Ready for use
6. User can:
   - Download uploaded files
   - Delete files
   - View AI-generated summaries

### 4.2 Document Summary Review

**Route:** `/projects/:id/documents` (Document Preview panel)

1. Click on any document to view its AI-generated summary
2. Summary includes:
   - Key information extraction (project type, location, deadline, budget)
   - Structured requirements
   - Important specifications
3. **Edit Summary:**
   - Click "Edit" button
   - Modify content in text area
   - Click "Save" to update
4. **Regenerate Summary:**
   - Click "Regenerate" to have AI create new summary
5. Once satisfied, proceed to next step

### 4.3 Workflow Progression

After uploading documents, the workflow status transitions:
```
uploading → summarizing → summary_review
```

User clicks "Continue" or navigates via sidebar to proceed.

---

## Phase 5: RFP Analysis (Risk Assessment)

### 5.1 AI-Powered Analysis

**Route:** `/projects/:id/analysis`

1. System automatically analyzes uploaded documents
2. Analysis includes:
   
   **Quality Scores (0-100):**
   - Quality Score - Overall RFP quality
   - Clarity Score - How clear requirements are
   - Doability Score - Feasibility assessment
   - Vendor Risk Score - Risk of working with client

   **Risk Assessment:**
   - Overall Risk Level (Low/Medium/High/Critical)
   - Red flags identified
   - Missing documents detected
   - Unclear requirements highlighted

   **Recommendations:**
   - Actionable suggestions
   - Areas needing clarification
   - Opportunities to highlight

3. **Missing Documents Alert:**
   - System identifies required documents not uploaded
   - Option to request via WhatsApp or Email
   - Click "Request Documents" to send message

4. Review analysis and acknowledge findings

### 5.2 Workflow Progression

```
summary_review → analyzing → analysis_review
```

---

## Phase 6: Conflict Detection (Review Issues)

### 6.1 Automated Conflict Detection

**Route:** `/projects/:id/conflicts`

1. System scans all documents for conflicts:
   
   **Conflict Types:**
   - Semantic - Contradicting statements
   - Numeric - Inconsistent numbers/quantities
   - Temporal - Conflicting dates/timelines
   - Scope - Overlapping or conflicting requirements

2. Each conflict displays:
   - Severity (Low/Medium/High/Critical)
   - Source document and text
   - Target document and text
   - Description of conflict
   - Suggested resolution

3. **Resolve Conflicts:**
   - Review each conflict
   - Click "Resolve" and add resolution notes
   - Or click "Dismiss" if not applicable

4. Conflict summary shows counts by type

### 6.2 Workflow Progression

```
analysis_review → conflict_check → generating
```

---

## Phase 7: Bid Generation

### 7.1 Generate Bid Content

**Route:** `/projects/:id`

1. User arrives at the Bid Generation workspace
2. **Left Panel - Source Materials:**
   - Documents tab: View uploaded files
   - Summaries tab: View document summaries

3. **Center Panel - Bid Editor:**
   - Rich text editor (Tiptap)
   - Formatting toolbar
   - Table support
   - Real-time editing

4. **Right Panel - AI Generation:**
   
   **Model Selection:**
   - Anthropic Claude (Claude Sonnet 4)
   - OpenAI (GPT-4o)
   - Google Gemini (Gemini 2.5 Flash)
   - DeepSeek
   - Grok
   - Select multiple models for comparison

   **Instructions:**
   - Enter specific instructions for bid generation
   - Select tone (Professional, Friendly, Formal, etc.)

5. **Click "Generate Bid":**
   - AI processes documents via RAG
   - Retrieves relevant context from current project
   - Optionally includes historical "Closed-Won" projects
   - Generates structured bid response

6. **Multi-Model Comparison:**
   - If multiple models selected, generates in parallel
   - Compare outputs side-by-side
   - Select preferred version

### 7.2 Bid Refinement

1. Review generated bid in editor
2. **Refine with AI Chat:**
   - Use chat interface in right panel
   - Provide feedback: "Make it more concise", "Add more technical details"
   - AI refines bid based on feedback
3. **Manual Editing:**
   - Edit directly in rich text editor
   - Format as needed
4. **Version History:**
   - View previous bid versions
   - Compare changes
   - Restore earlier versions if needed

### 7.3 Multi-Shot Agent Refinement

**For complex bids, the multi-shot agent system activates:**

1. **Agent Progress Panel** shows real-time status:
   - Current agent working
   - Iteration count (max 3 per agent)
   - Evaluation scores
   - Refinement feedback

2. **Agent Pipeline:**
   - Intake Agent → Validates documents
   - Sketch Agent → Analyzes drawings (if images present)
   - Analysis Agent → Extracts requirements
   - Decision Agent → Recommends bid/no-bid
   - Generation Agent → Creates bid content
   - Review Agent → Quality checks output

3. Each agent iterates until quality threshold (75/100) is met

### 7.4 Workflow Progression

```
conflict_check → generating → review → completed
```

---

## Phase 8: Final Review & Export

### 8.1 Review Bid

1. Final review of bid content
2. Ensure all sections complete
3. Check formatting and branding

### 8.2 Preview PDF

1. Click "Preview PDF" in header
2. View bid as it will appear in PDF format
3. Includes company branding (logo, colors)
4. Professional template layout

### 8.3 Share Bid

1. Click "Share" button
2. System generates unique share link
3. Link provides read-only access to bid
4. Share with team members or stakeholders for review

### 8.4 Save & Export

1. Click "Save" to persist changes
2. Export options:
   - Download as PDF
   - Download as DOCX
   - Copy HTML content

---

## Phase 9: Project Status Management

### 9.1 Update Project Status

**Available Statuses:**
- **Active** - Bid in progress
- **Submitted** - Bid sent to client
- **Closed-Won** - Won the contract
- **Closed-Lost** - Did not win

1. Click status dropdown in project header
2. Select new status
3. Status change is logged

### 9.2 Archive Project

1. Navigate to project settings
2. Click "Archive Project"
3. Project moves to archived list
4. Can be restored if needed

---

## Phase 10: Analytics & Insights

### 10.1 Performance Analytics

**Route:** `/analytics`

View metrics including:
- Win rate trends
- Bid volume over time
- Average bid value
- Time to complete bids
- Model usage statistics
- Cost analysis

### 10.2 Win Probability

For active projects, system calculates:
- Win probability percentage
- Confidence score
- Contributing factors
- Recommendations to improve chances

---

## Summary: Complete User Flow

```
Registration
    ↓
Branding Setup
    ↓
Dashboard
    ↓
Create Project
    ↓
Upload Documents
    ↓
Review Summaries
    ↓
RFP Analysis (Risk Assessment)
    ↓
Conflict Detection (Review Issues)
    ↓
Generate Bid
    ↓
Refine & Edit
    ↓
Review & Export
    ↓
Submit & Track
    ↓
Update Outcome
```

---

## Quick Reference: Sidebar Navigation (On Project Pages)

When viewing a project, the sidebar shows:

| Step | Label | Description |
|------|-------|-------------|
| 1 | Upload Files | Document upload and management |
| 2 | Summary Review | Review AI-generated document summaries |
| 3 | Risk Assessment | RFP analysis and risk evaluation |
| 4 | Review Issues | Conflict detection and resolution |
| 5 | Bid Generation | Generate and refine bid content |

---

## Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| Save | Ctrl/Cmd + S |
| Bold | Ctrl/Cmd + B |
| Italic | Ctrl/Cmd + I |
| Undo | Ctrl/Cmd + Z |
| Redo | Ctrl/Cmd + Shift + Z |

---

*Last Updated: December 2024*
