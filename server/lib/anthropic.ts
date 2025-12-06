import Anthropic from '@anthropic-ai/sdk';

const anthropicApiKey = process.env.ANTHROPIC_API_KEY || process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY;

if (!anthropicApiKey) {
  throw new Error('ANTHROPIC_API_KEY is not set');
}

export const anthropic = new Anthropic({
  apiKey: anthropicApiKey,
  baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
});

export async function generateBidWithAnthropic(params: {
  instructions: string;
  context: string;
  tone?: string;
}): Promise<string> {
  const systemPrompt = `You are an expert construction bid writer. 
Create professional, compelling bid responses based on the provided context.
Tone: ${params.tone || 'professional'}
Generate well-structured HTML content with headings, paragraphs, tables, and lists as needed.
Focus on highlighting safety records, past experience, and competitive advantages.`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 4096,
    system: systemPrompt,
    messages: [
      { 
        role: 'user', 
        content: `User Instructions: ${params.instructions}\n\nRelevant Context from Documents and Past Winning Bids:\n${params.context}\n\nGenerate a complete, professional bid response in HTML format.`
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
Maintain the HTML structure and professional styling.`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 4096,
    system: systemPrompt,
    messages: [
      { 
        role: 'user', 
        content: `Current Bid HTML:\n${params.currentHtml}\n\nUser Feedback: ${params.feedback}\n\nApply the feedback and return the updated complete HTML.`
      }
    ],
  });

  const textBlock = response.content.find(block => block.type === 'text');
  return textBlock?.text || '';
}
