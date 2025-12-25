import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { CreditCard, Calendar, TrendingUp, AlertCircle, Check, Zap } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface SubscriptionPlan {
  id: number;
  name: string;
  displayName: string;
  tier: number;
  monthlyPrice: number | null;
  annualPrice: number | null;
  monthlyProjectLimit: number | null;
  monthlyDocumentLimit: number | null;
  monthlyBidLimit: number | null;
  extraProjectFee: number | null;
  extraProjectDocBonus: number | null;
}

interface Subscription {
  id: number;
  companyId: number;
  planId: number;
  status: string;
  billingCycle: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  monthlyPrice: number;
  finalPrice: number;
  extraProjectsPurchased: number;
}

interface TrialInfo {
  remainingHours: number;
  remainingDays: number;
  expiresAt: string;
  isExpired: boolean;
}

interface Usage {
  period: {
    start: string;
    end: string;
  };
  projects: {
    used: number;
    limit: number;
    remaining: number;
  };
  documents: {
    used: number;
    limit: number;
    remaining: number;
  };
  bids: {
    used: number;
    limit: number | null;
    remaining: number;
  };
}

export default function Billing() {
  const { data: subscriptionData, isLoading: loadingSubscription } = useQuery({
    queryKey: ['/api/billing/subscription'],
    queryFn: async () => {
      const res = await fetch('/api/billing/subscription', {
        credentials: 'include',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
        },
      });
      if (!res.ok) throw new Error('Failed to fetch subscription');
      return res.json();
    },
  });

  const { data: usageData, isLoading: loadingUsage } = useQuery({
    queryKey: ['/api/billing/usage'],
    queryFn: async () => {
      const res = await fetch('/api/billing/usage', {
        credentials: 'include',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
        },
      });
      if (!res.ok) throw new Error('Failed to fetch usage');
      return res.json();
    },
  });

  const { data: plansData } = useQuery({
    queryKey: ['/api/billing/plans'],
    queryFn: async () => {
      const res = await fetch('/api/billing/plans', {
        credentials: 'include',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
        },
      });
      if (!res.ok) throw new Error('Failed to fetch plans');
      return res.json();
    },
  });

  const subscription: Subscription | null = subscriptionData?.subscription;
  const plan: SubscriptionPlan | null = subscriptionData?.plan;
  const isTrial: boolean = subscriptionData?.isTrial || false;
  const trialInfo: TrialInfo | null = subscriptionData?.trialInfo;
  const usage: Usage | null = usageData?.usage;
  const plans: SubscriptionPlan[] = plansData?.plans || [];

  const isLoading = loadingSubscription || loadingUsage;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'MMM d, yyyy');
  };

  const getUsagePercentage = (used: number, limit: number | null) => {
    if (limit === null || limit === 999999999) return 0;
    return Math.min((used / limit) * 100, 100);
  };

  const getUsageColor = (percentage: number) => {
    if (percentage >= 90) return 'bg-red-500';
    if (percentage >= 70) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight" data-testid="text-billing-title">Billing & Subscription</h1>
        <p className="text-muted-foreground mt-2">
          Manage your subscription plan and monitor usage
        </p>
      </div>

      {isTrial && trialInfo && !trialInfo.isExpired && (
        <Alert className="mb-6 border-amber-500 bg-amber-50 dark:bg-amber-950/20">
          <AlertCircle className="h-4 w-4 text-amber-500" />
          <AlertDescription className="text-amber-700 dark:text-amber-300">
            Your free trial expires in <strong>{trialInfo.remainingDays} days</strong> ({trialInfo.remainingHours} hours).
            Upgrade to continue using BidForge AI.
          </AlertDescription>
        </Alert>
      )}

      {isTrial && trialInfo?.isExpired && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Your free trial has expired. Upgrade now to continue using BidForge AI.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-8">
        <Card data-testid="card-current-plan">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Current Plan</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-plan-name">{plan?.displayName || 'No Plan'}</div>
            {subscription && (
              <div className="flex items-center gap-2 mt-2">
                <Badge variant={subscription.status === 'active' ? 'default' : 'secondary'}>
                  {subscription.status}
                </Badge>
                {isTrial && <Badge variant="outline">Trial</Badge>}
              </div>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-billing-cycle">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Billing Period</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {subscription ? (
              <>
                <div className="text-2xl font-bold" data-testid="text-billing-amount">
                  ${subscription.finalPrice.toFixed(2)}
                  <span className="text-sm font-normal text-muted-foreground">
                    /{subscription.billingCycle === 'annual' ? 'year' : 'month'}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Renews {formatDate(subscription.currentPeriodEnd)}
                </p>
              </>
            ) : (
              <div className="text-2xl font-bold">-</div>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-extra-projects">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Extra Projects</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-extra-projects">
              {subscription?.extraProjectsPurchased || 0}
            </div>
            {plan?.extraProjectFee && (
              <p className="text-xs text-muted-foreground mt-1">
                ${plan.extraProjectFee}/project with +{plan.extraProjectDocBonus} docs
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {usage && (
        <Card className="mb-8" data-testid="card-usage">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Usage This Period
            </CardTitle>
            <CardDescription>
              {formatDate(usage.period.start)} - {formatDate(usage.period.end)}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm font-medium">Projects</span>
                <span className="text-sm text-muted-foreground" data-testid="text-projects-usage">
                  {usage.projects.used} / {usage.projects.limit === 999999999 ? '∞' : usage.projects.limit}
                </span>
              </div>
              <Progress 
                value={getUsagePercentage(usage.projects.used, usage.projects.limit)} 
                className={`h-2 ${getUsageColor(getUsagePercentage(usage.projects.used, usage.projects.limit))}`}
              />
            </div>

            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm font-medium">Documents</span>
                <span className="text-sm text-muted-foreground" data-testid="text-documents-usage">
                  {usage.documents.used} / {usage.documents.limit === 999999999 ? '∞' : usage.documents.limit}
                </span>
              </div>
              <Progress 
                value={getUsagePercentage(usage.documents.used, usage.documents.limit)} 
                className={`h-2 ${getUsageColor(getUsagePercentage(usage.documents.used, usage.documents.limit))}`}
              />
            </div>

            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm font-medium">Bid Generations</span>
                <span className="text-sm text-muted-foreground" data-testid="text-bids-usage">
                  {usage.bids.used} / {usage.bids.limit === null || usage.bids.limit === 999999999 ? '∞' : usage.bids.limit}
                </span>
              </div>
              <Progress 
                value={getUsagePercentage(usage.bids.used, usage.bids.limit)} 
                className={`h-2 ${getUsageColor(getUsagePercentage(usage.bids.used, usage.bids.limit))}`}
              />
            </div>
          </CardContent>
        </Card>
      )}

      <Card data-testid="card-available-plans">
        <CardHeader>
          <CardTitle>Available Plans</CardTitle>
          <CardDescription>
            Choose the plan that best fits your needs
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {plans.filter(p => p.tier > 0).map((p) => (
              <Card 
                key={p.id} 
                className={`relative ${plan?.id === p.id ? 'border-primary ring-2 ring-primary' : ''}`}
                data-testid={`card-plan-${p.name}`}
              >
                {plan?.id === p.id && (
                  <Badge className="absolute -top-2 left-1/2 -translate-x-1/2">Current</Badge>
                )}
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg">{p.displayName}</CardTitle>
                  <div className="text-3xl font-bold">
                    ${p.monthlyPrice?.toFixed(0)}
                    <span className="text-sm font-normal text-muted-foreground">/mo</span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Separator className="mb-4" />
                  <div className="text-sm space-y-2">
                    <div className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-500" />
                      <span>{p.monthlyProjectLimit === null ? 'Unlimited' : p.monthlyProjectLimit} projects</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-500" />
                      <span>{p.monthlyDocumentLimit} documents</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-500" />
                      <span>{p.monthlyBidLimit === null ? 'Unlimited' : p.monthlyBidLimit} bid generations</span>
                    </div>
                    {p.extraProjectFee && (
                      <div className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-green-500" />
                        <span>Extra projects: ${p.extraProjectFee}/ea</span>
                      </div>
                    )}
                  </div>
                  <Button 
                    className="w-full mt-4" 
                    variant={plan?.id === p.id ? 'outline' : 'default'}
                    disabled={plan?.id === p.id}
                    data-testid={`button-select-plan-${p.name}`}
                  >
                    {plan?.id === p.id ? 'Current Plan' : 'Upgrade'}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
