import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { 
  Bot, 
  CheckCircle2, 
  XCircle, 
  RefreshCw, 
  AlertTriangle,
  MessageSquare,
  Loader2,
  ChevronDown,
  ChevronUp,
  Maximize2,
  Minimize2
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface AgentMessage {
  role: 'orchestrator' | 'agent' | 'system';
  agentName?: string;
  content: string;
  timestamp: Date;
  iteration?: number;
  evaluation?: {
    accepted: boolean;
    score: number;
    reasoning: string;
    improvements: string[];
    criticalIssues: string[];
  };
}

interface ProgressEvent {
  type: 'agent_start' | 'agent_output' | 'evaluation' | 'refinement_request' | 'agent_complete' | 'workflow_complete' | 'error' | 'connected';
  agentName: string;
  iteration: number;
  message: string;
  data?: unknown;
  timestamp: Date;
}

interface AgentProgressPanelProps {
  projectId: string;
  isActive: boolean;
  onComplete?: () => void;
  onCancel?: () => void;
}

const agentColors: Record<string, string> = {
  intake: 'bg-blue-500',
  sketch: 'bg-purple-500',
  analysis: 'bg-amber-500',
  decision: 'bg-green-500',
  generation: 'bg-indigo-500',
  review: 'bg-rose-500',
  workflow: 'bg-teal-500',
};

const agentLabels: Record<string, string> = {
  intake: 'Document Intake',
  sketch: 'Sketch Analysis',
  analysis: 'RFP Analysis',
  decision: 'Decision Making',
  generation: 'Bid Generation',
  review: 'Quality Review',
  workflow: 'Workflow',
};

function EvaluationDetails({ data }: { data: unknown }) {
  const evalData = data as {
    score?: number;
    reasoning?: string;
    improvements?: string[];
  };

  return (
    <div className="mt-2 p-2 rounded bg-muted/50 text-xs space-y-1">
      {evalData.score !== undefined && (
        <div className="flex items-center gap-2">
          <span className="font-medium">Score:</span>
          <Badge
            variant={evalData.score >= 75 ? 'default' : 'destructive'}
            className={evalData.score >= 75 ? 'bg-green-500' : undefined}
          >
            {evalData.score}/100
          </Badge>
        </div>
      )}
      {evalData.reasoning && (
        <p>
          <span className="font-medium">Reasoning:</span>{' '}
          {evalData.reasoning}
        </p>
      )}
      {evalData.improvements && evalData.improvements.length > 0 && (
        <div>
          <span className="font-medium">Improvements:</span>
          <ul className="list-disc list-inside mt-1">
            {evalData.improvements.map((imp: string, i: number) => (
              <li key={i}>{imp}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function AgentProgressPanel({ projectId, isActive, onComplete, onCancel }: AgentProgressPanelProps) {
  const [events, setEvents] = useState<ProgressEvent[]>([]);
  const [currentAgent, setCurrentAgent] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'running' | 'completed' | 'failed'>('idle');
  const [expandedEvents, setExpandedEvents] = useState<Set<number>>(new Set());
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isExpanded, setIsExpanded] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Timer to track elapsed time
  useEffect(() => {
    if (status === 'running' && startTime) {
      timerRef.current = setInterval(() => {
        setElapsedSeconds(Math.floor((Date.now() - startTime.getTime()) / 1000));
      }, 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [status, startTime]);

  const formatElapsedTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    if (!isActive || !projectId) return;

    const eventSource = new EventSource(`/api/agent-progress/progress/${projectId}`, {
      withCredentials: true
    });
    eventSourceRef.current = eventSource;

    eventSource.onmessage = (event) => {
      try {
        const rawData = JSON.parse(event.data);
        
        if (rawData.type === 'connected') {
          return;
        }

        const data: ProgressEvent = {
          ...rawData,
          timestamp: new Date(rawData.timestamp),
        };
        
        setEvents((prev) => [...prev, data]);

        if (data.type === 'agent_start') {
          setCurrentAgent(data.agentName);
          if (status !== 'running') {
            setStartTime(new Date());
            setElapsedSeconds(0);
          }
          setStatus('running');
        } else if (data.type === 'workflow_complete') {
          setStatus('completed');
          onComplete?.();
        } else if (data.type === 'error') {
          setStatus('failed');
        }

        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
      } catch (error) {
        console.error('Failed to parse SSE event:', error);
      }
    };

    eventSource.onerror = () => {
      console.error('SSE connection error');
    };

    return () => {
      eventSource.close();
      eventSourceRef.current = null;
    };
  }, [projectId, isActive, onComplete]);

  const toggleExpanded = (index: number) => {
    setExpandedEvents((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const getEventIcon = (event: ProgressEvent) => {
    switch (event.type) {
      case 'agent_start':
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
      case 'agent_output':
        return <MessageSquare className="h-4 w-4 text-gray-500" />;
      case 'evaluation':
        const evalData = event.data as { accepted?: boolean; score?: number } | undefined;
        return evalData?.accepted ? (
          <CheckCircle2 className="h-4 w-4 text-green-500" />
        ) : (
          <AlertTriangle className="h-4 w-4 text-amber-500" />
        );
      case 'refinement_request':
        return <RefreshCw className="h-4 w-4 text-purple-500" />;
      case 'agent_complete':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'workflow_complete':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Bot className="h-4 w-4 text-gray-400" />;
    }
  };

  const getProgress = () => {
    const agentOrder = ['intake', 'sketch', 'analysis', 'decision', 'generation', 'review'];
    const completedAgents = new Set(
      events
        .filter((e) => e.type === 'agent_complete')
        .map((e) => e.agentName)
    );
    return (completedAgents.size / agentOrder.length) * 100;
  };

  const completedAgents = events
    .filter((e) => e.type === 'agent_complete')
    .map((e) => e.agentName);

  const panelContent = (
    <>
      <CardHeader className="py-3 border-b">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Bot className="h-4 w-4" />
            AI Agent Progress
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => setIsExpanded(!isExpanded)}
              data-testid="button-expand-progress"
              title={isExpanded ? "Collapse" : "Expand"}
            >
              {isExpanded ? (
                <Minimize2 className="h-4 w-4" />
              ) : (
                <Maximize2 className="h-4 w-4" />
              )}
            </Button>
            <Badge
              variant={
                status === 'running'
                  ? 'default'
                  : status === 'completed'
                  ? 'default'
                  : status === 'failed'
                  ? 'destructive'
                  : 'secondary'
              }
              className={status === 'completed' ? 'bg-green-500' : undefined}
              data-testid="agent-status-badge"
            >
              {status === 'running' && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </Badge>
          </div>
        </div>
        {status === 'running' && (
          <div className="mt-2">
            <Progress value={getProgress()} className="h-2" />
            <div className="flex items-center justify-between mt-1">
              <p className="text-xs text-muted-foreground flex items-center gap-2">
                <span>{currentAgent && agentLabels[currentAgent]} running...</span>
                <span className="font-mono text-primary font-medium" data-testid="elapsed-time">
                  {formatElapsedTime(elapsedSeconds)}
                </span>
              </p>
              {onCancel && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs text-destructive hover:text-destructive"
                  onClick={onCancel}
                  data-testid="button-cancel-workflow"
                >
                  <XCircle className="h-3 w-3 mr-1" />
                  Cancel
                </Button>
              )}
            </div>
          </div>
        )}
      </CardHeader>

      <CardContent className="flex-1 p-0 overflow-hidden">
        <div className="flex gap-2 p-3 border-b bg-muted/30">
          {['intake', 'analysis', 'decision', 'generation', 'review'].map((agent) => (
            <Badge
              key={agent}
              variant={
                completedAgents.includes(agent)
                  ? 'default'
                  : currentAgent === agent
                  ? 'outline'
                  : 'secondary'
              }
              className={cn(
                'text-xs',
                completedAgents.includes(agent) && agentColors[agent],
                currentAgent === agent && 'animate-pulse'
              )}
              data-testid={`agent-badge-${agent}`}
            >
              {agentLabels[agent]}
            </Badge>
          ))}
        </div>

        <ScrollArea className="h-[calc(100%-60px)]" ref={scrollRef}>
          <div className="p-3 space-y-2">
            {events.length === 0 && (
              <div className="text-center text-muted-foreground py-8">
                <Bot className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Waiting for agent activity...</p>
              </div>
            )}

            {events.map((event, index) => (
              <div
                key={index}
                className={cn(
                  'rounded-lg border p-3 text-sm transition-colors',
                  event.type === 'error' && 'border-red-500/50 bg-red-50 dark:bg-red-950/20',
                  event.type === 'workflow_complete' && 'border-green-500/50 bg-green-50 dark:bg-green-950/20'
                )}
                data-testid={`agent-event-${index}`}
              >
                <div className="flex items-start gap-2">
                  {getEventIcon(event)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          'text-xs font-medium px-1.5 py-0.5 rounded',
                          agentColors[event.agentName] || 'bg-gray-500',
                          'text-white'
                        )}
                      >
                        {agentLabels[event.agentName] || event.agentName}
                      </span>
                      {event.iteration > 0 && (
                        <span className="text-xs text-muted-foreground">
                          Iter {event.iteration}
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground ml-auto">
                        {new Date(event.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="mt-1 text-muted-foreground">{event.message}</p>

                    {event.data !== undefined && event.type === 'evaluation' ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="mt-2 h-6 px-2 text-xs"
                        onClick={() => toggleExpanded(index)}
                      >
                        {expandedEvents.has(index) ? (
                          <span className="flex items-center">
                            <ChevronUp className="h-3 w-3 mr-1" />
                            Hide Details
                          </span>
                        ) : (
                          <span className="flex items-center">
                            <ChevronDown className="h-3 w-3 mr-1" />
                            Show Details
                          </span>
                        )}
                      </Button>
                    ) : null}

                    {expandedEvents.has(index) && event.data !== undefined ? (
                      <EvaluationDetails data={event.data} />
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </>
  );

  // Expanded modal view
  if (isExpanded) {
    return (
      <>
        {/* Backdrop */}
        <div 
          className="fixed inset-0 bg-black/50 z-40 animate-in fade-in duration-200"
          onClick={() => setIsExpanded(false)}
          data-testid="progress-modal-backdrop"
        />
        {/* Centered modal */}
        <Card 
          className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[90vw] max-w-3xl h-[80vh] z-50 flex flex-col shadow-2xl animate-in zoom-in-95 duration-200"
          data-testid="agent-progress-panel-expanded"
        >
          {panelContent}
        </Card>
      </>
    );
  }

  // Collapsed inline view
  return (
    <Card className="h-full flex flex-col" data-testid="agent-progress-panel">
      {panelContent}
    </Card>
  );
}
