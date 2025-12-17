import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  Area,
  AreaChart,
  Legend
} from 'recharts';
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Target,
  Users,
  FileText,
  Award,
  Activity,
  BarChart3,
  PieChartIcon,
  Building2,
  AlertTriangle,
  CheckCircle,
  Clock,
  Download,
  FileSpreadsheet
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

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
  documents: {
    total: number;
    processed: number;
  };
  users: {
    activeInPeriod: number;
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
  activity: { date: string; count: number }[];
  predictions: { date: string; avgProbability: number; count: number }[];
}

interface ClientData {
  clients: {
    name: string;
    projects: number;
    active: number;
    won: number;
    lost: number;
    winRate: number | null;
  }[];
}

interface AnalysisInsights {
  periodDays: number;
  averageScores: {
    quality: number;
    doability: number;
    clarity: number;
    vendorRisk: number;
  };
  totalAnalyses: number;
  riskDistribution: Record<string, number>;
  trends: { date: string; count: number; avgDoability: number }[];
}

const COLORS = ['#0d7377', '#b8995a', '#6366f1', '#ec4899', '#f59e0b', '#10b981'];

export default function Analytics() {
  const [period, setPeriod] = useState('30');
  const { accessToken: token } = useAuthStore();
  const { toast } = useToast();

  const handleExport = async (type: 'projects' | 'outcomes' | 'analytics') => {
    try {
      let url = '';
      let filename = '';
      
      if (type === 'projects') {
        url = '/api/reports/export/projects/csv';
        filename = `projects-${new Date().toISOString().split('T')[0]}.csv`;
      } else if (type === 'outcomes') {
        url = '/api/reports/export/outcomes/csv';
        filename = `bid-outcomes-${new Date().toISOString().split('T')[0]}.csv`;
      } else {
        url = `/api/reports/analytics?startDate=${new Date(Date.now() - parseInt(period) * 24 * 60 * 60 * 1000).toISOString()}`;
        filename = `analytics-report-${new Date().toISOString().split('T')[0]}.json`;
      }

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error('Export failed');

      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(downloadUrl);

      toast({ title: 'Export successful', description: `Downloaded ${filename}` });
    } catch (error) {
      toast({ title: 'Export failed', variant: 'destructive' });
    }
  };

  const { data: overview, isLoading: loadingOverview } = useQuery<OverviewData>({
    queryKey: ['analytics-overview', period],
    queryFn: async () => {
      const res = await fetch(`/api/analytics/overview?days=${period}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch overview');
      return res.json();
    },
    enabled: !!token,
  });

  const { data: trends, isLoading: loadingTrends } = useQuery<TrendsData>({
    queryKey: ['analytics-trends', period],
    queryFn: async () => {
      const res = await fetch(`/api/analytics/trends?days=${period}`, {
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

  const { data: insights } = useQuery<AnalysisInsights>({
    queryKey: ['analytics-insights', period],
    queryFn: async () => {
      const res = await fetch(`/api/analytics/analysis-insights?days=${period}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch insights');
      return res.json();
    },
    enabled: !!token,
  });

  const statusData = overview ? [
    { name: 'Active', value: overview.projects.byStatus['Active'] || 0, color: '#0d7377' },
    { name: 'Submitted', value: overview.projects.byStatus['Submitted'] || 0, color: '#6366f1' },
    { name: 'Won', value: overview.projects.byStatus['Closed-Won'] || 0, color: '#10b981' },
    { name: 'Lost', value: overview.projects.byStatus['Closed-Lost'] || 0, color: '#ef4444' },
  ].filter(d => d.value > 0) : [];

  const riskData = insights ? Object.entries(insights.riskDistribution).map(([name, value]) => ({
    name,
    value,
    color: name === 'Low' ? '#10b981' : name === 'Medium' ? '#f59e0b' : name === 'High' ? '#f97316' : '#ef4444',
  })) : [];

  return (
    <div className="min-h-screen bg-background text-slate-900">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8 p-4 border border-primary/20 rounded-xl bg-card shadow-md">
          <div className="flex items-center gap-4">
            <Link href="/dashboard">
              <Button variant="ghost" size="icon" className="text-slate-600 hover:text-slate-900 border-2 border-primary/20">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold font-display text-slate-900">Analytics Dashboard</h1>
              <p className="text-slate-600 mt-1">Company-wide performance metrics and insights</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-40 border border-primary/20 bg-white" data-testid="select-period">
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
                <Button variant="outline" className="gap-2 border border-primary/20" data-testid="button-export">
                  <Download className="h-4 w-4" />
                  Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleExport('projects')}>
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Projects (CSV)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport('outcomes')}>
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Bid Outcomes (CSV)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport('analytics')}>
                  <FileText className="h-4 w-4 mr-2" />
                  Analytics Report (JSON)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <MetricCard
            title="Win Rate"
            value={`${overview?.bidding.winRate || 0}%`}
            icon={Target}
            trend={overview?.bidding.winRate && overview.bidding.winRate > 50 ? 'up' : 'down'}
            subtitle={`${overview?.bidding.won || 0} won / ${overview?.bidding.totalBids || 0} total`}
            color="text-primary"
          />
          <MetricCard
            title="Active Projects"
            value={overview?.projects.byStatus['Active'] || 0}
            icon={FileText}
            subtitle={`${overview?.projects.total || 0} total projects`}
            color="text-secondary"
          />
          <MetricCard
            title="Documents Processed"
            value={overview?.documents.processed || 0}
            icon={CheckCircle}
            subtitle={`${overview?.documents.total || 0} total documents`}
            color="text-emerald-500"
          />
          <MetricCard
            title="Active Users"
            value={overview?.users.activeInPeriod || 0}
            icon={Users}
            subtitle={`In last ${period} days`}
            color="text-purple-500"
          />
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="bg-card border border-primary/20">
            <TabsTrigger value="overview" className="data-[state=active]:bg-primary data-[state=active]:text-white">
              <BarChart3 className="h-4 w-4 mr-2" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="trends" className="data-[state=active]:bg-primary data-[state=active]:text-white">
              <Activity className="h-4 w-4 mr-2" />
              Trends
            </TabsTrigger>
            <TabsTrigger value="clients" className="data-[state=active]:bg-primary data-[state=active]:text-white">
              <Building2 className="h-4 w-4 mr-2" />
              Clients
            </TabsTrigger>
            <TabsTrigger value="insights" className="data-[state=active]:bg-primary data-[state=active]:text-white">
              <AlertTriangle className="h-4 w-4 mr-2" />
              Analysis Insights
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Project Status Distribution */}
              <Card className="border border-primary/20 bg-card shadow-md">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <PieChartIcon className="h-5 w-5 text-primary" />
                    Project Status Distribution
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {statusData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={250}>
                      <PieChart>
                        <Pie
                          data={statusData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          paddingAngle={2}
                          dataKey="value"
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        >
                          {statusData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333' }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[250px] flex items-center justify-center text-gray-500">
                      No project data available
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Win/Loss Breakdown */}
              <Card className="border border-primary/20 bg-card shadow-md">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Award className="h-5 w-5 text-secondary" />
                    Bidding Performance
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    <div className="flex items-center justify-center">
                      <div className="text-center">
                        <div className="text-5xl font-bold text-primary">
                          {overview?.bidding.winRate || 0}%
                        </div>
                        <div className="text-slate-500 mt-1">Win Rate</div>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div className="p-4 rounded-lg bg-green-50 border border-green-300">
                        <div className="text-2xl font-bold text-green-600">{overview?.bidding.won || 0}</div>
                        <div className="text-sm text-slate-600">Won</div>
                      </div>
                      <div className="p-4 rounded-lg bg-red-50 border border-red-300">
                        <div className="text-2xl font-bold text-red-600">{overview?.bidding.lost || 0}</div>
                        <div className="text-sm text-slate-600">Lost</div>
                      </div>
                      <div className="p-4 rounded-lg bg-blue-50 border border-blue-300">
                        <div className="text-2xl font-bold text-blue-600">{overview?.bidding.totalBids || 0}</div>
                        <div className="text-sm text-slate-600">Total</div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="trends" className="space-y-6">
            <div className="grid grid-cols-1 gap-6">
              {/* Project Creation Trend */}
              <Card className="border border-primary/20 bg-card shadow-md">
                <CardHeader>
                  <CardTitle>Projects Created Over Time</CardTitle>
                  <CardDescription>New projects created in the selected period</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={trends?.projects || []}>
                      <defs>
                        <linearGradient id="colorProjects" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#0d7377" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#0d7377" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                      <XAxis 
                        dataKey="date" 
                        stroke="#666"
                        tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      />
                      <YAxis stroke="#666" />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333' }}
                        labelFormatter={(value) => new Date(value).toLocaleDateString()}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="count" 
                        stroke="#0d7377" 
                        fillOpacity={1} 
                        fill="url(#colorProjects)" 
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Activity Trend */}
              <Card className="border border-primary/20 bg-card shadow-md">
                <CardHeader>
                  <CardTitle>User Activity</CardTitle>
                  <CardDescription>System activity over time</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={trends?.activity || []}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                      <XAxis 
                        dataKey="date" 
                        stroke="#666"
                        tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      />
                      <YAxis stroke="#666" />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333' }}
                        labelFormatter={(value) => new Date(value).toLocaleDateString()}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="count" 
                        stroke="#b8995a" 
                        strokeWidth={2}
                        dot={{ fill: '#b8995a', r: 4 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="clients" className="space-y-6">
            <Card className="border border-primary/20 bg-card shadow-md">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-primary" />
                  Client Performance
                </CardTitle>
                <CardDescription>Project statistics by client</CardDescription>
              </CardHeader>
              <CardContent>
                {clients?.clients && clients.clients.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-slate-200">
                          <th className="text-left py-3 px-4 text-slate-600 font-medium">Client</th>
                          <th className="text-center py-3 px-4 text-slate-600 font-medium">Projects</th>
                          <th className="text-center py-3 px-4 text-slate-600 font-medium">Active</th>
                          <th className="text-center py-3 px-4 text-slate-600 font-medium">Won</th>
                          <th className="text-center py-3 px-4 text-slate-600 font-medium">Lost</th>
                          <th className="text-center py-3 px-4 text-slate-600 font-medium">Win Rate</th>
                        </tr>
                      </thead>
                      <tbody>
                        {clients.clients.map((client, idx) => (
                          <tr key={idx} className="border-b border-slate-200 hover:bg-slate-50">
                            <td className="py-3 px-4 font-medium">{client.name}</td>
                            <td className="text-center py-3 px-4">{client.projects}</td>
                            <td className="text-center py-3 px-4">
                              <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/20">
                                {client.active}
                              </Badge>
                            </td>
                            <td className="text-center py-3 px-4">
                              <Badge variant="outline" className="bg-green-500/10 text-green-400 border-green-500/20">
                                {client.won}
                              </Badge>
                            </td>
                            <td className="text-center py-3 px-4">
                              <Badge variant="outline" className="bg-red-500/10 text-red-400 border-red-500/20">
                                {client.lost}
                              </Badge>
                            </td>
                            <td className="text-center py-3 px-4">
                              {client.winRate !== null ? (
                                <span className={client.winRate >= 50 ? 'text-green-400' : 'text-red-400'}>
                                  {client.winRate}%
                                </span>
                              ) : (
                                <span className="text-gray-500">-</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center text-gray-500 py-8">
                    No client data available
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="insights" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Average Analysis Scores */}
              <Card className="border border-primary/20 bg-card shadow-md">
                <CardHeader>
                  <CardTitle>Average Analysis Scores</CardTitle>
                  <CardDescription>Based on {insights?.totalAnalyses || 0} analyses</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <ScoreBar label="Quality" value={insights?.averageScores.quality || 0} color="bg-primary" />
                    <ScoreBar label="Doability" value={insights?.averageScores.doability || 0} color="bg-emerald-500" />
                    <ScoreBar label="Clarity" value={insights?.averageScores.clarity || 0} color="bg-blue-500" />
                    <ScoreBar label="Vendor Risk" value={100 - (insights?.averageScores.vendorRisk || 0)} color="bg-amber-500" inverted />
                  </div>
                </CardContent>
              </Card>

              {/* Risk Distribution */}
              <Card className="border border-primary/20 bg-card shadow-md">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-amber-500" />
                    Risk Level Distribution
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {riskData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={250}>
                      <PieChart>
                        <Pie
                          data={riskData}
                          cx="50%"
                          cy="50%"
                          outerRadius={100}
                          dataKey="value"
                          label={({ name, value }) => `${name}: ${value}`}
                        >
                          {riskData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333' }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[250px] flex items-center justify-center text-gray-500">
                      No risk data available
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

interface MetricCardProps {
  title: string;
  value: string | number;
  icon: typeof Target;
  trend?: 'up' | 'down';
  subtitle?: string;
  color?: string;
}

function MetricCard({ title, value, icon: Icon, trend, subtitle, color = 'text-primary' }: MetricCardProps) {
  return (
    <Card className="border border-primary/20 bg-card shadow-md">
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-slate-600">{title}</p>
            <p className={`text-3xl font-bold mt-1 ${color}`}>{value}</p>
            {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
          </div>
          <div className={`p-3 rounded-lg border border-primary/20 bg-white`}>
            <Icon className={`h-6 w-6 ${color}`} />
          </div>
        </div>
        {trend && (
          <div className={`flex items-center mt-2 text-sm ${trend === 'up' ? 'text-green-500' : 'text-red-500'}`}>
            {trend === 'up' ? <TrendingUp className="h-4 w-4 mr-1" /> : <TrendingDown className="h-4 w-4 mr-1" />}
            {trend === 'up' ? 'Above target' : 'Below target'}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface ScoreBarProps {
  label: string;
  value: number;
  color: string;
  inverted?: boolean;
}

function ScoreBar({ label, value, color, inverted }: ScoreBarProps) {
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-slate-600">{label}</span>
        <span className="font-medium">{inverted ? `${100 - value}% risk` : `${value}%`}</span>
      </div>
      <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
        <div 
          className={`h-full ${color} rounded-full transition-all duration-500`}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}
