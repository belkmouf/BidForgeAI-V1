import { GoogleGenAI } from '@google/genai';

const userGeminiKey = process.env.GEMINI_API_KEY;
const integrationGeminiKey = process.env.AI_INTEGRATIONS_GEMINI_API_KEY;
const integrationBaseUrl = process.env.AI_INTEGRATIONS_GEMINI_BASE_URL;

const geminiApiKey = userGeminiKey || integrationGeminiKey;

if (!geminiApiKey) {
  throw new Error('GEMINI_API_KEY is not set');
}

export const gemini = new GoogleGenAI({
  apiKey: geminiApiKey,
  httpOptions: userGeminiKey ? undefined : {
    baseUrl: integrationBaseUrl,
  },
});

export async function generateEmbeddingWithGemini(text: string): Promise<number[]> {
  try {
    const result = await gemini.models.embedContent({
      model: 'gemini-embedding-exp-03-07',
      contents: text,
      config: {
        outputDimensionality: 1536,
      },
    });
    
    return result.embeddings?.[0]?.values || [];
  } catch (error: any) {
    console.error('Gemini embedding error:', error);
    throw new Error(`Gemini embedding failed: ${error.message}`);
  }
}

export interface AIGenerationResult {
  content: string;
  inputTokens: number;
  outputTokens: number;
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

  const response = await gemini.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [
      {
        role: 'user',
        parts: [{ text: `${systemPrompt}\n\nUser Instructions: ${params.instructions}\n\nRelevant Context from Documents and Past Winning Bids:\n${params.context}\n\nGenerate a complete, professional bid response. Output ONLY raw HTML - do NOT use markdown code blocks.` }]
      }
    ],
  });

  return {
    content: response.text || '',
    inputTokens: response.usageMetadata?.promptTokenCount || 0,
    outputTokens: response.usageMetadata?.candidatesTokenCount || 0,
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

  const response = await gemini.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [
      {
        role: 'user',
        parts: [{ text: `${systemPrompt}\n\nCurrent Bid HTML:\n${params.currentHtml}\n\nUser Feedback: ${params.feedback}\n\nApply the feedback and return the updated complete HTML. Output ONLY raw HTML - do NOT use markdown code blocks.` }]
      }
    ],
  });

  return {
    content: response.text || '',
    inputTokens: response.usageMetadata?.promptTokenCount || 0,
    outputTokens: response.usageMetadata?.candidatesTokenCount || 0,
  };
}
