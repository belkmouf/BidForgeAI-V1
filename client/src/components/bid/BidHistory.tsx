import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { History, Clock, FileText, Timer } from 'lucide-react';
import { listBids } from '@/lib/api';
import type { Bid } from '@shared/schema';

interface BidHistoryProps {
  projectId: string;
  onSelectBid: (content: string, bidId?: number) => void;
  refreshTrigger?: number;
}

export function BidHistory({ projectId, onSelectBid, refreshTrigger }: BidHistoryProps) {
  const [bids, setBids] = useState<Bid[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadBids() {
      if (!projectId) return;
      setIsLoading(true);
      setError(null);
      try {
        const bidsList = await listBids(projectId);
        setBids(bidsList);
      } catch (err: any) {
        setError(err.message || 'Failed to load bids');
      } finally {
        setIsLoading(false);
      }
    }
    loadBids();
  }, [projectId, refreshTrigger]);

  const formatDate = (date: Date | string) => {
    const d = new Date(date);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatGenerationTime = (seconds: number) => {
    if (seconds < 60) {
      return `${seconds}s`;
    }
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
  };

  const getModelDisplayName = (model: string) => {
    switch (model) {
      case 'anthropic':
        return 'Claude Sonnet';
      case 'gemini':
        return 'Gemini Flash';
      case 'deepseek':
        return 'DeepSeek';
      case 'openai':
        return 'GPT-4o';
      case 'multishot-agent':
        return 'Claude Sonnet';
      default:
        return model;
    }
  };

  const getModelColor = (model: string) => {
    switch (model) {
      case 'anthropic':
      case 'multishot-agent':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'gemini':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'deepseek':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'openai':
        return 'bg-green-100 text-green-800 border-green-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  if (isLoading) {
    return (
      <Card className="h-full">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <History className="h-4 w-4" />
            Bid History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">Loading...</div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="h-full">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <History className="h-4 w-4" />
            Bid History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-destructive">{error}</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full flex flex-col border-2 border-primary/30 max-w-[220px]">
      <CardHeader className="pb-3 flex-shrink-0">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <History className="h-4 w-4" />
          Bid History
          {bids.length > 0 && (
            <Badge variant="secondary" className="ml-auto text-xs">
              {bids.length} version{bids.length !== 1 ? 's' : ''}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden p-0">
        {bids.length === 0 ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No bids generated yet.</p>
            <p className="text-xs mt-1">Generate your first bid using the AI panel.</p>
          </div>
        ) : (
          <ScrollArea className="h-full">
            <div className="p-2 space-y-2">
              {bids.map((bid) => (
                <div
                  key={bid.id}
                  className="p-3 rounded-lg border-2 border-primary/30 bg-card hover:bg-accent/50 cursor-pointer transition-colors group"
                  onClick={() => onSelectBid(bid.rawContent || bid.content, bid.id)}
                  data-testid={`bid-history-item-${bid.id}`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-medium text-sm">
                        Version {bid.version}
                      </span>
                      <Badge variant="outline" className={`text-[10px] h-4 px-1 ${getModelColor(bid.model)}`}>
                        {getModelDisplayName(bid.model)}
                      </Badge>
                      {bid.isLatest && (
                        <Badge variant="default" className="text-[10px] h-4 px-1.5">
                          Latest
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {formatDate(bid.createdAt)}
                      {bid.generationTimeSeconds && (
                        <span className="flex items-center gap-0.5">
                          <Timer className="h-3 w-3" />
                          {formatGenerationTime(bid.generationTimeSeconds)}
                        </span>
                      )}
                    </div>
                  </div>
                  {bid.instructions && (
                    <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                      {bid.instructions}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
