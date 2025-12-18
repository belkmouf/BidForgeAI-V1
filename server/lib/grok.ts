import OpenAI from 'openai';

function getGrokClient(): OpenAI {
  if (!process.env.XAI_API_KEY) {
    throw new Error('XAI_API_KEY environment variable is required for Grok');
  }
  return new OpenAI({
    baseURL: 'https://api.x.ai/v1',
    apiKey: process.env.XAI_API_KEY,
  });
}

export interface AIGenerationResult {
  content: string;
  inputTokens: number;
  outputTokens: number;
}

export async function generateBidWithGrok(params: {
  instructions: string;
  context: string;
  tone?: string;
}): Promise<AIGenerationResult> {
  const client = getGrokClient();
  
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

  const response = await client.chat.completions.create({
    model: 'grok-3',
    max_tokens: 8192,
    messages: [
      { role: 'system', content: systemPrompt },
      { 
        role: 'user', 
        content: `User Instructions: ${params.instructions}\n\nRelevant Context from Documents and Past Winning Bids:\n${params.context}\n\nGenerate a complete, professional bid response. Output ONLY raw HTML - do NOT use markdown code blocks.`
      }
    ],
  });

  return {
    content: response.choices[0]?.message?.content || '',
    inputTokens: response.usage?.prompt_tokens || 0,
    outputTokens: response.usage?.completion_tokens || 0,
  };
}

export async function refineBidWithGrok(params: {
  currentHtml: string;
  feedback: string;
  context?: string;
}): Promise<AIGenerationResult> {
  const client = getGrokClient();
  
  const systemPrompt = `You are an expert construction bid editor. Your task is to refine and improve a bid document based on specific feedback.

STRICT RULES:
1. Only make changes that address the specific feedback provided
2. Preserve all existing accurate information
3. Do NOT invent or hallucinate any new data
4. If the feedback requests information not in the context, mark it as [TO BE PROVIDED]
5. Maintain consistent formatting and structure

OUTPUT REQUIREMENTS:
- Return the complete updated HTML document
- CRITICAL: Output ONLY raw HTML content. Do NOT wrap your response in markdown code blocks. Start directly with HTML tags.`;

  const userContent = params.context 
    ? `Current Bid Document:\n${params.currentHtml}\n\nFeedback to Address:\n${params.feedback}\n\nAdditional Context:\n${params.context}\n\nPlease refine the bid document. Output ONLY raw HTML.`
    : `Current Bid Document:\n${params.currentHtml}\n\nFeedback to Address:\n${params.feedback}\n\nPlease refine the bid document. Output ONLY raw HTML.`;

  const response = await client.chat.completions.create({
    model: 'grok-3',
    max_tokens: 8192,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent }
    ],
  });

  return {
    content: response.choices[0]?.message?.content || '',
    inputTokens: response.usage?.prompt_tokens || 0,
    outputTokens: response.usage?.completion_tokens || 0,
  };
}

export async function chatWithGrok(params: {
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
  context?: string;
}): Promise<AIGenerationResult> {
  const client = getGrokClient();

  const systemMessage = {
    role: 'system' as const,
    content: `You are an expert construction bid consultant. Help the user refine and improve their bid documents.

RULES:
1. Base all suggestions on the provided context and document content
2. Do not invent information
3. Provide specific, actionable advice
4. When suggesting changes, explain the reasoning`
  };

  const messagesWithContext = params.context
    ? [
        systemMessage,
        { role: 'user' as const, content: `Context:\n${params.context}` },
        ...params.messages
      ]
    : [systemMessage, ...params.messages];

  const response = await client.chat.completions.create({
    model: 'grok-3',
    max_tokens: 4096,
    messages: messagesWithContext,
  });

  return {
    content: response.choices[0]?.message?.content || '',
    inputTokens: response.usage?.prompt_tokens || 0,
    outputTokens: response.usage?.completion_tokens || 0,
  };
}
