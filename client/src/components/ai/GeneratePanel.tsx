import { useState } from 'react';
import { Sparkles, Wand2, Loader2, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { AIModel } from '@/lib/api';

const DEFAULT_INSTRUCTIONS = `Generate a comprehensive construction bid response that includes:

1. Executive Summary - Highlight our key strengths and value proposition
2. Company Qualifications - Our experience, certifications, and relevant past projects
3. Technical Approach - Methodology, equipment, and materials we'll use
4. Project Timeline - Detailed schedule with milestones
5. Safety Plan - Our safety protocols and track record
6. Quality Assurance - How we ensure high-quality deliverables
7. Pricing Structure - Cost breakdown with line items
8. Terms & Conditions - Payment terms, warranties, and guarantees

Focus on addressing all requirements from the RFP documents and emphasize our competitive advantages.`;

interface GeneratePanelProps {
  onGenerate: (instructions: string, tone?: string, model?: AIModel) => void;
  isGenerating: boolean;
}

export function GeneratePanel({ onGenerate, isGenerating }: GeneratePanelProps) {
  const [instructions, setInstructions] = useState(DEFAULT_INSTRUCTIONS);
  const [tone, setTone] = useState('professional');
  const [model, setModel] = useState<AIModel>('anthropic');

  const handleReset = () => {
    setInstructions(DEFAULT_INSTRUCTIONS);
  };

  const handleGenerate = () => {
    if (!instructions) return;
    onGenerate(instructions, tone, model);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-primary font-display font-semibold">
        <Sparkles className="h-5 w-5" />
        <h3>AI Bid Generator</h3>
      </div>

      <Card className="p-4 bg-card border-border shadow-sm">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="model">AI Model</Label>
            <Select value={model} onValueChange={(v) => setModel(v as AIModel)}>
              <SelectTrigger id="model" data-testid="select-ai-model">
                <SelectValue placeholder="Select AI model" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="anthropic">Anthropic Claude</SelectItem>
                <SelectItem value="gemini">Google Gemini</SelectItem>
                <SelectItem value="deepseek">DeepSeek</SelectItem>
                <SelectItem value="openai">OpenAI GPT-4o</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="tone">Tone & Style</Label>
            <Select value={tone} onValueChange={setTone}>
              <SelectTrigger id="tone">
                <SelectValue placeholder="Select tone" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="professional">Professional & Formal</SelectItem>
                <SelectItem value="persuasive">Persuasive & Sales-focused</SelectItem>
                <SelectItem value="technical">Highly Technical</SelectItem>
                <SelectItem value="concise">Concise & Direct</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="instructions">Instructions</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
                onClick={handleReset}
                data-testid="button-reset-instructions"
              >
                <RotateCcw className="h-3 w-3 mr-1" />
                Reset
              </Button>
            </div>
            <Textarea
              id="instructions"
              placeholder="Enter your bid generation instructions..."
              className="min-h-[200px] resize-y text-sm"
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              data-testid="textarea-instructions"
            />
            <p className="text-xs text-muted-foreground">
              Modify the instructions above to customize what the AI generates. Click Reset to restore defaults.
            </p>
          </div>

          <Button 
            className="w-full gap-2 font-medium" 
            size="lg" 
            onClick={handleGenerate}
            disabled={isGenerating || !instructions}
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating Bid...
              </>
            ) : (
              <>
                <Wand2 className="h-4 w-4" />
                Generate Draft
              </>
            )}
          </Button>
        </div>
      </Card>

      <div className="bg-primary/5 rounded-lg p-4 border border-primary/10">
        <h4 className="text-xs font-bold text-primary uppercase tracking-wider mb-2">RAG Context Active</h4>
        <p className="text-xs text-muted-foreground">
          The AI will automatically retrieve relevant sections from the uploaded RFP documents and your historical "Closed-Won" projects to ensure accuracy.
        </p>
      </div>
    </div>
  );
}