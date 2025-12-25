export class CostCalculator {
  calculateDocumentProcessingCost(
    documentType: string,
    pages: number,
    requiresOCR: boolean
  ): number {
    let cost = 0;
    
    if (documentType === 'pdf') {
      cost += pages * 0.001;
    } else if (documentType === 'docx') {
      cost += pages * 0.0005;
    }
    
    if (requiresOCR) {
      cost += pages * 0.01;
    }
    
    return cost;
  }
  
  calculateAnalysisCost(analysisType: 'basic' | 'deep'): number {
    if (analysisType === 'basic') {
      return 1.00;
    } else {
      return 50.00;
    }
  }
  
  calculateGenerationCost(
    model: string,
    inputTokens: number,
    outputTokens: number
  ): number {
    const pricing: Record<string, { input: number; output: number }> = {
      'gpt-4o': { input: 0.03, output: 0.06 },
      'claude-sonnet-4': { input: 0.003, output: 0.015 },
      'gemini-flash': { input: 0.0001, output: 0.0004 },
      'deepseek': { input: 0.00014, output: 0.00028 },
    };
    
    const rates = pricing[model] || pricing['deepseek'];
    const inputCost = (inputTokens / 1000) * rates.input;
    const outputCost = (outputTokens / 1000) * rates.output;
    
    return inputCost + outputCost;
  }
  
  calculateBlueprintCost(analysisType: 'ocr' | 'sketch'): number {
    if (analysisType === 'ocr') {
      return 25.00;
    } else {
      return 10.00;
    }
  }
}

export const costCalculator = new CostCalculator();
