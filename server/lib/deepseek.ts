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
  const systemPrompt = `You are an expert construction bid writer specializing in creating winning proposals for construction companies.
Your task is to generate a comprehensive, professional HTML bid response.
Tone: ${params.tone || 'professional'}
Generate well-structured HTML content with headings, paragraphs, tables, and lists as needed.
Focus on highlighting safety records, past experience, and competitive advantages.`;

  const response = await openrouter.chat.completions.create({
    model: 'deepseek/deepseek-chat',
    max_tokens: 8192,
    messages: [
      { role: 'system', content: systemPrompt },
      { 
        role: 'user', 
        content: `User Instructions: ${params.instructions}\n\nRelevant Context from Documents and Past Winning Bids:\n${params.context}\n\nGenerate a complete, professional bid response in HTML format.`
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
Maintain the HTML structure and professional styling.`;

  const response = await openrouter.chat.completions.create({
    model: 'deepseek/deepseek-chat',
    max_tokens: 8192,
    messages: [
      { role: 'system', content: systemPrompt },
      { 
        role: 'user', 
        content: `Current Bid HTML:\n${params.currentHtml}\n\nUser Feedback: ${params.feedback}\n\nApply the feedback and return the updated complete HTML.`
      }
    ],
  });

  return response.choices[0]?.message?.content || '';
}
