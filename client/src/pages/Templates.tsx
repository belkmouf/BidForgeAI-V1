import { useState } from 'react';
import { useLocation } from 'wouter';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FileText, Plus, Copy, Pencil, Trash2, Loader2 } from 'lucide-react';
import { createProject } from '@/lib/api';
import { toast } from '@/hooks/use-toast';

const templates = [
  {
    id: 1,
    name: 'Commercial Building Bid',
    description: 'Standard template for commercial construction projects',
    category: 'Commercial',
    lastUsed: '2 days ago',
  },
  {
    id: 2,
    name: 'Residential Renovation',
    description: 'Template optimized for home renovation and remodeling',
    category: 'Residential',
    lastUsed: '1 week ago',
  },
  {
    id: 3,
    name: 'Government RFP Response',
    description: 'Formal template for government contract bids',
    category: 'Government',
    lastUsed: '3 weeks ago',
  },
  {
    id: 4,
    name: 'Infrastructure Project',
    description: 'Template for roads, bridges, and public works',
    category: 'Infrastructure',
    lastUsed: '1 month ago',
  },
];

export default function Templates() {
  const [, setLocation] = useLocation();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<typeof templates[0] | null>(null);
  const [projectName, setProjectName] = useState('');
  const [clientName, setClientName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const handleUseTemplate = (template: typeof templates[0]) => {
    setSelectedTemplate(template);
    setProjectName(`${template.name} - New Project`);
    setClientName('');
    setDialogOpen(true);
  };

  const handleCreateProject = async () => {
    if (!projectName.trim() || !clientName.trim()) {
      toast({
        title: "Missing Information",
        description: "Please enter both project name and client name.",
        variant: "destructive",
      });
      return;
    }

    setIsCreating(true);
    try {
      const project = await createProject({
        name: projectName.trim(),
        clientName: clientName.trim(),
        status: 'Active',
        metadata: {
          templateId: selectedTemplate?.id,
          templateName: selectedTemplate?.name,
          category: selectedTemplate?.category
        }
      });
      
      toast({
        title: "Project Created",
        description: "You can now upload your RFQ documents.",
      });
      
      setDialogOpen(false);
      setLocation(`/projects/${project.id}`);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create project",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar />

      <main className="flex-1 ml-64 p-8 overflow-auto">
        <div className="max-w-7xl mx-auto space-y-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="h-6 w-6 text-primary" />
              <h1 className="text-3xl font-display font-bold">Templates</h1>
            </div>
            <Button data-testid="button-create-template">
              <Plus className="h-4 w-4 mr-2" />
              Create Template
            </Button>
          </div>

          <div className="mb-6">
            <p className="text-muted-foreground">
              Create and manage reusable bid templates to speed up your proposal workflow.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {templates.map((template) => (
              <Card key={template.id} className="group hover:border-primary/50 transition-colors" data-testid={`card-template-${template.id}`}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{template.name}</CardTitle>
                      <Badge variant="secondary" className="mt-2">
                        {template.category}
                      </Badge>
                    </div>
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" data-testid={`button-edit-template-${template.id}`}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" data-testid={`button-duplicate-template-${template.id}`}>
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" data-testid={`button-delete-template-${template.id}`}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <CardDescription className="mt-2">
                    {template.description}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      Last used: {template.lastUsed}
                    </span>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => handleUseTemplate(template)}
                      data-testid={`button-use-template-${template.id}`}
                    >
                      Use Template
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}

            <Card className="border-dashed flex items-center justify-center min-h-[200px] hover:border-primary/50 transition-colors cursor-pointer" data-testid="card-new-template">
              <div className="text-center">
                <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                  <Plus className="h-6 w-6 text-primary" />
                </div>
                <p className="font-medium">Create New Template</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Start from scratch
                </p>
              </div>
            </Card>
          </div>
        </div>
      </main>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Project from Template</DialogTitle>
            <DialogDescription>
              {selectedTemplate && (
                <>Using template: <span className="font-medium text-foreground">{selectedTemplate.name}</span></>
              )}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="project-name">Project Name</Label>
              <Input
                id="project-name"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="Enter project name"
                data-testid="input-project-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="client-name">Client Name</Label>
              <Input
                id="client-name"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Enter client name"
                data-testid="input-client-name"
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateProject} disabled={isCreating} data-testid="button-create-from-template">
              {isCreating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create & Upload Documents'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
