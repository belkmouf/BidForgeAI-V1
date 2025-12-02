import { AppSidebar } from '@/components/layout/AppSidebar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Plus, 
  ArrowUpRight, 
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
import { mockProjects } from '@/lib/mockData';
import { Link } from 'wouter';

export default function ProjectsList() {
  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar />
      
      <main className="flex-1 ml-64 p-8 overflow-auto">
        <div className="max-w-6xl mx-auto space-y-8">
          
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-display font-bold tracking-tight text-foreground">Projects</h1>
              <p className="text-muted-foreground mt-1">Manage all your construction bids and proposals.</p>
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

          <Card className="border-border/60">
            <CardHeader className="flex flex-row items-center justify-between">
              <div className="relative w-72">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search projects..." className="pl-9 bg-muted/50 border-0" />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Project Name</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Value</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mockProjects.map((project) => (
                    <TableRow key={project.id} className="group cursor-pointer hover:bg-muted/40">
                      <TableCell className="font-medium">
                        <span className="font-semibold text-foreground group-hover:text-primary transition-colors">{project.name}</span>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {project.client}
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
                        ${(project.value / 1000000).toFixed(2)}M
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          {new Date(project.dueDate).toLocaleDateString()}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Link href={`/projects/${project.id}`}>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
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
      </main>
    </div>
  );
}