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
      className: "bg-charcoal-light border-charcoal-lighter relative group",
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
        return (
          <Card {...commonProps} data-testid={`widget-${widget.id}`}>
            {removeButton}
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Target className="h-5 w-5 text-deep-teal" />
                {widget.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center">
                <div className="text-5xl font-bold text-deep-teal">
                  {overview?.bidding?.winRate || 0}%
                </div>
                <div className="text-sm text-muted-foreground mt-2">
                  {overview?.bidding?.won || 0} won / {overview?.bidding?.totalBids || 0} total
                </div>
                <div className="flex gap-4 mt-4">
                  <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
                    Won: {overview?.bidding?.won || 0}
                  </Badge>
                  <Badge variant="outline" className="bg-red-500/10 text-red-400 border-red-500/30">
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
          <Card {...commonProps} data-testid={`widget-${widget.id}`}>
            {removeButton}
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-deep-teal" />
                {widget.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={trendData.slice(-14)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis 
                      dataKey="date" 
                      tick={{ fill: '#9ca3af', fontSize: 10 }}
                      tickFormatter={(v) => v.slice(5)}
                    />
                    <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#1f2937', border: 'none' }}
                      labelStyle={{ color: '#fff' }}
                    />
                    <Bar dataKey="won" fill="#10b981" name="Won" />
                    <Bar dataKey="lost" fill="#ef4444" name="Lost" />
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
          <Card {...commonProps} data-testid={`widget-${widget.id}`}>
            {removeButton}
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <PieChartIcon className="h-5 w-5 text-deep-teal" />
                {widget.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={typeData}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={70}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      labelLine={false}
                    >
                      {typeData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#1f2937', border: 'none' }}
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
          <Card {...commonProps} data-testid={`widget-${widget.id}`}>
            {removeButton}
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Building2 className="h-5 w-5 text-deep-teal" />
                {widget.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {topClients.map((client, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <span className="truncate max-w-[150px]">{client.name}</span>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">
                        {client.projects} projects
                      </Badge>
                      {client.winRate !== null && (
                        <span className={client.winRate >= 50 ? 'text-emerald-400' : 'text-amber-400'}>
                          {client.winRate}%
                        </span>
                      )}
                    </div>
                  </div>
                ))}
                {topClients.length === 0 && (
                  <p className="text-muted-foreground text-sm">No client data yet</p>
                )}
              </div>
            </CardContent>
          </Card>
        );

      case 'revenue_by_status':
        const revenueData = revenue?.byOutcome?.map((r, i) => ({
          name: r.outcome,
          value: r.totalAmount,
          fill: r.outcome === 'won' ? '#10b981' : r.outcome === 'lost' ? '#ef4444' : COLORS[i],
        })) || [];

        return (
          <Card {...commonProps} data-testid={`widget-${widget.id}`}>
            {removeButton}
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-deep-teal" />
                {widget.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={revenueData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis type="number" tick={{ fill: '#9ca3af', fontSize: 10 }} 
                      tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`}
                    />
                    <YAxis dataKey="name" type="category" tick={{ fill: '#9ca3af', fontSize: 10 }} width={60} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#1f2937', border: 'none' }}
                      formatter={(value: number) => [`$${value.toLocaleString()}`, 'Total']}
                    />
                    <Bar dataKey="value" radius={4}>
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
          <Card {...commonProps} data-testid={`widget-${widget.id}`}>
            {removeButton}
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Activity className="h-5 w-5 text-deep-teal" />
                {widget.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={recentMonthly}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis 
                      dataKey="month" 
                      tick={{ fill: '#9ca3af', fontSize: 10 }}
                      tickFormatter={(v) => v.slice(5)}
                    />
                    <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#1f2937', border: 'none' }}
                    />
                    <Legend />
                    <Line type="monotone" dataKey="wonCount" stroke="#10b981" name="Won" strokeWidth={2} />
                    <Line type="monotone" dataKey="lostCount" stroke="#ef4444" name="Lost" strokeWidth={2} />
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
          <Card {...commonProps} data-testid={`widget-${widget.id}`}>
            {removeButton}
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-deep-teal" />
                {widget.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center space-y-4">
                <div className="grid grid-cols-2 gap-6 w-full">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-emerald-400">
                      ${(wonAvg / 1000).toFixed(0)}k
                    </div>
                    <div className="text-sm text-muted-foreground">Avg Won Bid</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-red-400">
                      ${(lostAvg / 1000).toFixed(0)}k
                    </div>
                    <div className="text-sm text-muted-foreground">Avg Lost Bid</div>
                  </div>
                </div>
                {wonAvg > lostAvg && (
                  <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
                    <TrendingUp className="h-3 w-3 mr-1" />
                    Winning bigger bids
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        );

      case 'prediction_accuracy':
        return (
          <Card {...commonProps} data-testid={`widget-${widget.id}`}>
            {removeButton}
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Target className="h-5 w-5 text-deep-teal" />
                {widget.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center">
                <div className="text-4xl font-bold text-antique-gold">
                  {overview?.predictions?.averageProbability || 0}%
                </div>
                <div className="text-sm text-muted-foreground mt-2">
                  Avg Win Probability
                </div>
                <div className="text-sm text-muted-foreground">
                  {overview?.predictions?.total || 0} predictions made
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
      <div className="min-h-screen bg-charcoal flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-deep-teal"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-charcoal" data-testid="reports-page">
      <div className="container mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link href="/dashboard">
              <Button variant="ghost" size="icon" data-testid="back-to-dashboard">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold font-display" data-testid="reports-title">
                Reports Dashboard
              </h1>
              <p className="text-muted-foreground">
                Track bid success rates and identify trends
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger className="w-[140px]" data-testid="date-range-select">
                <Calendar className="h-4 w-4 mr-2" />
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
                <Button variant="outline" data-testid="export-button">
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => handleExport('csv')}>
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Export as CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport('json')}>
                  <Download className="h-4 w-4 mr-2" />
                  Export as JSON
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              variant={isCustomizing ? "default" : "outline"}
              onClick={() => setIsCustomizing(!isCustomizing)}
              data-testid="customize-button"
            >
              <Settings2 className="h-4 w-4 mr-2" />
              {isCustomizing ? 'Done' : 'Customize'}
            </Button>
          </div>
        </div>

        {isCustomizing && (
          <Card className="mb-6 bg-charcoal-light border-deep-teal/30 border-dashed">
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <p className="text-muted-foreground text-sm">
                  Customizing dashboard. Click the X on widgets to remove them.
                </p>
                <Dialog open={showAddWidget} onOpenChange={setShowAddWidget}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" data-testid="add-widget-button">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Widget
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="bg-charcoal-light border-charcoal-lighter">
                    <DialogHeader>
                      <DialogTitle>Add Widget</DialogTitle>
                      <DialogDescription>
                        Choose a widget to add to your dashboard
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid grid-cols-2 gap-3 mt-4">
                      {WIDGET_OPTIONS.map((option) => {
                        const Icon = option.icon;
                        const alreadyAdded = widgets.some(w => w.type === option.type);
                        return (
                          <button
                            key={option.type}
                            onClick={() => !alreadyAdded && addWidget(option.type)}
                            disabled={alreadyAdded}
                            className={`p-4 rounded-lg border text-left transition-colors ${
                              alreadyAdded 
                                ? 'border-charcoal-lighter bg-charcoal opacity-50 cursor-not-allowed'
                                : 'border-charcoal-lighter hover:border-deep-teal hover:bg-charcoal'
                            }`}
                            data-testid={`add-widget-${option.type}`}
                          >
                            <Icon className="h-5 w-5 text-deep-teal mb-2" />
                            <div className="font-medium text-sm">{option.label}</div>
                            <div className="text-xs text-muted-foreground">{option.description}</div>
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
          <Card className="bg-charcoal-light border-charcoal-lighter">
            <CardContent className="py-12 text-center">
              <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No widgets added</h3>
              <p className="text-muted-foreground mb-4">
                Click "Customize" to add widgets to your dashboard
              </p>
              <Button onClick={() => { setIsCustomizing(true); setShowAddWidget(true); }}>
                <Plus className="h-4 w-4 mr-2" />
                Add Your First Widget
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
