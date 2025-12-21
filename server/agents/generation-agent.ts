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

      const systemPrompt = `You are a HIGHLY TECHNICAL expert construction bid writer with deep expertise in construction methodology, materials, and project scheduling. Generate a professional, technically comprehensive bid proposal.

CRITICAL TECHNICAL REQUIREMENTS:

1. DIMENSIONS & MEASUREMENTS (MANDATORY):
   - Extract and include ALL dimensions from the RFQ documents
   - Specify areas (sq ft/sq m), volumes (cu yd/cu m), lengths, heights
   - Include structural dimensions, clearances, setbacks
   - Reference drawing numbers and specification sections

2. MATERIALS & SPECIFICATIONS (MANDATORY):
   - Specify exact material grades (e.g., "Concrete: 4000 PSI per ACI 318")
   - Include ASTM, ACI, AISC, or other applicable standards
   - List reinforcement specifications (rebar sizes, grades)
   - Specify finishes, coatings, and treatments with product standards

3. CONSTRUCTION METHODOLOGY:
   - Detail construction sequencing and phases
   - Specify equipment requirements (cranes, excavators, etc.)
   - Include temporary works requirements
   - Describe quality control procedures and testing protocols

4. TIMELINE GENERATION (CRITICAL):
   - Create realistic phase-by-phase timeline based on scope
   - Aggregate durations: excavation (X weeks), foundation (Y weeks), structure (Z weeks), etc.
   - Consider weather contingencies and curing times
   - Include milestone dates and critical path items
   - Base timeline estimates on industry standards:
     * Excavation: 1-2 weeks per 1000 cu yd
     * Concrete foundation: 2-4 weeks depending on complexity
     * Structural steel: 1-2 weeks per floor
     * MEP rough-in: 3-6 weeks depending on scope
     * Finishes: 4-8 weeks depending on specifications
   - Total project timeline should be sum of all phases with appropriate overlap

5. RESOURCE REQUIREMENTS:
   - Labor categories and estimated hours
   - Subcontractor scope breakdown
   - Equipment mobilization schedule

Your proposal MUST include these sections with SPECIFIC technical details:
- Executive Summary (with project scope dimensions)
- Technical Scope of Work (ALL dimensions, materials with standards)
- Construction Methodology (sequencing, equipment, methods)
- Project Timeline (phase breakdown with durations, total aggregated timeline)
- Quality Assurance Plan (testing protocols, inspection points)
- Resource Plan (labor, equipment, subcontractors)
- Pricing Framework (unit rates where applicable)

DO NOT use placeholder text like "[TBD]", "[INSERT HERE]", or generic statements.
ALL technical details must be SPECIFIC and derived from the RFQ documents.

Generate only the HTML content for the bid proposal body, not a full HTML document.`;

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
