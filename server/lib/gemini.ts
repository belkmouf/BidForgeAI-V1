import OpenAI from 'openai';

const userGeminiKey = process.env.GEMINI_API_KEY;
const openaiApiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
const openaiBaseUrl = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;

const useOpenAI = !userGeminiKey && openaiApiKey && openaiBaseUrl;

const openai = useOpenAI 
  ? new OpenAI({ apiKey: openaiApiKey, baseURL: openaiBaseUrl })
  : null;

export interface AIGenerationResult {
  content: string;
  inputTokens: number;
  outputTokens: number;
}

async function callAI(systemPrompt: string, userContent: string, maxTokens: number = 8192): Promise<{ text: string; promptTokenCount: number; candidatesTokenCount: number }> {
  if (useOpenAI && openai) {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent }
      ],
      max_tokens: maxTokens,
    });
    
    return {
      text: response.choices[0]?.message?.content || '',
      promptTokenCount: response.usage?.prompt_tokens || 0,
      candidatesTokenCount: response.usage?.completion_tokens || 0,
    };
  } else if (userGeminiKey) {
    const { GoogleGenAI } = await import('@google/genai');
    const genai = new GoogleGenAI({ apiKey: userGeminiKey });
    
    const response = await genai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: [{ text: systemPrompt + '\n\n' + userContent }] }],
      config: { maxOutputTokens: maxTokens },
    });
    
    return {
      text: response.text || '',
      promptTokenCount: response.usageMetadata?.promptTokenCount || 0,
      candidatesTokenCount: response.usageMetadata?.candidatesTokenCount || 0,
    };
  } else {
    throw new Error('No AI provider configured. Please provide GEMINI_API_KEY or ensure AI integrations are set up.');
  }
}

export async function generateBidWithGemini(params: {
  instructions: string;
  context: string;
  tone?: string;
}): Promise<AIGenerationResult> {
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

  const userContent = `User Instructions: ${params.instructions}\n\nRelevant Context from Documents and Past Winning Bids:\n${params.context}\n\nGenerate a complete, professional bid response. Output ONLY raw HTML - do NOT use markdown code blocks.`;

  const result = await callAI(systemPrompt, userContent, 8192);

  return {
    content: result.text,
    inputTokens: result.promptTokenCount,
    outputTokens: result.candidatesTokenCount,
  };
}

export async function refineBidWithGemini(params: {
  currentHtml: string;
  feedback: string;
}): Promise<AIGenerationResult> {
  const systemPrompt = `You are an expert construction bid writer. 
Apply the user's feedback to improve the bid response.
Maintain the HTML structure and professional styling.
CRITICAL: Output ONLY raw HTML content. Do NOT wrap your response in markdown code blocks (like \`\`\`html or \`\`\`).`;

  const userContent = `Current Bid HTML:\n${params.currentHtml}\n\nUser Feedback: ${params.feedback}\n\nApply the feedback and return the updated complete HTML. Output ONLY raw HTML - do NOT use markdown code blocks.`;

  const result = await callAI(systemPrompt, userContent, 8192);

  return {
    content: result.text,
    inputTokens: result.promptTokenCount,
    outputTokens: result.candidatesTokenCount,
  };
}

export async function generateEmbeddingWithGemini(text: string): Promise<number[]> {
  console.warn('Embeddings not supported via AI integrations - returning empty array');
  return [];
}
