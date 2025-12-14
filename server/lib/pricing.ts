// LMM pricing per 1K tokens (approximate costs)
const MODEL_PRICING = {
  openai: { input: 0.005, output: 0.015 }, // GPT-4o
  anthropic: { input: 0.003, output: 0.015 }, // Claude 3.5 Sonnet
  gemini: { input: 0.00075, output: 0.003 }, // Gemini 1.5 Pro
  deepseek: { input: 0.00028, output: 0.0011 }, // DeepSeek
};

export function calculateLMMCost(model: string, inputTokens: number, outputTokens: number): number {
  const pricing = MODEL_PRICING[model as keyof typeof MODEL_PRICING] || MODEL_PRICING.openai;
  const inputCost = (inputTokens / 1000) * pricing.input;
  const outputCost = (outputTokens / 1000) * pricing.output;
  return Math.round((inputCost + outputCost) * 10000) / 10000; // Round to 4 decimals
}

// Estimate cost based on typical bid generation (rough estimates)
export function estimateBidGenerationCost(model: string): number {
  const estimates: Record<string, number> = {
    openai: 0.15,
    anthropic: 0.12,
    gemini: 0.08,
    deepseek: 0.05,
  };
  return estimates[model] || 0.1;
}
