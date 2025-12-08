import Anthropic from '@anthropic-ai/sdk';

const userAnthropicKey = process.env.ANTHROPIC_API_KEY;
const integrationAnthropicKey = process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY;
const integrationBaseUrl = process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL;

const anthropicApiKey = userAnthropicKey || integrationAnthropicKey;

if (!anthropicApiKey) {
  throw new Error('ANTHROPIC_API_KEY is not set');
}

export const anthropic = new Anthropic({
  apiKey: anthropicApiKey,
  baseURL: userAnthropicKey ? undefined : integrationBaseUrl,
});

export async function generateBidWithAnthropic(params: {
  instructions: string;
  context: string;
  tone?: string;
}): Promise<string> {
  const systemPrompt = `You are an expert construction bid writer. You MUST follow these strict rules:

CRITICAL DATA RULES:
1. Use ONLY information from the provided context (RFP documents, company data, project details)
2. Do NOT invent, assume, or hallucinate ANY information
3. If specific data is missing (costs, timelines, specifications), mark it as [TO BE PROVIDED]
4. Every claim must be traceable to the provided context
5. Do NOT make up company names, project names, certifications, or statistics

ALLOWED DATA SOURCES:
- RFP/RFQ document content provided in context
- Company profile information in context
- Project details in context
- Historical bid data from past projects in context

OUTPUT REQUIREMENTS:
- Tone: ${params.tone || 'professional'}
- Format: Well-structured HTML with headings, paragraphs, tables, and lists
- Include a compliance matrix mapping RFP requirements to responses
- Mark any missing required information as [TO BE PROVIDED]
- CRITICAL: Output ONLY raw HTML content. Do NOT wrap your response in markdown code blocks (like \`\`\`html or \`\`\`). Start directly with <div> or other HTML tags.`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 4096,
    system: systemPrompt,
    messages: [
      { 
        role: 'user', 
        content: `User Instructions: ${params.instructions}\n\nRelevant Context from Documents and Past Winning Bids:\n${params.context}\n\nGenerate a complete, professional bid response. Output ONLY raw HTML - do NOT use markdown code blocks.`
      }
    ],
  });

  const textBlock = response.content.find(block => block.type === 'text');
  return textBlock?.text || '';
}

export async function refineBidWithAnthropic(params: {
  currentHtml: string;
  feedback: string;
}): Promise<string> {
  const systemPrompt = `You are an expert construction bid writer. 
Apply the user's feedback to improve the bid response.
Maintain the HTML structure and professional styling.
CRITICAL: Output ONLY raw HTML content. Do NOT wrap your response in markdown code blocks (like \`\`\`html or \`\`\`).`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 4096,
    system: systemPrompt,
    messages: [
      { 
        role: 'user', 
        content: `Current Bid HTML:\n${params.currentHtml}\n\nUser Feedback: ${params.feedback}\n\nApply the feedback and return the updated complete HTML. Output ONLY raw HTML - do NOT use markdown code blocks.`
      }
    ],
  });

  const textBlock = response.content.find(block => block.type === 'text');
  return textBlock?.text || '';
}
