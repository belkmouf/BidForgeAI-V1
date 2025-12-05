import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  CheckCircle2, 
  Target,
  BarChart3,
  RefreshCw,
  Info,
  Lightbulb,
  Shield,
  Clock
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { toast } from '@/hooks/use-toast';

interface FeatureBreakdown {
  name: string;
  displayName: string;
  score: number;
  weight: number;
  contribution: number;
  status: 'positive' | 'neutral' | 'negative';
  insight: string;
}

interface WinProbabilityResult {
  probability: number;
  confidence: number;
  featureScores: Record<string, number>;
  featureWeights: Record<string, number>;
  riskFactors: string[];
  strengthFactors: string[];
  recommendations: string[];
  breakdown: FeatureBreakdown[];
}

interface Props {
  projectId: string;
}

export function WinProbability({ projectId }: Props) {
  const queryClient = useQueryClient();
  const [showDetails, setShowDetails] = useState(false);

  const { data: prediction, isLoading, error } = useQuery({
    queryKey: ['win-probability', projectId],
    queryFn: async () => {
      const res = await fetch(`/api/win-probability/prediction/${projectId}`);
      if (res.status === 404) return null;
      if (!res.ok) throw new Error('Failed to fetch prediction');
      const data = await res.json();
      return data.prediction as WinProbabilityResult;
    },
  });

  const predictMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/win-probability/predict/${projectId}`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Failed to generate prediction');
      const data = await res.json();
      return data.prediction as WinProbabilityResult;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['win-probability', projectId] });
      toast({
        title: 'Prediction Generated',
        description: 'Win probability analysis complete',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Prediction Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const getProbabilityColor = (probability: number) => {
    if (probability >= 0.7) return 'text-green-500';
    if (probability >= 0.5) return 'text-yellow-500';
    if (probability >= 0.3) return 'text-orange-500';
    return 'text-red-500';
  };

  const getProbabilityBg = (probability: number) => {
    if (probability >= 0.7) return 'bg-green-500';
    if (probability >= 0.5) return 'bg-yellow-500';
    if (probability >= 0.3) return 'bg-orange-500';
    return 'bg-red-500';
  };

  const getStatusIcon = (status: 'positive' | 'neutral' | 'negative') => {
    switch (status) {
      case 'positive':
        return <TrendingUp className="h-4 w-4 text-green-500" />;
      case 'neutral':
        return <Target className="h-4 w-4 text-yellow-500" />;
      case 'negative':
        return <TrendingDown className="h-4 w-4 text-red-500" />;
    }
  };

  if (isLoading) {
    return (
      <Card data-testid="win-probability-loading">
        <CardContent className="flex items-center justify-center py-8">
          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!prediction) {
    return (
      <Card data-testid="win-probability-empty">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-deep-teal" />
            Win Probability
          </CardTitle>
          <CardDescription>
            Analyze your chances of winning this bid
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6">
            <Target className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">
              No prediction generated yet
            </p>
            <Button
              onClick={() => predictMutation.mutate()}
              disabled={predictMutation.isPending}
              data-testid="button-generate-prediction"
            >
              {predictMutation.isPending ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <BarChart3 className="h-4 w-4 mr-2" />
                  Generate Prediction
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <TooltipProvider>
      <Card data-testid="win-probability-card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-deep-teal" />
                Win Probability
              </CardTitle>
              <CardDescription>
                AI-powered analysis of bid success likelihood
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => predictMutation.mutate()}
              disabled={predictMutation.isPending}
              data-testid="button-refresh-prediction"
            >
              <RefreshCw className={`h-4 w-4 ${predictMutation.isPending ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Probability Score</p>
              <p className={`text-4xl font-bold ${getProbabilityColor(prediction.probability)}`} data-testid="text-probability">
                {Math.round(prediction.probability * 100)}%
              </p>
            </div>
            <div className="text-right space-y-1">
              <p className="text-sm text-muted-foreground">Confidence</p>
              <div className="flex items-center gap-2">
                <Progress value={prediction.confidence * 100} className="w-24" />
                <span className="text-sm font-medium" data-testid="text-confidence">
                  {Math.round(prediction.confidence * 100)}%
                </span>
              </div>
            </div>
          </div>

          <div className="w-full bg-muted rounded-full h-3">
            <div
              className={`h-3 rounded-full transition-all ${getProbabilityBg(prediction.probability)}`}
              style={{ width: `${prediction.probability * 100}%` }}
            />
          </div>

          {prediction.strengthFactors.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                Strengths
              </h4>
              <div className="flex flex-wrap gap-2">
                {prediction.strengthFactors.map((factor, i) => (
                  <Badge key={i} variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20" data-testid={`badge-strength-${i}`}>
                    {factor}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {prediction.riskFactors.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-orange-500" />
                Risk Factors
              </h4>
              <div className="flex flex-wrap gap-2">
                {prediction.riskFactors.map((factor, i) => (
                  <Badge key={i} variant="outline" className="bg-orange-500/10 text-orange-600 border-orange-500/20" data-testid={`badge-risk-${i}`}>
                    {factor}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {prediction.recommendations.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-yellow-500" />
                Recommendations
              </h4>
              <ul className="space-y-1">
                {prediction.recommendations.map((rec, i) => (
                  <li key={i} className="text-sm text-muted-foreground flex items-start gap-2" data-testid={`text-recommendation-${i}`}>
                    <span className="text-deep-teal mt-1">•</span>
                    {rec}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <Separator />

          <div>
            <Button
              variant="ghost"
              className="w-full justify-between"
              onClick={() => setShowDetails(!showDetails)}
              data-testid="button-toggle-details"
            >
              <span className="flex items-center gap-2">
                <Info className="h-4 w-4" />
                Feature Breakdown
              </span>
              <span>{showDetails ? '−' : '+'}</span>
            </Button>

            {showDetails && (
              <div className="mt-4 space-y-3">
                {prediction.breakdown.map((feature) => (
                  <div key={feature.name} className="space-y-1" data-testid={`feature-${feature.name}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(feature.status)}
                        <span className="text-sm font-medium">{feature.displayName}</span>
                        <Tooltip>
                          <TooltipTrigger>
                            <Info className="h-3 w-3 text-muted-foreground" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="max-w-xs">{feature.insight}</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">
                          {Math.round(feature.score * 100)}%
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {Math.round(feature.weight * 100)}% weight
                        </Badge>
                      </div>
                    </div>
                    <Progress 
                      value={feature.score * 100} 
                      className="h-2"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
