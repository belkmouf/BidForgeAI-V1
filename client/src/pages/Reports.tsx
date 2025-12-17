import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuthStore } from '@/lib/auth';
import { Link } from 'wouter';
import { 
  BarChart, 
  Bar, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  RadialBarChart,
  RadialBar
} from 'recharts';
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Target,
  Building2,
  Download,
  Plus,
  X,
  Settings2,
  GripVertical,
  FileSpreadsheet,
  BarChart3,
  PieChartIcon,
  Activity,
  DollarSign,
  Users,
  Calendar,
  RefreshCw
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

type WidgetType = 
  | 'win_rate_gauge'
  | 'monthly_trends'
  | 'project_type_breakdown'
  | 'client_performance'
  | 'revenue_by_status'
  | 'recent_outcomes'
  | 'avg_bid_amount'
  | 'prediction_accuracy';

interface DashboardWidget {
  id: string;
  type: WidgetType;
  title: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
  settings?: Record<string, any>;
}

interface DashboardConfig {
  id: number;
  userId: number;
  name: string;
  widgets: DashboardWidget[];
  dateRange: string;
}

interface OverviewData {
  periodDays: number;
  projects: {
    total: number;
    byStatus: Record<string, number>;
  };
  bidding: {
    totalBids: number;
    won: number;
    lost: number;
    winRate: number;
  };
  predictions: {
    total: number;
    averageProbability: number;
  };
}

interface TrendsData {
  periodDays: number;
  projects: { date: string; count: number }[];
  outcomes: { date: string; outcome: string; count: number }[];
}

interface ClientData {
  clients: {
    name: string;
    projects: number;
    won: number;
    lost: number;
    winRate: number | null;
  }[];
}

interface RevenueData {
  periodDays: number;
  byOutcome: {
    outcome: string;
    totalAmount: number;
    avgAmount: number;
    count: number;
  }[];
  monthly: {
    month: string;
    wonAmount: number;
    totalBidAmount: number;
    wonCount: number;
    lostCount: number;
    winRate: number;
  }[];
}

interface ProjectTypeData {
  types: {
    type: string;
    total: number;
    won: number;
    lost: number;
    winRate: number | null;
  }[];
}

const COLORS = ['#0d7377', '#b8995a', '#6366f1', '#ec4899', '#f59e0b', '#10b981', '#8b5cf6', '#f97316'];

const WIDGET_OPTIONS: { type: WidgetType; label: string; icon: typeof Target; description: string }[] = [
  { type: 'win_rate_gauge', label: 'Win Rate', icon: Target, description: 'Overall bid success rate' },
  { type: 'monthly_trends', label: 'Monthly Trends', icon: TrendingUp, description: 'Win/loss trends over time' },
  { type: 'project_type_breakdown', label: 'By Project Type', icon: PieChartIcon, description: 'Success by category' },
  { type: 'client_performance', label: 'Top Clients', icon: Building2, description: 'Performance by client' },
  { type: 'revenue_by_status', label: 'Revenue Analysis', icon: DollarSign, description: 'Bid amounts and revenue' },
  { type: 'recent_outcomes', label: 'Recent Outcomes', icon: Activity, description: 'Latest bid results' },
  { type: 'avg_bid_amount', label: 'Average Bid Value', icon: BarChart3, description: 'Mean bid amounts' },
  { type: 'prediction_accuracy', label: 'AI Predictions', icon: Target, description: 'Prediction accuracy stats' },
];

export default function Reports() {
  const [dateRange, setDateRange] = useState('30');
  const [localWidgets, setLocalWidgets] = useState<DashboardWidget[]>([]);
  const [isCustomizing, setIsCustomizing] = useState(false);
  const [showAddWidget, setShowAddWidget] = useState(false);
  const [hasInitialized, setHasInitialized] = useState(false);
  const { accessToken: token } = useAuthStore();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: config, isLoading: configLoading } = useQuery<DashboardConfig>({
    queryKey: ['dashboard-config'],
    queryFn: async () => {
      const res = await fetch('/api/analytics/dashboard-config', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch dashboard config');
      return res.json();
    },
    enabled: !!token,
  });

  const { data: overview } = useQuery<OverviewData>({
    queryKey: ['analytics-overview', dateRange],
    queryFn: async () => {
      const res = await fetch(`/api/analytics/overview?days=${dateRange}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch overview');
      return res.json();
    },
    enabled: !!token,
  });

  const { data: trends } = useQuery<TrendsData>({
    queryKey: ['analytics-trends', dateRange],
    queryFn: async () => {
      const res = await fetch(`/api/analytics/trends?days=${dateRange}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch trends');
      return res.json();
    },
    enabled: !!token,
  });

  const { data: clients } = useQuery<ClientData>({
    queryKey: ['analytics-clients'],
    queryFn: async () => {
      const res = await fetch('/api/analytics/clients', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch clients');
      return res.json();
    },
    enabled: !!token,
  });

  const { data: revenue } = useQuery<RevenueData>({
    queryKey: ['analytics-revenue', dateRange],
    queryFn: async () => {
      const res = await fetch(`/api/analytics/revenue-stats?days=${dateRange}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch revenue stats');
      return res.json();
    },
    enabled: !!token,
  });

  const { data: projectTypes } = useQuery<ProjectTypeData>({
    queryKey: ['analytics-project-types'],
    queryFn: async () => {
      const res = await fetch('/api/analytics/project-types', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch project types');
      return res.json();
    },
    enabled: !!token,
  });

  const updateConfigMutation = useMutation({
    mutationFn: async (updates: Partial<DashboardConfig>) => {
      const res = await fetch('/api/analytics/dashboard-config', {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error('Failed to save');
      return res.json();
    },
    onSuccess: (data) => {
      setLocalWidgets(data.widgets || []);
      queryClient.invalidateQueries({ queryKey: ['dashboard-config'] });
      toast({ title: 'Dashboard saved', description: 'Your layout has been saved.' });
    },
  });

  useEffect(() => {
    if (config && !hasInitialized) {
      setLocalWidgets(config.widgets || []);
      if (config.dateRange) {
        setDateRange(config.dateRange);
      }
      setHasInitialized(true);
    }
  }, [config, hasInitialized]);

  const widgets = localWidgets;

  const saveConfig = useCallback((newWidgets: DashboardWidget[]) => {
    updateConfigMutation.mutate({ 
      widgets: newWidgets,
      dateRange,
      name: config?.name || 'My Dashboard',
    });
  }, [dateRange, config?.name, updateConfigMutation]);

  const addWidget = (type: WidgetType) => {
    const option = WIDGET_OPTIONS.find(o => o.type === type);
    if (!option) return;
    
    const newWidget: DashboardWidget = {
      id: `${type}-${Date.now()}`,
      type,
      title: option.label,
      position: { x: 0, y: widgets.length },
      size: { width: 1, height: 1 },
    };
    
    const newWidgets = [...widgets, newWidget];
    setLocalWidgets(newWidgets);
    saveConfig(newWidgets);
    setShowAddWidget(false);
  };

  const removeWidget = (widgetId: string) => {
    const newWidgets = widgets.filter(w => w.id !== widgetId);
    setLocalWidgets(newWidgets);
    saveConfig(newWidgets);
  };

  const handleExport = async (format: 'csv' | 'json') => {
    try {
      const response = await fetch(`/api/reports/analytics?startDate=${getStartDate()}&endDate=${new Date().toISOString()}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      
      if (format === 'json') {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `analytics-report-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
      } else {
        const lines = [
          'Metric,Value',
          `Total Projects,${overview?.projects?.total || 0}`,
          `Total Bids,${overview?.bidding?.totalBids || 0}`,
          `Won,${overview?.bidding?.won || 0}`,
          `Lost,${overview?.bidding?.lost || 0}`,
          `Win Rate,${overview?.bidding?.winRate || 0}%`,
        ];
        const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `analytics-report-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
      }
      
      toast({ title: 'Export complete', description: `Report downloaded as ${format.toUpperCase()}` });
    } catch (error) {
      toast({ title: 'Export failed', variant: 'destructive' });
    }
  };

  const getStartDate = () => {
    const date = new Date();
    date.setDate(date.getDate() - parseInt(dateRange));
    return date.toISOString();
  };

  const renderWidget = (widget: DashboardWidget) => {
    const commonProps = {
      key: widget.id,
      className: "bg-gradient-to-br from-card via-card to-card/95 border border-border/50 shadow-xl hover:shadow-2xl transition-all duration-300 relative group backdrop-blur-sm",
    };

    const removeButton = isCustomizing && (
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-2 right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={() => removeWidget(widget.id)}
        data-testid={`remove-widget-${widget.id}`}
      >
        <X className="h-4 w-4" />
      </Button>
    );

    switch (widget.type) {
      case 'win_rate_gauge':
        const winRate = overview?.bidding?.winRate || 0;
        return (
          <Card {...commonProps} data-testid={`widget-${widget.id}`} className={`${commonProps.className} overflow-hidden relative`}>
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-secondary/5 opacity-50" />
            {removeButton}
            <CardHeader className="pb-3 relative z-10">
              <CardTitle className="text-lg font-display font-semibold flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
                  <Target className="h-5 w-5 text-primary" />
                </div>
                {widget.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="relative z-10">
              <div className="flex flex-col items-center py-4">
                <div className="relative">
                  <div className="text-6xl font-display font-bold bg-gradient-to-br from-primary via-primary to-secondary bg-clip-text text-transparent">
                    {winRate}%
                  </div>
                  <div className="absolute -top-2 -right-2">
                    {winRate >= 50 ? (
                      <TrendingUp className="h-6 w-6 text-emerald-500" />
                    ) : (
                      <TrendingDown className="h-6 w-6 text-amber-500" />
                    )}
                  </div>
                </div>
                <div className="text-sm text-muted-foreground mt-3 font-medium">
                  {overview?.bidding?.won || 0} won / {overview?.bidding?.totalBids || 0} total bids
                </div>
                <div className="flex gap-3 mt-6">
                  <Badge variant="outline" className="bg-gradient-to-r from-emerald-500/15 to-emerald-600/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 px-4 py-1.5 font-semibold shadow-sm">
                    Won: {overview?.bidding?.won || 0}
                  </Badge>
                  <Badge variant="outline" className="bg-gradient-to-r from-red-500/15 to-red-600/10 text-red-600 dark:text-red-400 border-red-500/30 px-4 py-1.5 font-semibold shadow-sm">
                    Lost: {overview?.bidding?.lost || 0}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        );

      case 'monthly_trends':
        const trendData = trends?.outcomes?.reduce((acc, item) => {
          const existing = acc.find(a => a.date === item.date);
          if (existing) {
            if (item.outcome === 'won') existing.won = item.count;
            if (item.outcome === 'lost') existing.lost = item.count;
          } else {
            acc.push({
              date: item.date,
              won: item.outcome === 'won' ? item.count : 0,
              lost: item.outcome === 'lost' ? item.count : 0,
            });
          }
          return acc;
        }, [] as { date: string; won: number; lost: number }[]) || [];

        return (
          <Card {...commonProps} data-testid={`widget-${widget.id}`} className={`${commonProps.className} overflow-hidden`}>
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-secondary/5 opacity-50" />
            {removeButton}
            <CardHeader className="pb-3 relative z-10">
              <CardTitle className="text-lg font-display font-semibold flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
                  <TrendingUp className="h-5 w-5 text-primary" />
                </div>
                {widget.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="relative z-10">
              <div className="h-[240px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={trendData.slice(-14)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                    <XAxis 
                      dataKey="date" 
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11, fontWeight: 500 }}
                      tickFormatter={(v) => v.slice(5)}
                      axisLine={{ stroke: 'hsl(var(--border))' }}
                    />
                    <YAxis 
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11, fontWeight: 500 }}
                      axisLine={{ stroke: 'hsl(var(--border))' }}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                      }}
                      labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 600 }}
                    />
                    <Bar dataKey="won" fill="hsl(var(--primary))" name="Won" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="lost" fill="#ef4444" name="Lost" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        );

      case 'project_type_breakdown':
        const typeData = projectTypes?.types?.slice(0, 6).map((t, i) => ({
          name: t.type,
          value: t.total,
          fill: COLORS[i % COLORS.length],
        })) || [];

        return (
          <Card {...commonProps} data-testid={`widget-${widget.id}`} className={`${commonProps.className} overflow-hidden`}>
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-secondary/5 opacity-50" />
            {removeButton}
            <CardHeader className="pb-3 relative z-10">
              <CardTitle className="text-lg font-display font-semibold flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
                  <PieChartIcon className="h-5 w-5 text-primary" />
                </div>
                {widget.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="relative z-10">
              <div className="h-[240px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={typeData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      labelLine={false}
                    >
                      {typeData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} stroke="hsl(var(--card))" strokeWidth={2} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        );

      case 'client_performance':
        const topClients = clients?.clients?.slice(0, 5) || [];
        return (
          <Card {...commonProps} data-testid={`widget-${widget.id}`} className={`${commonProps.className} overflow-hidden`}>
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-secondary/5 opacity-50" />
            {removeButton}
            <CardHeader className="pb-3 relative z-10">
              <CardTitle className="text-lg font-display font-semibold flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
                  <Building2 className="h-5 w-5 text-primary" />
                </div>
                {widget.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="relative z-10">
              <div className="space-y-4">
                {topClients.map((client, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/50 hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 border border-primary/30 flex items-center justify-center">
                        <span className="text-xs font-bold text-primary">{i + 1}</span>
                      </div>
                      <span className="truncate font-medium text-sm">{client.name}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant="secondary" className="text-xs font-semibold px-2.5 py-1">
                        {client.projects} projects
                      </Badge>
                      {client.winRate !== null && (
                        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full font-semibold text-xs ${
                          client.winRate >= 50 
                            ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30' 
                            : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                        }`}>
                          {client.winRate >= 50 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                          {client.winRate}%
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {topClients.length === 0 && (
                  <div className="text-center py-8">
                    <Building2 className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-muted-foreground text-sm font-medium">No client data yet</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        );

      case 'revenue_by_status':
        const revenueData = revenue?.byOutcome?.map((r, i) => ({
          name: r.outcome,
          value: r.totalAmount,
          fill: r.outcome === 'won' ? 'hsl(var(--primary))' : r.outcome === 'lost' ? '#ef4444' : COLORS[i],
        })) || [];

        return (
          <Card {...commonProps} data-testid={`widget-${widget.id}`} className={`${commonProps.className} overflow-hidden`}>
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-secondary/5 opacity-50" />
            {removeButton}
            <CardHeader className="pb-3 relative z-10">
              <CardTitle className="text-lg font-display font-semibold flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
                  <DollarSign className="h-5 w-5 text-primary" />
                </div>
                {widget.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="relative z-10">
              <div className="h-[240px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={revenueData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                    <XAxis 
                      type="number" 
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11, fontWeight: 500 }}
                      tickFormatter={(v) => `$${(v/1000000).toFixed(1)}M`}
                      axisLine={{ stroke: 'hsl(var(--border))' }}
                    />
                    <YAxis 
                      dataKey="name" 
                      type="category" 
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11, fontWeight: 500 }} 
                      width={70}
                      axisLine={{ stroke: 'hsl(var(--border))' }}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                      }}
                      formatter={(value: number) => [`$${value.toLocaleString()}`, 'Total Revenue']}
                    />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                      {revenueData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        );

      case 'recent_outcomes':
        const recentMonthly = revenue?.monthly?.slice(-6) || [];
        return (
          <Card {...commonProps} data-testid={`widget-${widget.id}`} className={`${commonProps.className} overflow-hidden`}>
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-secondary/5 opacity-50" />
            {removeButton}
            <CardHeader className="pb-3 relative z-10">
              <CardTitle className="text-lg font-display font-semibold flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
                  <Activity className="h-5 w-5 text-primary" />
                </div>
                {widget.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="relative z-10">
              <div className="h-[240px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={recentMonthly}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                    <XAxis 
                      dataKey="month" 
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11, fontWeight: 500 }}
                      tickFormatter={(v) => v.slice(5)}
                      axisLine={{ stroke: 'hsl(var(--border))' }}
                    />
                    <YAxis 
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11, fontWeight: 500 }}
                      axisLine={{ stroke: 'hsl(var(--border))' }}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                      }}
                    />
                    <Legend wrapperStyle={{ paddingTop: '20px' }} />
                    <Line 
                      type="monotone" 
                      dataKey="wonCount" 
                      stroke="hsl(var(--primary))" 
                      name="Won" 
                      strokeWidth={3}
                      dot={{ fill: 'hsl(var(--primary))', r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="lostCount" 
                      stroke="#ef4444" 
                      name="Lost" 
                      strokeWidth={3}
                      dot={{ fill: '#ef4444', r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        );

      case 'avg_bid_amount':
        const avgData = revenue?.byOutcome || [];
        const wonAvg = avgData.find(a => a.outcome === 'won')?.avgAmount || 0;
        const lostAvg = avgData.find(a => a.outcome === 'lost')?.avgAmount || 0;

        return (
          <Card {...commonProps} data-testid={`widget-${widget.id}`} className={`${commonProps.className} overflow-hidden`}>
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-secondary/5 opacity-50" />
            {removeButton}
            <CardHeader className="pb-3 relative z-10">
              <CardTitle className="text-lg font-display font-semibold flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
                  <BarChart3 className="h-5 w-5 text-primary" />
                </div>
                {widget.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="relative z-10">
              <div className="flex flex-col items-center space-y-6 py-4">
                <div className="grid grid-cols-2 gap-6 w-full">
                  <div className="text-center p-4 rounded-xl bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border border-emerald-500/20">
                    <div className="text-4xl font-display font-bold bg-gradient-to-br from-emerald-600 to-emerald-500 bg-clip-text text-transparent">
                      ${(wonAvg / 1000000).toFixed(1)}M
                    </div>
                    <div className="text-sm text-muted-foreground mt-2 font-medium">Avg Won Bid</div>
                  </div>
                  <div className="text-center p-4 rounded-xl bg-gradient-to-br from-red-500/10 to-red-600/5 border border-red-500/20">
                    <div className="text-4xl font-display font-bold bg-gradient-to-br from-red-600 to-red-500 bg-clip-text text-transparent">
                      ${(lostAvg / 1000000).toFixed(1)}M
                    </div>
                    <div className="text-sm text-muted-foreground mt-2 font-medium">Avg Lost Bid</div>
                  </div>
                </div>
                {wonAvg > lostAvg && (
                  <Badge variant="outline" className="bg-gradient-to-r from-emerald-500/15 to-emerald-600/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 px-4 py-2 font-semibold shadow-sm">
                    <TrendingUp className="h-4 w-4 mr-1.5" />
                    Winning bigger bids
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        );

      case 'prediction_accuracy':
        const avgProb = overview?.predictions?.averageProbability || 0;
        return (
          <Card {...commonProps} data-testid={`widget-${widget.id}`} className={`${commonProps.className} overflow-hidden relative`}>
            <div className="absolute inset-0 bg-gradient-to-br from-secondary/5 via-transparent to-primary/5 opacity-50" />
            {removeButton}
            <CardHeader className="pb-3 relative z-10">
              <CardTitle className="text-lg font-display font-semibold flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-secondary/10 border border-secondary/20">
                  <Target className="h-5 w-5 text-secondary" />
                </div>
                {widget.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="relative z-10">
              <div className="flex flex-col items-center py-4">
                <div className="relative">
                  <div className="text-6xl font-display font-bold bg-gradient-to-br from-secondary via-secondary to-primary bg-clip-text text-transparent">
                    {avgProb}%
                  </div>
                  <div className="absolute -top-2 -right-2">
                    <Target className="h-6 w-6 text-secondary/60" />
                  </div>
                </div>
                <div className="text-sm text-muted-foreground mt-3 font-medium">
                  Average Win Probability
                </div>
                <div className="mt-4 px-4 py-2 rounded-lg bg-secondary/10 border border-secondary/20">
                  <div className="text-xs text-muted-foreground font-medium">
                    {overview?.predictions?.total || 0} AI predictions analyzed
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        );

      default:
        return null;
    }
  };

  if (configLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary/20 border-t-primary"></div>
          <p className="text-muted-foreground font-medium">Loading executive dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20" data-testid="reports-page">
      {/* Premium Header Section */}
      <div className="border-b border-border/50 bg-gradient-to-r from-card/50 via-card to-card/50 backdrop-blur-sm sticky top-0 z-40">
        <div className="container mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <Link href="/dashboard">
                <Button variant="ghost" size="icon" className="hover:bg-primary/10 hover:text-primary transition-colors" data-testid="back-to-dashboard">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              </Link>
              <div>
                <h1 className="text-4xl font-display font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent" data-testid="reports-title">
                  Executive Analytics
                </h1>
                <p className="text-muted-foreground mt-1.5 font-medium">
                  Strategic insights for billion-dollar opportunities
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <Select value={dateRange} onValueChange={setDateRange}>
                <SelectTrigger className="w-[160px] border-border/50 bg-card/50 backdrop-blur-sm font-medium" data-testid="date-range-select">
                  <Calendar className="h-4 w-4 mr-2 text-primary" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">Last 7 days</SelectItem>
                  <SelectItem value="30">Last 30 days</SelectItem>
                  <SelectItem value="90">Last 90 days</SelectItem>
                  <SelectItem value="365">Last year</SelectItem>
                </SelectContent>
              </Select>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="border-border/50 bg-card/50 backdrop-blur-sm font-medium hover:bg-primary/10 hover:border-primary/50 transition-all" data-testid="export-button">
                    <Download className="h-4 w-4 mr-2" />
                    Export
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="bg-card/95 backdrop-blur-md border-border/50">
                  <DropdownMenuItem onClick={() => handleExport('csv')} className="cursor-pointer">
                    <FileSpreadsheet className="h-4 w-4 mr-2" />
                    Export as CSV
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExport('json')} className="cursor-pointer">
                    <Download className="h-4 w-4 mr-2" />
                    Export as JSON
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <Button
                variant={isCustomizing ? "default" : "outline"}
                onClick={() => setIsCustomizing(!isCustomizing)}
                className={isCustomizing ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" : "border-border/50 bg-card/50 backdrop-blur-sm font-medium hover:bg-primary/10 hover:border-primary/50"}
                data-testid="customize-button"
              >
                <Settings2 className="h-4 w-4 mr-2" />
                {isCustomizing ? 'Done' : 'Customize'}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-8">

        {isCustomizing && (
          <Card className="mb-8 bg-gradient-to-r from-primary/5 via-card to-secondary/5 border-2 border-dashed border-primary/30 shadow-lg">
            <CardContent className="py-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-foreground font-semibold mb-1">Customize Your Dashboard</p>
                  <p className="text-muted-foreground text-sm">
                    Click the X on widgets to remove them, or add new widgets below
                  </p>
                </div>
                <Dialog open={showAddWidget} onOpenChange={setShowAddWidget}>
                  <DialogTrigger asChild>
                    <Button variant="default" size="default" className="bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20 font-semibold" data-testid="add-widget-button">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Widget
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="bg-card/95 backdrop-blur-md border-border/50 max-w-2xl">
                    <DialogHeader>
                      <DialogTitle className="text-2xl font-display font-bold">Add Analytics Widget</DialogTitle>
                      <DialogDescription className="text-base">
                        Choose a widget to add to your executive dashboard
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid grid-cols-2 gap-4 mt-6">
                      {WIDGET_OPTIONS.map((option) => {
                        const Icon = option.icon;
                        const alreadyAdded = widgets.some(w => w.type === option.type);
                        return (
                          <button
                            key={option.type}
                            onClick={() => !alreadyAdded && addWidget(option.type)}
                            disabled={alreadyAdded}
                            className={`p-5 rounded-xl border-2 text-left transition-all duration-200 ${
                              alreadyAdded 
                                ? 'border-border/30 bg-muted/30 opacity-50 cursor-not-allowed'
                                : 'border-border/50 bg-card/50 hover:border-primary hover:bg-primary/5 hover:shadow-lg hover:scale-[1.02]'
                            }`}
                            data-testid={`add-widget-${option.type}`}
                          >
                            <div className="flex items-start gap-3">
                              <div className={`p-2.5 rounded-lg ${alreadyAdded ? 'bg-muted' : 'bg-primary/10 border border-primary/20'}`}>
                                <Icon className={`h-5 w-5 ${alreadyAdded ? 'text-muted-foreground' : 'text-primary'}`} />
                              </div>
                              <div className="flex-1">
                                <div className={`font-semibold text-sm mb-1 ${alreadyAdded ? 'text-muted-foreground' : 'text-foreground'}`}>{option.label}</div>
                                <div className="text-xs text-muted-foreground">{option.description}</div>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {widgets.map(widget => renderWidget(widget))}
        </div>

        {widgets.length === 0 && (
          <Card className="bg-gradient-to-br from-card via-card to-card/95 border-2 border-dashed border-border/50 shadow-xl">
            <CardContent className="py-16 text-center">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-primary/10 to-secondary/10 border-2 border-primary/20 mb-6">
                <BarChart3 className="h-10 w-10 text-primary" />
              </div>
              <h3 className="text-2xl font-display font-bold mb-2">Build Your Executive Dashboard</h3>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                Customize your analytics dashboard with widgets that matter most to your business
              </p>
              <Button 
                onClick={() => { setIsCustomizing(true); setShowAddWidget(true); }}
                className="bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20 font-semibold px-8"
                size="lg"
              >
                <Plus className="h-5 w-5 mr-2" />
                Add Your First Widget
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
