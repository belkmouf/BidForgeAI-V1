import { useEffect, useState } from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from 'recharts';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  MoreHorizontal, 
  Plus, 
  ArrowUpRight, 
  ArrowDownRight, 
  Calendar,
  Search,
  Filter
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Link } from 'wouter';
import { listProjects, getDashboardStats } from '@/lib/api';
import { useAuthStore } from '@/lib/auth';
import type { Project } from '@shared/schema';

export default function Dashboard() {
  const user = useAuthStore((state) => state.user);
  const [projects, setProjects] = useState<Project[]>([]);
  const [stats, setStats] = useState<{
    pipeline: Record<string, number>;
    winRate: number;
    totalProjects: number;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [projectsData, statsData] = await Promise.all([
          listProjects(),
          getDashboardStats()
        ]);
        setProjects(projectsData);
        setStats(statsData);
      } catch (error) {
        console.error('Failed to load dashboard data:', error);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  const pipelineData = stats ? [
    { name: 'Active', value: stats.pipeline.Active || 0, color: '#0d7377' },
    { name: 'Submitted', value: stats.pipeline.Submitted || 0, color: '#14b8a6' },
    { name: 'Closed-Won', value: stats.pipeline['Closed-Won'] || 0, color: '#c8a962' },
    { name: 'Closed-Lost', value: stats.pipeline['Closed-Lost'] || 0, color: '#ef4444' },
  ] : [];

  const displayStats = stats ? [
    { label: 'Total Projects', value: stats.totalProjects.toString(), trend: 'neutral' as const, change: '' },
    { label: 'Active Bids', value: (stats.pipeline.Active || 0).toString(), trend: 'up' as const, change: '+2 this week' },
    { label: 'Win Rate', value: `${stats.winRate}%`, trend: (stats.winRate >= 50 ? 'up' : 'down') as 'up' | 'down', change: `${stats.pipeline['Closed-Won'] || 0} won` },
    { label: 'Submitted', value: (stats.pipeline.Submitted || 0).toString(), trend: 'neutral' as const, change: 'Awaiting decisions' },
  ] : [];

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar />
      <main className="flex-1 ml-64 p-8 overflow-auto">
        <div className="max-w-7xl mx-auto space-y-8">
          
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              {user?.companyName && (
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-medium text-primary bg-primary/10 px-3 py-1 rounded-full">
                    {user.companyName}
                  </span>
                </div>
              )}
              <h1 className="text-3xl font-display font-bold tracking-tight text-foreground">Dashboard</h1>
              <p className="text-muted-foreground mt-1">Welcome back{user?.name ? `, ${user.name}` : ''}. Here's what's happening with your bids.</p>
            </div>
            <div className="flex gap-3">
               <Button variant="outline" className="gap-2">
                <Filter className="h-4 w-4" />
                Filter
               </Button>
               <Link href="/projects/new">
                <Button className="gap-2 shadow-lg shadow-primary/20">
                  <Plus className="h-4 w-4" />
                  New Project
                </Button>
               </Link>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {displayStats.map((stat, i) => (
              <Card key={i} className="hover:shadow-md transition-shadow border-border bg-slate-50 shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {stat.label}
                  </CardTitle>
                  {stat.trend === 'up' ? (
                    <ArrowUpRight className="h-4 w-4 text-green-500" />
                  ) : stat.trend === 'down' ? (
                    <ArrowDownRight className="h-4 w-4 text-red-500" />
                  ) : (
                    <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                  )}
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold font-display">{stat.value}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    <span className={stat.trend === 'up' ? "text-green-600 font-medium" : stat.trend === 'down' ? "text-red-600 font-medium" : ""}>
                      {stat.change}
                    </span>
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Left Column: Projects Table */}
            <div className="lg:col-span-2 space-y-6">
              <Card className="border-border bg-slate-50 shadow-sm h-full">
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Recent Projects</CardTitle>
                    <CardDescription>Manage your active bids and proposals</CardDescription>
                  </div>
                  <div className="relative w-64">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Search projects..." className="pl-9 bg-muted/50 border-0" />
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead>Project Name</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Value</TableHead>
                        <TableHead>Due Date</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {projects.map((project) => (
                        <TableRow key={project.id} className="group cursor-pointer hover:bg-muted/40">
                          <TableCell className="font-medium">
                            <div className="flex flex-col">
                              <span className="font-semibold text-foreground group-hover:text-primary transition-colors">{project.name}</span>
                              <span className="text-xs text-muted-foreground">{project.clientName}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={
                              project.status === 'Active' ? 'default' : 
                              project.status === 'Closed-Won' ? 'secondary' : 
                              project.status === 'Submitted' ? 'outline' : 'destructive'
                            } className={
                              project.status === 'Active' ? 'bg-primary hover:bg-primary/90' : 
                              project.status === 'Closed-Won' ? 'bg-green-100 text-green-800 hover:bg-green-200 border-green-200' : 
                              project.status === 'Closed-Lost' ? 'bg-red-100 text-red-800 hover:bg-red-200 border-red-200' : ''
                            }>
                              {project.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            TBD
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Calendar className="h-3 w-3" />
                              {new Date(project.createdAt).toLocaleDateString()}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <Link href={`/projects/${project.id}`}>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" data-testid={`button-open-project-${project.id}`}>
                                <ArrowUpRight className="h-4 w-4" />
                              </Button>
                            </Link>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>

            {/* Right Column: Pipeline Chart */}
            <div className="space-y-6">
              <Card className="border-border bg-slate-50 shadow-sm">
                <CardHeader>
                  <CardTitle>Pipeline Health</CardTitle>
                  <CardDescription>Distribution of projects by stage</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={pipelineData} layout="vertical" margin={{ left: 0, right: 20, top: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
                        <XAxis type="number" hide />
                        <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                        <Tooltip 
                          cursor={{ fill: 'transparent' }}
                          contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                        />
                        <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={24}>
                          {pipelineData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="mt-4 space-y-3">
                     <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Total Pipeline Value</span>
                        <span className="font-bold font-mono">$14.5M</span>
                     </div>
                     <Progress value={65} className="h-2" />
                     <p className="text-xs text-muted-foreground text-center pt-2">Target: $22M by Q4</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}