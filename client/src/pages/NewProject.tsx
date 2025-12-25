import { useState } from 'react';
import { useLocation } from 'wouter';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChevronLeft } from 'lucide-react';
import { Link } from 'wouter';
import { createProject } from '@/lib/api';
import { toast } from '@/hooks/use-toast';

export default function NewProject() {
  const [, setLocation] = useLocation();
  const [name, setName] = useState('');
  const [clientName, setClientName] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !clientName || !description) return;

    setIsSubmitting(true);
    try {
      const project = await createProject({
        name,
        clientName,
        description,
        status: 'Active'
      });
      
      toast({
        title: "Project Created",
        description: `${project.name} has been created successfully.`,
      });
      
      setLocation(`/projects/${project.id}/documents`);
    } catch (error: any) {
      toast({
        title: "Creation Failed",
        description: error.message || "Failed to create project",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar />
      
      <main className="flex-1 ml-64 p-8">
        <div className="max-w-2xl mx-auto">
          <Link href="/">
            <Button variant="ghost" className="mb-6 -ml-3 gap-2">
              <ChevronLeft className="h-4 w-4" />
              Back to Dashboard
            </Button>
          </Link>

          <Card>
            <CardHeader>
              <CardTitle className="text-2xl font-display">Create New Project</CardTitle>
              <CardDescription>
                Set up a new construction bid project
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="project-name">Project Name</Label>
                  <Input
                    id="project-name"
                    data-testid="input-project-name"
                    placeholder="e.g., Downtown Office Complex Renovation"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="client-name">Client Name</Label>
                  <Input
                    id="client-name"
                    data-testid="input-client-name"
                    placeholder="e.g., Acme Construction Corp"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Project Description</Label>
                  <Textarea
                    id="description"
                    data-testid="input-project-description"
                    placeholder='e.g., We are asked to bid on the "Green Oasis" Phase II in Dubai, a mixed-use complex comprising three mid-rise commercial buildings, a central plaza, and underground parking, designed to meet LEED Gold sustainability standards.'
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    maxLength={5000}
                    rows={4}
                    className="resize-none"
                    required
                  />
                  <p className="text-xs text-muted-foreground text-right">
                    {description.length}/5000 characters
                  </p>
                </div>

                <div className="flex gap-3">
                  <Link href="/">
                    <Button type="button" variant="outline">
                      Cancel
                    </Button>
                  </Link>
                  <Button 
                    type="submit" 
                    data-testid="button-create-project"
                    disabled={isSubmitting || !name || !clientName || !description}
                    className="flex-1"
                  >
                    {isSubmitting ? 'Creating...' : 'Create Project'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
