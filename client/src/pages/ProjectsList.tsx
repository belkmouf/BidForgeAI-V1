import { useState, useEffect } from 'react';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Plus, 
  ArrowUpRight, 
  Calendar,
  Search,
  Filter,
  Loader2
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
import { listProjects } from '@/lib/api';
import { Link } from 'wouter';
import type { Project } from '@shared/schema';

export default function ProjectsList() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const data = await listProjects();
        setProjects(data);
      } catch (error) {
        console.error('Failed to load projects:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProjects();
  }, []);

  const filteredProjects = projects.filter(project => 
    project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    project.clientName.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
                <Input 
                  placeholder="Search projects..." 
                  className="pl-9 bg-muted/50 border-0"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  data-testid="input-search-projects"
                />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : filteredProjects.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  {searchQuery ? 'No projects match your search.' : 'No projects yet. Create your first project!'}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Project Name</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProjects.map((project) => (
                      <TableRow key={project.id} className="group cursor-pointer hover:bg-muted/40" data-testid={`row-project-${project.id}`}>
                        <TableCell className="font-medium">
                          <span className="font-semibold text-foreground group-hover:text-primary transition-colors">{project.name}</span>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {project.clientName}
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
                        <TableCell>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            {new Date(project.createdAt).toLocaleDateString()}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Link href={`/projects/${project.id}`}>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" data-testid={`button-view-project-${project.id}`}>
                              <ArrowUpRight className="h-4 w-4" />
                            </Button>
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}