import { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

interface Message {
  id: string;
  role: 'user' | 'ai';
  content: string;
  timestamp: Date;
}

interface RefineChatProps {
  onRefine: (feedback: string) => void;
}

export function RefineChat({ onRefine }: RefineChatProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'ai',
      content: 'I can help you refine this bid. What would you like to change? You can ask me to "expand the safety section" or "make the tone more persuasive".',
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const handleSend = () => {
    if (!input.trim()) return;

    const newMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, newMsg]);
    onRefine(input);
    setInput('');

    // Simulate AI response
    setTimeout(() => {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'ai',
        content: `I'm updating the document based on your request: "${input}". Check the editor for changes.`,
        timestamp: new Date()
      }]);
    }, 1000);
  };

  return (
    <div className="flex flex-col h-full border-t border-border pt-2 mt-2">
      <div className="flex items-center gap-2 mb-3 px-1">
        <div className="bg-secondary p-1.5 rounded-md">
          <Bot className="h-4 w-4 text-primary" />
        </div>
        <h3 className="font-semibold text-sm">Refinement Chat</h3>
      </div>

      <ScrollArea className="flex-1 pr-4 -mr-4">
        <div className="space-y-4 pb-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                "flex gap-3 text-sm",
                msg.role === 'user' ? "flex-row-reverse" : "flex-row"
              )}
            >
              <Avatar className="h-8 w-8 border border-border">
                <AvatarFallback className={cn(
                  "text-xs",
                  msg.role === 'ai' ? "bg-primary/10 text-primary" : "bg-secondary text-secondary-foreground"
                )}>
                  {msg.role === 'ai' ? <Sparkles className="h-4 w-4" /> : "You"}
                </AvatarFallback>
              </Avatar>
              <div
                className={cn(
                  "rounded-lg px-3 py-2 max-w-[80%] border-2",
                  msg.role === 'user' 
                    ? "bg-primary text-primary-foreground border-primary" 
                    : "bg-muted text-foreground border-primary/30"
                )}
              >
                {msg.content}
              </div>
            </div>
          ))}
          <div ref={scrollRef} />
        </div>
      </ScrollArea>

      <div className="flex gap-2 mt-2 pt-2">
        <Input
          placeholder="Refine this bid..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          className="flex-1 border-2 border-primary/30"
        />
        <Button size="icon" onClick={handleSend} disabled={!input.trim()} className="border-2 border-primary/30">
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}