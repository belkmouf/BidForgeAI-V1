import OpenAI from 'openai';

const openrouter = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENROUTER_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENROUTER_API_KEY,
});

export async function generateBidWithDeepSeek(params: {
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

  const response = await openrouter.chat.completions.create({
    model: 'deepseek/deepseek-chat',
    max_tokens: 8192,
    messages: [
      { role: 'system', content: systemPrompt },
      { 
        role: 'user', 
        content: `User Instructions: ${params.instructions}\n\nRelevant Context from Documents and Past Winning Bids:\n${params.context}\n\nGenerate a complete, professional bid response. Output ONLY raw HTML - do NOT use markdown code blocks.`
      }
    ],
  });

  return response.choices[0]?.message?.content || '';
}

export async function refineBidWithDeepSeek(params: {
  currentHtml: string;
  feedback: string;
}): Promise<string> {
  const systemPrompt = `You are an expert construction bid writer. 
Apply the user's feedback to improve the bid response.
Maintain the HTML structure and professional styling.
CRITICAL: Output ONLY raw HTML content. Do NOT wrap your response in markdown code blocks (like \`\`\`html or \`\`\`).`;

  const response = await openrouter.chat.completions.create({
    model: 'deepseek/deepseek-chat',
    max_tokens: 8192,
    messages: [
      { role: 'system', content: systemPrompt },
      { 
        role: 'user', 
        content: `Current Bid HTML:\n${params.currentHtml}\n\nUser Feedback: ${params.feedback}\n\nApply the feedback and return the updated complete HTML. Output ONLY raw HTML - do NOT use markdown code blocks.`
      }
    ],
  });

  return response.choices[0]?.message?.content || '';
}
