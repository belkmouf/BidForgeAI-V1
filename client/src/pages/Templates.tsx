import { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'wouter';
import { useDropzone } from 'react-dropzone';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileText, Plus, Copy, Pencil, Trash2, Loader2, Upload, X } from 'lucide-react';
import { createProject, getTemplates, createTemplate, updateTemplate, deleteTemplate, uploadTemplateFile, type Template } from '@/lib/api';
import { toast } from '@/hooks/use-toast';

const CATEGORIES = ['Commercial', 'Residential', 'Government', 'Infrastructure', 'Industrial', 'Other'];
const ACCEPTED_FILES = {
  'text/plain': ['.txt'],
  'text/csv': ['.csv'],
  'text/html': ['.html', '.htm'],
  'application/pdf': ['.pdf'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
};

export default function Templates() {
  const [, setLocation] = useLocation();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [useDialogOpen, setUseDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [projectName, setProjectName] = useState('');
  const [clientName, setClientName] = useState('');
  const [isCreatingProject, setIsCreatingProject] = useState(false);

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');
  const [templateCategory, setTemplateCategory] = useState('Commercial');
  const [templateContent, setTemplateContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const [createMode, setCreateMode] = useState<'manual' | 'upload'>('manual');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<Template | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      const data = await getTemplates();
      setTemplates(data);
    } catch (error) {
      console.error('Failed to load templates:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setUploadedFile(acceptedFiles[0]);
      if (!templateName) {
        const fileName = acceptedFiles[0].name.replace(/\.[^/.]+$/, '');
        setTemplateName(fileName);
      }
    }
  }, [templateName]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED_FILES,
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024,
  });

  const handleUseTemplate = (template: Template) => {
    setSelectedTemplate(template);
    setProjectName(`${template.name} - New Project`);
    setClientName('');
    setUseDialogOpen(true);
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

    setIsCreatingProject(true);
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
      
      setUseDialogOpen(false);
      setLocation(`/projects/${project.id}`);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create project",
        variant: "destructive",
      });
    } finally {
      setIsCreatingProject(false);
    }
  };

  const openCreateDialog = () => {
    setEditingTemplate(null);
    setTemplateName('');
    setTemplateDescription('');
    setTemplateCategory('Commercial');
    setTemplateContent('');
    setUploadedFile(null);
    setCreateMode('manual');
    setEditDialogOpen(true);
  };

  const openEditDialog = (template: Template) => {
    setEditingTemplate(template);
    setTemplateName(template.name);
    setTemplateDescription(template.description || '');
    setTemplateCategory(template.category);
    const content = template.sections?.map(s => `## ${s.title}\n${s.content}`).join('\n\n') || '';
    setTemplateContent(content);
    setUploadedFile(null);
    setCreateMode('manual');
    setEditDialogOpen(true);
  };

  const handleSaveTemplate = async () => {
    if (!templateName.trim() || !templateCategory) {
      toast({
        title: "Missing Information",
        description: "Please enter a name and select a category.",
        variant: "destructive",
      });
      return;
    }

    if (createMode === 'upload' && !uploadedFile && !editingTemplate) {
      toast({
        title: "No File Selected",
        description: "Please upload a file or switch to manual entry.",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      if (createMode === 'upload' && uploadedFile && !editingTemplate) {
        const created = await uploadTemplateFile(uploadedFile, {
          name: templateName.trim(),
          description: templateDescription.trim(),
          category: templateCategory,
        });
        setTemplates(prev => [created, ...prev]);
        toast({ title: "Template Created", description: "Your template has been imported from the file." });
      } else if (editingTemplate) {
        let sections = editingTemplate.sections || [];
        if (templateContent.trim()) {
          const parts = templateContent.split(/^## /gm).filter(Boolean);
          if (parts.length > 0 && templateContent.includes('## ')) {
            sections = parts.map(part => {
              const lines = part.split('\n');
              const title = lines[0].trim();
              const content = lines.slice(1).join('\n').trim();
              return { title, content };
            });
          } else {
            sections = [{ title: 'Content', content: templateContent.trim() }];
          }
        }
        const updated = await updateTemplate(editingTemplate.id, {
          name: templateName.trim(),
          description: templateDescription.trim(),
          category: templateCategory,
          sections,
        });
        setTemplates(prev => prev.map(t => t.id === updated.id ? updated : t));
        toast({ title: "Template Updated", description: "Your changes have been saved." });
      } else {
        let sections: { title: string; content: string }[] = [];
        if (templateContent.trim()) {
          const parts = templateContent.split(/^## /gm).filter(Boolean);
          if (parts.length > 0 && templateContent.includes('## ')) {
            sections = parts.map(part => {
              const lines = part.split('\n');
              const title = lines[0].trim();
              const content = lines.slice(1).join('\n').trim();
              return { title, content };
            });
          } else {
            sections = [{ title: 'Content', content: templateContent.trim() }];
          }
        }
        const created = await createTemplate({
          name: templateName.trim(),
          description: templateDescription.trim(),
          category: templateCategory,
          sections,
        });
        setTemplates(prev => [created, ...prev]);
        toast({ title: "Template Created", description: "Your new template is ready to use." });
      }
      setEditDialogOpen(false);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save template",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDuplicate = async (template: Template) => {
    try {
      const created = await createTemplate({
        name: `${template.name} (Copy)`,
        description: template.description || '',
        category: template.category,
        sections: template.sections || [],
      });
      setTemplates(prev => [created, ...prev]);
      toast({ title: "Template Duplicated", description: "A copy has been created." });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to duplicate template",
        variant: "destructive",
      });
    }
  };

  const handleDeleteClick = (template: Template) => {
    setTemplateToDelete(template);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!templateToDelete) return;
    setIsDeleting(true);
    try {
      await deleteTemplate(templateToDelete.id);
      setTemplates(prev => prev.filter(t => t.id !== templateToDelete.id));
      toast({ title: "Template Deleted", description: "The template has been removed." });
      setDeleteDialogOpen(false);
      setTemplateToDelete(null);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete template",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return `${Math.floor(diffDays / 30)} months ago`;
  };

  return (
    <div className="flex min-h-screen bg-gray-100">
      <AppSidebar />

      <main className="flex-1 ml-64 p-8 overflow-auto">
        <div className="max-w-7xl mx-auto space-y-8">
          <div className="flex items-center justify-between p-4 border-2 border-primary/30 rounded-xl !bg-teal-100 shadow-md">
            <div>
              <div className="flex items-center gap-2">
                <FileText className="h-6 w-6 text-primary" />
                <h1 className="text-3xl font-display font-bold">Templates</h1>
              </div>
              <p className="text-muted-foreground mt-1">
                Create and manage reusable bid templates to speed up your proposal workflow.
              </p>
            </div>
            <Button 
              className="border-2 border-primary" 
              data-testid="button-create-template"
              onClick={openCreateDialog}
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Template
            </Button>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {templates.map((template) => (
                <Card key={template.id} className="group border-2 border-primary/30 !bg-teal-100 shadow-md hover:border-primary/50 transition-colors" data-testid={`card-template-${template.id}`}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">{template.name}</CardTitle>
                        <Badge variant="secondary" className="mt-2">
                          {template.category}
                        </Badge>
                      </div>
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8" 
                          onClick={() => openEditDialog(template)}
                          data-testid={`button-edit-template-${template.id}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8" 
                          onClick={() => handleDuplicate(template)}
                          data-testid={`button-duplicate-template-${template.id}`}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-destructive" 
                          onClick={() => handleDeleteClick(template)}
                          data-testid={`button-delete-template-${template.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <CardDescription className="mt-2">
                      {template.description || 'No description'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">
                        Updated: {formatDate(template.updatedAt)}
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

              <Card 
                className="border-2 border-dashed border-primary/30 !bg-teal-100 shadow-md flex items-center justify-center min-h-[200px] hover:border-primary/50 transition-colors cursor-pointer" 
                data-testid="card-new-template"
                onClick={openCreateDialog}
              >
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
          )}
        </div>
      </main>

      <Dialog open={useDialogOpen} onOpenChange={setUseDialogOpen}>
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
            <Button variant="outline" onClick={() => setUseDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateProject} disabled={isCreatingProject} data-testid="button-create-from-template">
              {isCreatingProject ? (
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

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingTemplate ? 'Edit Template' : 'Create Template'}</DialogTitle>
            <DialogDescription>
              {editingTemplate ? 'Update your template details.' : 'Create a new bid template by entering content or uploading a file.'}
            </DialogDescription>
          </DialogHeader>
          
          {!editingTemplate && (
            <Tabs value={createMode} onValueChange={(v) => setCreateMode(v as 'manual' | 'upload')} className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="manual" data-testid="tab-manual-entry">
                  <Pencil className="h-4 w-4 mr-2" />
                  Manual Entry
                </TabsTrigger>
                <TabsTrigger value="upload" data-testid="tab-file-upload">
                  <Upload className="h-4 w-4 mr-2" />
                  Upload File
                </TabsTrigger>
              </TabsList>
            </Tabs>
          )}
          
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="template-name">Template Name</Label>
                <Input
                  id="template-name"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="e.g., Commercial Building Bid"
                  data-testid="input-template-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="template-category">Category</Label>
                <Select value={templateCategory} onValueChange={setTemplateCategory}>
                  <SelectTrigger data-testid="select-template-category">
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(cat => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="template-description">Description</Label>
              <Input
                id="template-description"
                value={templateDescription}
                onChange={(e) => setTemplateDescription(e.target.value)}
                placeholder="Describe what this template is for..."
                data-testid="input-template-description"
              />
            </div>

            {createMode === 'manual' || editingTemplate ? (
              <div className="space-y-2">
                <Label htmlFor="template-content">Template Content</Label>
                <Textarea
                  id="template-content"
                  value={templateContent}
                  onChange={(e) => setTemplateContent(e.target.value)}
                  placeholder="Enter your template content here... This will be used as the base for generating bids."
                  rows={8}
                  className="font-mono text-sm"
                  data-testid="input-template-content"
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Upload Template File</Label>
                {uploadedFile ? (
                  <div className="flex items-center justify-between p-4 border-2 border-primary/30 rounded-lg bg-primary/5">
                    <div className="flex items-center gap-3">
                      <FileText className="h-8 w-8 text-primary" />
                      <div>
                        <p className="font-medium">{uploadedFile.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {(uploadedFile.size / 1024).toFixed(1)} KB
                        </p>
                      </div>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => setUploadedFile(null)}
                      data-testid="button-remove-file"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div
                    {...getRootProps()}
                    className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                      isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/30 hover:border-primary/50'
                    }`}
                    data-testid="dropzone-template-file"
                  >
                    <input {...getInputProps()} />
                    <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                    <p className="font-medium">
                      {isDragActive ? 'Drop the file here' : 'Drag & drop a file here'}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      or click to browse
                    </p>
                    <p className="text-xs text-muted-foreground mt-3">
                      Supported: PDF, DOCX, TXT, CSV, HTML, PPTX (max 10MB)
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveTemplate} disabled={isSaving} data-testid="button-save-template">
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {createMode === 'upload' && !editingTemplate ? 'Uploading...' : 'Saving...'}
                </>
              ) : (
                editingTemplate ? 'Save Changes' : (createMode === 'upload' ? 'Upload & Create' : 'Create Template')
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Template</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{templateToDelete?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
