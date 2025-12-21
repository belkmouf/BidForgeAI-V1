import type { CompiledContext } from './context-builder';
import { BaseAgent, AgentInput, AgentOutput, AgentContext } from './base-agent';
import { DraftResultType, DocumentInfoType, AnalysisResultType } from './state';
import { ChatOpenAI } from '@langchain/openai';
import { ChatAnthropic } from '@langchain/anthropic';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { getUserBrandingConfig } from '../lib/templates/bid-template-generator';
import { searchService } from '../lib/search';

export class GenerationAgent extends BaseAgent {
  name = 'generation';
  description = 'Generates professional bid proposals based on analyzed RFQ documents';

  private getModel(modelName: string = 'grok') {
    switch (modelName) {
      case 'anthropic':
        return new ChatAnthropic({
          model: 'claude-sonnet-4-20250514',
          temperature: 0.7,
        });
      case 'gemini':
        return new ChatGoogleGenerativeAI({
          model: 'gemini-2.5-flash',
          temperature: 0.7,
          apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.AI_INTEGRATIONS_GEMINI_API_KEY,
        });
      case 'grok':
        if (!process.env.XAI_API_KEY) {
          throw new Error('XAI_API_KEY environment variable is required for Grok');
        }
        return new ChatOpenAI({
          model: 'grok-4-fast',
          temperature: 0.7,
          apiKey: process.env.XAI_API_KEY,
          configuration: {
            baseURL: 'https://api.x.ai/v1',
          },
        });
      case 'deepseek':
        if (!process.env.DEEPSEEK_API_KEY) {
          throw new Error('DEEPSEEK_API_KEY environment variable is required for DeepSeek');
        }
        return new ChatOpenAI({
          model: 'deepseek-chat',
          temperature: 0.7,
          apiKey: process.env.DEEPSEEK_API_KEY,
          configuration: {
            baseURL: 'https://api.deepseek.com',
          },
        });
      default:
        return new ChatOpenAI({
          model: 'gpt-4o',
          temperature: 0.7,
        });
    }
  }

  protected async executeWithCompiledContext(
    compiledContext: CompiledContext,
    input: AgentInput,
    context: AgentContext
  ): Promise<AgentOutput> {
    return this.wrapExecution(async () => {
      const state = input.data as {
        documents?: DocumentInfoType[];
        analysis?: AnalysisResultType;
        review?: { feedback?: string[]; attempts?: number };
        projectSummary?: string;
      };

      const docs = state.documents || [];
      const analysis = state.analysis;
      const projectSummary = state.projectSummary || '';

      if (docs.length === 0) {
        return {
          success: false,
          error: 'No documents available for bid generation',
        };
      }

      this.log('Generating bid proposal using compiled context');

      // Store analysis as artifact if available
      let analysisArtifact: string | undefined;
      if (analysis) {
        analysisArtifact = await this.storeIntermediateArtifact(
          context.projectId,
          analysis,
          'analysis_result'
        );
      }

      // Update working context
      await this.updateWorkingContext(context.projectId, {
        generationStage: 'started',
        documentCount: docs.length,
        hasAnalysis: !!analysis,
        analysisArtifact,
        reviewAttempts: state.review?.attempts || 0,
      });

      // Get model from state or default to 'grok'
      const selectedModel = (input.data as { model?: string }).model || 'grok';
      const model = this.getModel(selectedModel);

      // === FETCH COMPANY BRANDING INFO ===
      let companyProfileSection = '';
      try {
        const brandingConfig = await getUserBrandingConfig(context.userId || null);
        if (brandingConfig) {
          companyProfileSection = `
=== COMPANY PROFILE ===
Company Name: ${brandingConfig.name}
Website: ${brandingConfig.website || 'Not specified'}
Tagline: ${brandingConfig.tagline || ''}

Contact Information:
- Representative: ${brandingConfig.defaultRep?.name || 'Not specified'}
- Title: ${brandingConfig.defaultRep?.title || 'Not specified'}
- Phone: ${brandingConfig.defaultRep?.phone || 'Not specified'}
- Email: ${brandingConfig.defaultRep?.email || 'Not specified'}

Address: ${brandingConfig.address || ''}, ${brandingConfig.city || ''}, ${brandingConfig.state || ''} ${brandingConfig.zip || ''}
License Number: ${brandingConfig.licenseNumber || 'Not specified'}

Use this company information to personalize the bid proposal and ensure consistent branding.
`;
          this.log('Company branding loaded successfully');
        }
      } catch (error) {
        this.log('Could not load company branding, proceeding without it');
      }

      // === RAG SIMILARITY SEARCH FROM KNOWLEDGE BASE ===
      let knowledgeBaseSection = '';
      try {
        const searchQuery = projectSummary || docs.slice(0, 2).map(d => d.content?.slice(0, 500)).join(' ') || '';
        if (searchQuery.length > 50) {
          const ragResults = await searchService.searchDocuments(
            searchQuery.slice(0, 2000),
            context.projectId,
            { limit: 8, threshold: 0.6, useCache: true }
          );
          
          if (ragResults && ragResults.length > 0) {
            const relevantChunks = ragResults
              .filter(r => r.score >= 0.6)
              .slice(0, 6)
              .map((r, idx) => `[${idx + 1}] Source: ${r.documentName} (Relevance: ${(r.score * 100).toFixed(0)}%)\n${r.content.slice(0, 800)}`)
              .join('\n\n---\n\n');
            
            if (relevantChunks) {
              knowledgeBaseSection = `
=== KNOWLEDGE BASE CONTEXT (RAG Retrieved) ===
The following relevant content has been retrieved from our company knowledge base of past projects and technical documentation:

${relevantChunks}

Use this knowledge base content to:
- Reference similar past projects and proven methodologies
- Apply winning strategies from previous successful bids
- Ensure consistency with company standards and pricing approaches
- Leverage technical solutions that have worked before
`;
              this.log(`RAG search returned ${ragResults.length} relevant chunks`);
            }
          }
        }
      } catch (error) {
        this.log('RAG search failed, proceeding without knowledge base context');
      }

      let analysisContext = '';
      if (analysis) {
        analysisContext = `
=== RFP ANALYSIS ===
Analysis Summary:
- Quality Score: ${analysis.qualityScore}/100
- Clarity Score: ${analysis.clarityScore}/100
- Doability Score: ${analysis.doabilityScore}/100
- Risk Level: ${analysis.overallRiskLevel}

Key Findings:
${analysis.keyFindings.map(f => `- ${f}`).join('\n')}

Opportunities:
${analysis.opportunities.map(o => `- ${o}`).join('\n')}
`;
      }

      const previousFeedback = state.review?.feedback?.length
        ? `\n\n=== PREVIOUS REVIEW FEEDBACK ===\nAttempt ${state.review.attempts}:\n${state.review.feedback.map(f => `- ${f}`).join('\n')}`
        : '';

      // Build document content from docs array
      const documentContent = docs
        .map((doc, idx) => `Document ${idx + 1} (${doc.name}):\n${doc.content || ''}`)
        .join('\n\n');

      const systemPrompt = `# CONSTRUCTION BID PROPOSAL GENERATION SYSTEM

## ROLE & EXPERTISE

You are an **elite construction bid writer** with 20+ years of experience in:
- Construction methodology, materials science, and project scheduling
- GCC market construction standards and specifications
- Technical proposal writing for mega-projects ($10M+)

## PRIMARY OBJECTIVE

Generate **technically comprehensive, visually professional** bid proposals that demonstrate deep construction expertise and win client confidence.

## CRITICAL TECHNICAL REQUIREMENTS

### 1. DIMENSIONS & MEASUREMENTS (MANDATORY)

Extract and include **ALL dimensions** from RFP/RFQ documents:

**Required Specifications:**
- Areas: Square footage/meters (e.g., "12,500 sq ft floor plate")
- Volumes: Cubic yards/meters (e.g., "2,400 cu yd concrete pour")
- Linear measurements: Lengths, heights, clearances, setbacks
- Structural dimensions with drawing references (e.g., "per Drawing A-101")
- Specification section citations (e.g., "Section 03300")

**Never use:** Generic descriptions without measurements

### 2. MATERIALS & SPECIFICATIONS (MANDATORY)

Specify **exact material grades and standards**:

**Required Format:**
- **Concrete:** "4000 PSI per ACI 318, Class C mix design"
- **Rebar:** "Grade 60, #5 bars @ 12" O.C. per ASTM A615"
- **Structural Steel:** "ASTM A992 Grade 50, W14x68 columns"
- **Finishes:** "PPG Pitt-Glaze epoxy coating, 8-mil DFT"
- **Standards:** ASTM, ACI, AISC, BS EN, Gulf Standards

**Never use:** "High-quality materials" or generic descriptions

### 3. CONSTRUCTION METHODOLOGY

Detail **complete construction approach**:

**Include:**
- **Sequencing:** Phase-by-phase construction flow
- **Equipment:** Specific machinery (e.g., "200-ton crawler crane")
- **Temporary Works:** Shoring, scaffolding, site logistics
- **Quality Control:** Testing protocols, inspection points
- **Safety Measures:** HSE procedures, risk mitigation

### 4. PROJECT TIMELINE (CRITICAL)

Create **realistic, detailed schedules** based on scope:

**Industry-Standard Durations:**
| Activity | Duration Benchmark |
|----------|-------------------|
| Excavation | 1-2 weeks per 1,000 cu yd |
| Foundation | 2-4 weeks (complexity-dependent) |
| Structural Steel | 1-2 weeks per floor |
| MEP Rough-in | 3-6 weeks (scope-dependent) |
| Finishes | 4-8 weeks (spec-dependent) |

**Timeline Must Include:**
- Phase breakdown with specific durations
- Milestone dates and critical path items
- Weather contingencies and curing times
- **Total aggregated timeline** (sum of all phases with overlap)

**Avoid:** Vague timelines like "several months"

### 5. RESOURCE REQUIREMENTS

Specify **complete resource allocation**:

- **Labor:** Skilled trades, supervision, hours per category
- **Subcontractors:** Scope breakdown per trade
- **Equipment:** Mobilization schedule, rental vs. owned
- **Materials:** Procurement schedule, delivery logistics

## REQUIRED PROPOSAL SECTIONS (9 SECTIONS)

Your proposal **MUST** include these sections in order:

### 1. Executive Summary
- Project overview with key dimensions
- Value proposition and differentiators (from Company Strengths)
- Total timeline and budget framework
- Why your company is the ideal partner

### 2. Company Credentials & Qualifications
- About the company: Incorporate Company About Statement
- Relevant past projects from Knowledge Base (RAG)
- Key differentiators from Company Strengths
- Certifications, licenses, safety record
- Team qualifications and experience

### 3. Technical Scope of Work
- Detailed work breakdown with ALL dimensions
- Material specifications with standards
- Drawing and specification references
- Compliance with ALL extracted requirements

### 4. Construction Methodology
- Sequencing and phasing plan
- Equipment and temporary works
- Construction methods and techniques
- Lessons learned from Knowledge Base (RAG)

### 5. Project Timeline
- Phase-by-phase schedule with durations
- Critical milestones and dependencies
- Total project duration (aggregated)

### 6. Risk Mitigation & Conflict Resolution
- Addressing detected conflicts proactively
- Risk management strategies
- Contingency planning
- Quality control measures

### 7. Quality Assurance Plan
- Testing protocols and frequencies
- Inspection points and hold points
- Compliance certifications

### 8. Resource Plan
- Labor allocation matrix
- Subcontractor breakdown
- Equipment schedule

### 9. Pricing Framework
- Unit rates where applicable
- Cost breakdown structure
- Payment milestone schedule
- Value engineering opportunities

## HTML FORMATTING REQUIREMENTS

Generate professional HTML with embedded CSS:

\`\`\`html
<style>
  .bid-proposal {
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    max-width: 1200px;
    margin: 0 auto;
    padding: 40px;
    background: #ffffff;
    line-height: 1.6;
  }
  
  .section {
    margin-bottom: 40px;
    padding: 30px;
    background: #f8f9fa;
    border-left: 4px solid #0066cc;
    border-radius: 8px;
  }
  
  h1 {
    color: #003366;
    font-size: 32px;
    margin-bottom: 10px;
    border-bottom: 3px solid #0066cc;
    padding-bottom: 15px;
  }
  
  h2 {
    color: #0066cc;
    font-size: 24px;
    margin-top: 30px;
    margin-bottom: 15px;
  }
  
  h3 {
    color: #004080;
    font-size: 18px;
    margin-top: 20px;
    margin-bottom: 10px;
  }
  
  .highlight-box {
    background: #e6f2ff;
    border: 2px solid #0066cc;
    padding: 20px;
    margin: 20px 0;
    border-radius: 6px;
  }
  
  .spec-table {
    width: 100%;
    border-collapse: collapse;
    margin: 20px 0;
    border: 1px solid #ddd;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  }
  
  .spec-table th {
    background: #0066cc;
    color: white;
    padding: 12px;
    text-align: left;
    border: 1px solid #0052a3;
  }
  
  .spec-table td {
    padding: 10px;
    border: 1px solid #ddd;
  }
  
  .spec-table tr:hover {
    background: #f5f5f5;
  }
  
  .timeline-phase {
    background: #fff;
    border-left: 4px solid #28a745;
    padding: 15px;
    margin: 15px 0;
    box-shadow: 0 2px 4px rgba(0,0,0,0.05);
  }
  
  .key-metric {
    display: inline-block;
    background: #0066cc;
    color: white;
    padding: 8px 16px;
    border-radius: 20px;
    margin: 5px;
    font-weight: bold;
  }
  
  ul, ol {
    margin: 15px 0;
    padding-left: 25px;
  }
  
  li {
    margin: 8px 0;
  }
</style>
\`\`\`

**Section Structure:**
- Each major section in a styled div with class "section"
- Use highlight-box for key metrics and critical information
- Use spec-table for materials, dimensions, timelines
- Use timeline-phase for schedule phases
- Use key-metric badges for important numbers

## GENERATION INSTRUCTIONS

### 1. Company Branding & Voice
- Incorporate Company About Statement naturally into Executive Summary and Company Credentials
- Weave Company Strengths throughout the proposal where relevant
- Include Company Name in headers and value propositions
- Maintain a professional, confident voice

### 2. Leverage Knowledge Base (RAG)
- Reference similar past projects from RAG results
- Apply proven methodologies that worked in previous wins
- Use consistent pricing approaches from company history
- Cite specific project examples: "Similar to our previous projects..."

### 3. Address ALL Requirements
- Every item in Extracted Requirements must be explicitly addressed
- Map each Scope Item to a proposal section
- Use Project Document Summary to understand project context
- Cross-reference all requirements to ensure complete coverage

### 4. Risk Mitigation Strategy
- Proactively address every Detected Conflict
- Reference Overall Risk Level to calibrate risk language
- Turn risks into opportunities by showing mitigation plans
- Use Key Findings to demonstrate deep RFP understanding

### 5. Capitalize on Opportunities
- Highlight every opportunity identified
- Align opportunities with Company Strengths
- Show how company capabilities exceed requirements
- Position as value-add, not just compliance

### 6. Incorporate Review Feedback
- Apply all improvements from Previous Review Feedback
- Address reviewer concerns explicitly
- Show iteration and responsiveness

## ABSOLUTE PROHIBITIONS

**NEVER include:**
- Placeholder text: "[TBD]", "[INSERT HERE]", "[PENDING]"
- Generic statements: "high-quality materials", "experienced team"
- Vague timelines: "several weeks", "as needed"
- Missing dimensions or specifications
- Unsubstantiated claims

**ALWAYS include:**
- Specific measurements and quantities
- Material grades with standard references
- Realistic timelines with phase durations
- Technical methodology details
- Quality control procedures

## OUTPUT FORMAT

Generate **ONLY the HTML content** for the bid proposal body:
- **NO** <!DOCTYPE>, <html>, <head>, or <body> tags
- **START** with <style> tag for CSS
- **FOLLOW** with <div class="bid-proposal"> containing all 9 sections
- **END** with closing </div> tag

## SUCCESS METRICS

A successful bid proposal will:
1. **Demonstrate Technical Mastery** - Every specification is precise and standards-referenced
2. **Show Construction Intelligence** - Methodology reveals deep practical experience
3. **Build Client Confidence** - Professional formatting and comprehensive details
4. **Differentiate from Competition** - Specific, data-driven approach vs. generic proposals
5. **Win Contracts** - Compelling combination of technical excellence and presentation quality

**Generate a bid proposal that demonstrates world-class construction expertise and wins contracts.**`;

      const projectSummarySection = projectSummary 
        ? `
=== PROJECT DOCUMENT SUMMARY ===
${projectSummary}
`
        : '';

      const userPrompt = `Generate a comprehensive, winning bid proposal for this RFQ.
${companyProfileSection}
${knowledgeBaseSection}
${projectSummarySection}
${analysisContext}

=== RFQ DOCUMENTS ===
${documentContent.slice(0, 35000)}
${previousFeedback}

=== GENERATION INSTRUCTIONS ===
1. Incorporate company branding and voice from the Company Profile section
2. Reference relevant past projects from the knowledge base where applicable
3. Address ALL requirements identified in the project document summary
4. Mitigate any detected conflicts or risks proactively
5. Align technical approach with company strengths and differentiators
6. Generate a proposal that positions the company as the ideal partner for this project`;

      try {
        const response = await model.invoke([
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ]);

        const content = typeof response.content === 'string'
          ? response.content
          : JSON.stringify(response.content);

        const draft: DraftResultType = {
          content,
          format: 'html',
          generatedAt: new Date(),
          modelUsed: selectedModel === 'grok' ? 'grok-4-fast' : selectedModel === 'anthropic' ? 'claude-sonnet-4' : selectedModel === 'gemini' ? 'gemini-2.5-flash' : selectedModel === 'deepseek' ? 'deepseek-chat' : 'gpt-4o',
        };

        this.log('Bid proposal generated successfully');

        return {
          success: true,
          data: {
            draft,
            logs: ['Bid proposal generated successfully'],
          },
        };
      } catch (error) {
        this.error('Failed to generate bid proposal', error);
        return {
          success: false,
          error: `Failed to generate bid proposal: ${(error as Error).message}`,
        };
      }
    }, 'bid generation');
  }
}

export const generationAgent = new GenerationAgent();
