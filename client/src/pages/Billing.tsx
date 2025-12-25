import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  CreditCard, 
  Receipt, 
  TrendingUp, 
  Calendar, 
  CheckCircle2,
  AlertCircle,
  FileText,
  Download,
  ArrowLeft
} from 'lucide-react';
import { Link } from 'wouter';
import { format } from 'date-fns';

interface SubscriptionPlan {
  id: number;
  name: string;
  displayName: string;
  tier: number;
  basePrice: number;
  features: Record<string, any>;
  limits: Record<string, any>;
  includedCredits: Record<string, number>;
}

interface Subscription {
  id: number;
  status: string;
  billingCycle: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  basePrice: number;
  discountPercent: number;
  finalPrice: number;
  autoRenew: boolean;
  cancelAtPeriodEnd: boolean;
  plan: SubscriptionPlan | null;
}

interface UsageBreakdown {
  event_type: string;
  count: number;
  cost: number;
  included: number;
  overage: number;
}

interface UsageSummary {
  period_start: string;
  period_end: string;
  credits_remaining: Record<string, number>;
  usage_summary: {
    total_cost: number;
    included_cost: number;
    overage_cost: number;
  };
  breakdown: UsageBreakdown[];
}

interface Invoice {
  id: number;
  invoiceNumber: string;
  status: string;
  periodStart: string;
  periodEnd: string;
  totalAmount: number;
  currency: string;
  paidAt: string | null;
  pdfUrl: string | null;
  createdAt: string;
}

export default function Billing() {
  const { data: subscriptionData, isLoading: subscriptionLoading } = useQuery({
    queryKey: ['billing', 'subscription'],
    queryFn: async () => {
      const res = await fetch('/api/billing/subscription', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch subscription');
      return res.json() as Promise<{ subscription: Subscription | null; usage: UsageSummary | null }>;
    },
  });

  const { data: plansData } = useQuery({
    queryKey: ['billing', 'plans'],
    queryFn: async () => {
      const res = await fetch('/api/billing/plans', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch plans');
      return res.json() as Promise<{ plans: SubscriptionPlan[] }>;
    },
  });

  const { data: invoicesData } = useQuery({
    queryKey: ['billing', 'invoices'],
    queryFn: async () => {
      const res = await fetch('/api/billing/invoices', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch invoices');
      return res.json() as Promise<{ invoices: Invoice[] }>;
    },
  });

  const { data: creditsData } = useQuery({
    queryKey: ['billing', 'credits'],
    queryFn: async () => {
      const res = await fetch('/api/billing/credits', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch credits');
      return res.json() as Promise<{ credits: Record<string, { total: number; used: number; remaining: number }> }>;
    },
  });

  if (subscriptionLoading) {
    return (
      <div className="container mx-auto p-6 flex items-center justify-center min-h-[400px]">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  const subscription = subscriptionData?.subscription;
  const usage = subscriptionData?.usage;
  const plans = plansData?.plans || [];
  const invoices = invoicesData?.invoices || [];
  const credits = creditsData?.credits || {};

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/settings">
          <Button variant="ghost" size="icon" data-testid="button-back">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-billing-title">Billing & Subscription</h1>
          <p className="text-muted-foreground">Manage your subscription, usage, and invoices</p>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
          <TabsTrigger value="usage" data-testid="tab-usage">Usage</TabsTrigger>
          <TabsTrigger value="invoices" data-testid="tab-invoices">Invoices</TabsTrigger>
          <TabsTrigger value="plans" data-testid="tab-plans">Plans</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card data-testid="card-subscription">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Current Subscription
                </CardTitle>
              </CardHeader>
              <CardContent>
                {subscription ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-2xl font-semibold" data-testid="text-plan-name">
                          {subscription.plan?.displayName || 'Unknown Plan'}
                        </h3>
                        <p className="text-muted-foreground">
                          ${subscription.finalPrice.toFixed(2)}/{subscription.billingCycle}
                        </p>
                      </div>
                      <Badge 
                        variant={subscription.status === 'active' ? 'default' : 'secondary'}
                        data-testid="badge-subscription-status"
                      >
                        {subscription.status}
                      </Badge>
                    </div>
                    
                    <div className="text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        <span>
                          Current period: {format(new Date(subscription.currentPeriodStart), 'MMM d')} - {format(new Date(subscription.currentPeriodEnd), 'MMM d, yyyy')}
                        </span>
                      </div>
                    </div>

                    {subscription.cancelAtPeriodEnd && (
                      <div className="flex items-center gap-2 text-amber-600">
                        <AlertCircle className="h-4 w-4" />
                        <span className="text-sm">Cancels at end of period</span>
                      </div>
                    )}

                    <div className="flex gap-2 pt-2">
                      <Button variant="outline" size="sm" data-testid="button-manage-subscription">
                        Manage Subscription
                      </Button>
                      <Button variant="outline" size="sm" data-testid="button-change-plan">
                        Change Plan
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <p className="text-muted-foreground">No active subscription</p>
                    <Button data-testid="button-subscribe">Choose a Plan</Button>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card data-testid="card-usage-summary">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Usage This Period
                </CardTitle>
              </CardHeader>
              <CardContent>
                {usage ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Total Usage Cost</p>
                        <p className="text-2xl font-semibold" data-testid="text-total-cost">
                          ${usage.usage_summary.total_cost.toFixed(2)}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Overage Cost</p>
                        <p className="text-2xl font-semibold text-amber-600" data-testid="text-overage-cost">
                          ${usage.usage_summary.overage_cost.toFixed(2)}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <p className="text-sm font-medium">Credits Remaining</p>
                      {Object.entries(credits).map(([type, data]) => (
                        <div key={type} className="space-y-1">
                          <div className="flex justify-between text-sm">
                            <span className="capitalize">{type.replace(/_/g, ' ')}</span>
                            <span>{data.remaining} / {data.total}</span>
                          </div>
                          <Progress 
                            value={(data.remaining / data.total) * 100} 
                            className="h-2"
                          />
                        </div>
                      ))}
                      {Object.keys(credits).length === 0 && (
                        <p className="text-sm text-muted-foreground">No credits available</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-muted-foreground">No usage data available</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="usage" className="space-y-6">
          <Card data-testid="card-usage-details">
            <CardHeader>
              <CardTitle>Usage Breakdown</CardTitle>
              <CardDescription>
                Detailed usage for the current billing period
              </CardDescription>
            </CardHeader>
            <CardContent>
              {usage?.breakdown && usage.breakdown.length > 0 ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-5 gap-4 text-sm font-medium text-muted-foreground pb-2 border-b">
                    <div>Event Type</div>
                    <div className="text-right">Count</div>
                    <div className="text-right">Included</div>
                    <div className="text-right">Overage</div>
                    <div className="text-right">Cost</div>
                  </div>
                  {usage.breakdown.map((item) => (
                    <div 
                      key={item.event_type} 
                      className="grid grid-cols-5 gap-4 text-sm py-2 border-b last:border-0"
                      data-testid={`row-usage-${item.event_type}`}
                    >
                      <div className="capitalize font-medium">
                        {item.event_type.replace(/_/g, ' ')}
                      </div>
                      <div className="text-right">{item.count}</div>
                      <div className="text-right text-green-600">{item.included}</div>
                      <div className="text-right text-amber-600">{item.overage}</div>
                      <div className="text-right font-medium">${item.cost.toFixed(2)}</div>
                    </div>
                  ))}
                  <div className="grid grid-cols-5 gap-4 text-sm font-semibold pt-2 border-t">
                    <div>Total</div>
                    <div className="text-right">
                      {usage.breakdown.reduce((acc, i) => acc + i.count, 0)}
                    </div>
                    <div className="text-right text-green-600">
                      {usage.breakdown.reduce((acc, i) => acc + i.included, 0)}
                    </div>
                    <div className="text-right text-amber-600">
                      {usage.breakdown.reduce((acc, i) => acc + i.overage, 0)}
                    </div>
                    <div className="text-right">${usage.usage_summary.total_cost.toFixed(2)}</div>
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-8">No usage recorded this period</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="invoices" className="space-y-6">
          <Card data-testid="card-invoices">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Receipt className="h-5 w-5" />
                Invoice History
              </CardTitle>
            </CardHeader>
            <CardContent>
              {invoices.length > 0 ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-6 gap-4 text-sm font-medium text-muted-foreground pb-2 border-b">
                    <div>Invoice #</div>
                    <div>Period</div>
                    <div>Amount</div>
                    <div>Status</div>
                    <div>Date</div>
                    <div></div>
                  </div>
                  {invoices.map((invoice) => (
                    <div 
                      key={invoice.id} 
                      className="grid grid-cols-6 gap-4 text-sm py-2 border-b last:border-0 items-center"
                      data-testid={`row-invoice-${invoice.id}`}
                    >
                      <div className="font-mono">{invoice.invoiceNumber}</div>
                      <div>
                        {format(new Date(invoice.periodStart), 'MMM d')} - {format(new Date(invoice.periodEnd), 'MMM d')}
                      </div>
                      <div className="font-medium">
                        ${invoice.totalAmount.toFixed(2)} {invoice.currency}
                      </div>
                      <div>
                        <Badge 
                          variant={invoice.status === 'paid' ? 'default' : invoice.status === 'draft' ? 'secondary' : 'destructive'}
                        >
                          {invoice.status}
                        </Badge>
                      </div>
                      <div className="text-muted-foreground">
                        {format(new Date(invoice.createdAt), 'MMM d, yyyy')}
                      </div>
                      <div>
                        {invoice.pdfUrl && (
                          <Button variant="ghost" size="sm" asChild>
                            <a href={invoice.pdfUrl} target="_blank" rel="noopener noreferrer">
                              <Download className="h-4 w-4" />
                            </a>
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <FileText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground">No invoices yet</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="plans" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-3">
            {plans.map((plan) => (
              <Card 
                key={plan.id} 
                className={subscription?.plan?.id === plan.id ? 'border-primary' : ''}
                data-testid={`card-plan-${plan.id}`}
              >
                <CardHeader>
                  <CardTitle>{plan.displayName}</CardTitle>
                  <CardDescription>
                    <span className="text-2xl font-bold">${plan.basePrice}</span>
                    <span className="text-muted-foreground">/month</span>
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    {Object.entries(plan.features || {}).map(([feature, enabled]) => (
                      enabled && (
                        <div key={feature} className="flex items-center gap-2 text-sm">
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                          <span className="capitalize">{feature.replace(/_/g, ' ')}</span>
                        </div>
                      )
                    ))}
                  </div>
                  
                  {plan.limits && Object.keys(plan.limits).length > 0 && (
                    <div className="pt-2 border-t space-y-1">
                      <p className="text-sm font-medium">Limits</p>
                      {Object.entries(plan.limits).map(([limit, value]) => (
                        <div key={limit} className="flex justify-between text-sm text-muted-foreground">
                          <span className="capitalize">{limit.replace(/_/g, ' ')}</span>
                          <span>{value as string | number}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <Button 
                    className="w-full" 
                    variant={subscription?.plan?.id === plan.id ? 'outline' : 'default'}
                    disabled={subscription?.plan?.id === plan.id}
                    data-testid={`button-select-plan-${plan.id}`}
                  >
                    {subscription?.plan?.id === plan.id ? 'Current Plan' : 'Select Plan'}
                  </Button>
                </CardContent>
              </Card>
            ))}
            {plans.length === 0 && (
              <div className="col-span-3 text-center py-8">
                <p className="text-muted-foreground">No plans available</p>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
