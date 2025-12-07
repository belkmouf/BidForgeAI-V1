import OpenAI from 'openai';

const integrationOpenAIKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
const integrationBaseUrl = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
const directOpenAIKey = process.env.OPENAI_API_KEY;

if (!integrationOpenAIKey) {
  throw new Error('AI_INTEGRATIONS_OPENAI_API_KEY is not set');
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
    const response = await embeddingsClient.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
    });
    
    return response.data[0].embedding;
  } catch (error: any) {
    // If embeddings fail, provide clear error about what's needed
    if (error.status === 401 || error.code === 'invalid_api_key') {
      console.error('Embeddings failed: The OPENAI_API_KEY secret is required for embeddings. Replit AI Integration keys do not support the embeddings endpoint.');
      throw new Error('OPENAI_API_KEY required for embeddings. Please add your OpenAI API key as a secret.');
    }
    throw error;
  }
}

// Generate bid content using OpenAI
export async function generateBidContent(params: {
  instructions: string;
  context: string;
  tone?: string;
}): Promise<string> {
  const systemPrompt = `You are an expert construction bid writer. 
Create professional, compelling bid responses based on the provided context.
Tone: ${params.tone || 'professional'}
Generate well-structured HTML content with headings, paragraphs, tables, and lists as needed.
Focus on highlighting safety records, past experience, and competitive advantages.`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: systemPrompt },
      { 
        role: 'user', 
        content: `User Instructions: ${params.instructions}\n\nRelevant Context from Documents and Past Winning Bids:\n${params.context}\n\nGenerate a complete, professional bid response in HTML format.`
      }
    ],
    temperature: 0.7,
    max_tokens: 4000,
  });

  return response.choices[0].message.content || '';
}

// Refine existing bid content
export async function refineBidContent(params: {
  currentHtml: string;
  feedback: string;
}): Promise<string> {
  const systemPrompt = `You are an expert construction bid writer. 
Apply the user's feedback to improve the bid response.
Maintain the HTML structure and professional styling.`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: systemPrompt },
      { 
        role: 'user', 
        content: `Current Bid HTML:\n${params.currentHtml}\n\nUser Feedback: ${params.feedback}\n\nApply the feedback and return the updated complete HTML.`
      }
    ],
    temperature: 0.7,
    max_tokens: 4000,
  });

  return response.choices[0].message.content || '';
}
