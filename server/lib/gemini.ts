import { GoogleGenAI } from '@google/genai';

if (!process.env.AI_INTEGRATIONS_GEMINI_API_KEY) {
  throw new Error('AI_INTEGRATIONS_GEMINI_API_KEY is not set');
}

export const gemini = new GoogleGenAI({
  apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY,
  httpOptions: {
    baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL,
  },
});

export async function generateBidWithGemini(params: {
  instructions: string;
  context: string;
  tone?: string;
}): Promise<string> {
  const systemPrompt = `You are an expert construction bid writer. 
Create professional, compelling bid responses based on the provided context.
Tone: ${params.tone || 'professional'}
Generate well-structured HTML content with headings, paragraphs, tables, and lists as needed.
Focus on highlighting safety records, past experience, and competitive advantages.`;

  const response = await gemini.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [
      {
        role: 'user',
        parts: [{ text: `${systemPrompt}\n\nUser Instructions: ${params.instructions}\n\nRelevant Context from Documents and Past Winning Bids:\n${params.context}\n\nGenerate a complete, professional bid response in HTML format.` }]
      }
    ],
  });

  return response.text || '';
}

export async function refineBidWithGemini(params: {
  currentHtml: string;
  feedback: string;
}): Promise<string> {
  const systemPrompt = `You are an expert construction bid writer. 
Apply the user's feedback to improve the bid response.
Maintain the HTML structure and professional styling.`;

  const response = await gemini.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [
      {
        role: 'user',
        parts: [{ text: `${systemPrompt}\n\nCurrent Bid HTML:\n${params.currentHtml}\n\nUser Feedback: ${params.feedback}\n\nApply the feedback and return the updated complete HTML.` }]
      }
    ],
  });

  return response.text || '';
}
