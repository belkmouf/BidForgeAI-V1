import OpenAI from "openai";
import { cache } from "./cache.js";

const integrationOpenAIKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
const integrationBaseUrl = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
const directOpenAIKey = process.env.OPENAI_API_KEY;

if (!integrationOpenAIKey) {
  throw new Error("AI_INTEGRATIONS_OPENAI_API_KEY is not set");
}

// Client for chat completions (uses Replit's AI integration proxy)
export const openai = new OpenAI({
  apiKey: integrationOpenAIKey,
  baseURL: integrationBaseUrl,
});

// Client for embeddings - needs direct OpenAI API access
// Replit's AI integration proxy doesn't support the /embeddings endpoint
// Falls back to using the integration key with direct API if no separate key is provided
const embeddingsClient = new OpenAI({
  apiKey: directOpenAIKey || integrationOpenAIKey,
  // Use direct OpenAI API for embeddings (no baseURL override)
  // The integration key may or may not work - if it fails, user needs to provide OPENAI_API_KEY
});

// Generate text embedding using OpenAI (direct API, not proxy)
export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    // Check cache first for performance (3-5x speedup on cache hits)
    const cached = await cache.getEmbedding(text);
    if (cached) {
      console.log("[OpenAI] Using cached embedding");
      return cached;
    }

    // Generate new embedding via API
    const response = await embeddingsClient.embeddings.create({
      model: "text-embedding-3-small",
      input: text,
    });

    const embedding = response.data[0].embedding;

    // Cache for future use (10 minute TTL)
    await cache.cacheEmbedding(text, embedding, 600).catch((cacheError) => {
      // Log but don't fail if caching fails
      console.warn("[OpenAI] Failed to cache embedding:", cacheError);
    });

    return embedding;
  } catch (error: any) {
    // If embeddings fail, provide clear error about what's needed
    if (error.status === 401 || error.code === "invalid_api_key") {
      console.error(
        "Embeddings failed: The OPENAI_API_KEY secret is required for embeddings. Replit AI Integration keys do not support the embeddings endpoint.",
      );
      throw new Error(
        "OPENAI_API_KEY required for embeddings. Please add your OpenAI API key as a secret.",
      );
    }
    throw error;
  }
}

export interface AIGenerationResult {
  content: string;
  inputTokens: number;
  outputTokens: number;
}

// Generate bid content using OpenAI
export async function generateBidContent(params: {
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
- Tone: ${params.tone || "professional"}
- Format: Well-structured HTML with headings, paragraphs, tables, and lists
- Include a compliance matrix mapping RFP requirements to responses
- Mark any missing required information as [TO BE PROVIDED]
- CRITICAL: Output ONLY raw HTML content. Do NOT wrap your response in markdown code blocks (like \`\`\`html or \`\`\`). Start directly with <div> or other HTML tags.`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: `User Instructions: ${params.instructions}\n\nRelevant Context from Documents and Past Winning Bids:\n${params.context}\n\nGenerate a complete, professional bid response. Output ONLY raw HTML - do NOT use markdown code blocks.`,
      },
    ],
    temperature: 0.7,
    max_tokens: 4000,
  });

  return {
    content: response.choices[0].message.content || "",
    inputTokens: response.usage?.prompt_tokens || 0,
    outputTokens: response.usage?.completion_tokens || 0,
  };
}

// Refine existing bid content
export async function refineBidContent(params: {
  currentHtml: string;
  feedback: string;
}): Promise<AIGenerationResult> {
  const systemPrompt = `You are an expert construction bid writer. 
Apply the user's feedback to improve the bid response.
Maintain the HTML structure and professional styling.
CRITICAL: Output ONLY raw HTML content. Do NOT wrap your response in markdown code blocks (like \`\`\`html or \`\`\`).`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: `Current Bid HTML:\n${params.currentHtml}\n\nUser Feedback: ${params.feedback}\n\nApply the feedback and return the updated complete HTML. Output ONLY raw HTML - do NOT use markdown code blocks.`,
      },
    ],
    temperature: 0.7,
    max_tokens: 4000,
  });

  return {
    content: response.choices[0].message.content || "",
    inputTokens: response.usage?.prompt_tokens || 0,
    outputTokens: response.usage?.completion_tokens || 0,
  };
}
