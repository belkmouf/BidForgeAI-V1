import { useState, useEffect } from 'react';
import { Sparkles, Wand2, Loader2, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getAIInstructions, type AIModel, type AIInstruction } from '@/lib/api';
import { Link } from 'wouter';

interface GeneratePanelProps {
  onGenerate: (instructions: string, tone?: string, model?: AIModel) => void;
  isGenerating: boolean;
}

export function GeneratePanel({ onGenerate, isGenerating }: GeneratePanelProps) {
  const [instructions, setInstructions] = useState<AIInstruction[]>([]);
  const [selectedInstructionId, setSelectedInstructionId] = useState<string>('');
  const [tone, setTone] = useState('professional');
  const [model, setModel] = useState<AIModel>('openai');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchInstructions = async () => {
      try {
        const data = await getAIInstructions();
        setInstructions(data.instructions);
        // Select the default instruction or first one
        const defaultInstruction = data.instructions.find(i => i.isDefault) || data.instructions[0];
        if (defaultInstruction) {
          setSelectedInstructionId(String(defaultInstruction.id));
        }
      } catch (error) {
        console.error('Failed to fetch AI instructions:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchInstructions();
  }, []);

  const handleGenerate = () => {
    const selectedInstruction = instructions.find(i => String(i.id) === selectedInstructionId);
    if (!selectedInstruction) return;
    onGenerate(selectedInstruction.instructions, tone, model);
  };

  const selectedInstruction = instructions.find(i => String(i.id) === selectedInstructionId);

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
              <SelectTrigger id="tone" data-testid="select-tone">
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
              <Label htmlFor="instructions">Instructions Preset</Label>
              <Link href="/settings" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                <Settings className="h-3 w-3" />
                Manage
              </Link>
            </div>
            {isLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <Select value={selectedInstructionId} onValueChange={setSelectedInstructionId}>
                  <SelectTrigger id="instructions" data-testid="select-instructions">
                    <SelectValue placeholder="Select instruction preset" />
                  </SelectTrigger>
                  <SelectContent>
                    {instructions.map((instruction) => (
                      <SelectItem key={instruction.id} value={String(instruction.id)}>
                        {instruction.name}
                        {instruction.isDefault && ' (Default)'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedInstruction && (
                  <div className="p-3 bg-muted/50 rounded-md border text-xs text-muted-foreground max-h-[100px] overflow-y-auto">
                    {selectedInstruction.instructions.substring(0, 300)}
                    {selectedInstruction.instructions.length > 300 && '...'}
                  </div>
                )}
              </>
            )}
          </div>

          <Button 
            className="w-full gap-2 font-medium" 
            size="lg" 
            onClick={handleGenerate}
            disabled={isGenerating || !selectedInstructionId || isLoading}
            data-testid="button-generate-bid"
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