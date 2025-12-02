import OpenAI from 'openai';

if (!process.env.AI_INTEGRATIONS_OPENAI_API_KEY) {
  throw new Error('AI_INTEGRATIONS_OPENAI_API_KEY is not set');
}

export const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

// Generate text embedding using OpenAI
export async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
  });
  
  return response.data[0].embedding;
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
