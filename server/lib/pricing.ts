// LMM pricing per 1K tokens (approximate costs)
const MODEL_PRICING = {
  openai: { input: 0.005, output: 0.015 }, // GPT-4o
  anthropic: { input: 0.003, output: 0.015 }, // Claude 3.5 Sonnet
  gemini: { input: 0.00075, output: 0.003 }, // Gemini 1.5 Pro
  deepseek: { input: 0.00028, output: 0.0011 }, // DeepSeek
  grok: { input: 0.003, output: 0.015 }, // Grok-4 (xAI)
  'multishot-agent': { input: 0.005, output: 0.015 }, // Agent workflow (uses multiple models, estimate based on GPT-4o)
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
    grok: 0.12,
    'multishot-agent': 0.25, // Higher estimate for multi-step agent workflow
  };
  return estimates[model] || 0.1;
}

// Estimate LMM cost for agent workflows based on typical token usage
// Agent workflows typically use ~10k input tokens and ~5k output tokens per run
export function estimateAgentWorkflowCost(model: string = 'deepseek'): number {
  const pricing = MODEL_PRICING[model as keyof typeof MODEL_PRICING] || MODEL_PRICING.openai;
  // Estimate: ~10k input tokens, ~5k output tokens per agent workflow
  const estimatedInputTokens = 10000;
  const estimatedOutputTokens = 5000;
  const inputCost = (estimatedInputTokens / 1000) * pricing.input;
  const outputCost = (estimatedOutputTokens / 1000) * pricing.output;
  return Math.round((inputCost + outputCost) * 10000) / 10000;
}
