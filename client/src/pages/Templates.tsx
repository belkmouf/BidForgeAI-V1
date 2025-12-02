import { AppSidebar } from '@/components/layout/AppSidebar';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { FileText, Plus, Copy, Pencil, Trash2 } from 'lucide-react';

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
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center justify-between gap-2 border-b border-border px-4">
          <div className="flex items-center gap-2">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <FileText className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-display font-semibold">Templates</h1>
          </div>
          <Button data-testid="button-create-template">
            <Plus className="h-4 w-4 mr-2" />
            Create Template
          </Button>
        </header>

        <main className="flex-1 p-6">
          <div className="max-w-6xl mx-auto">
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
                      <Button variant="outline" size="sm" data-testid={`button-use-template-${template.id}`}>
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
      </SidebarInset>
    </SidebarProvider>
  );
}
