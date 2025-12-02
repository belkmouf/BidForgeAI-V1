import { useState } from 'react';
import { Sparkles, Wand2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface GeneratePanelProps {
  onGenerate: (instructions: string) => void;
  isGenerating: boolean;
}

export function GeneratePanel({ onGenerate, isGenerating }: GeneratePanelProps) {
  const [instructions, setInstructions] = useState('');
  const [tone, setTone] = useState('professional');

  const handleGenerate = () => {
    if (!instructions) return;
    onGenerate(instructions);
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
            <Label htmlFor="instructions">Instructions</Label>
            <Textarea
              id="instructions"
              placeholder="E.g., Draft an executive summary emphasizing our safety record and previous experience with similar high-rise renovations..."
              className="min-h-[120px] resize-none"
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
            />
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