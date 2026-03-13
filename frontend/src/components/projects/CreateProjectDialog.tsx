import { useState } from 'react';
import { FolderPlus } from 'lucide-react';
import toast from 'react-hot-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { useCreateProject } from '../../hooks/useProjects';

interface CreateProjectDialogProps {
  open: boolean;
  onClose: () => void;
}

function toSlug(name: string) {
  return name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

export function CreateProjectDialog({ open, onClose }: CreateProjectDialogProps) {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugEdited, setSlugEdited] = useState(false);
  const createProject = useCreateProject();

  function handleNameChange(v: string) {
    setName(v);
    if (!slugEdited) setSlug(toSlug(v));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !slug.trim()) return;
    try {
      await createProject.mutateAsync({ name: name.trim(), slug: slug.trim() });
      toast.success(`Project "${name}" created`);
      setName(''); setSlug(''); setSlugEdited(false);
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? err.message ?? 'Failed to create project');
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <FolderPlus className="h-5 w-5 text-primary" />
            <DialogTitle>New project</DialogTitle>
          </div>
          <DialogDescription>
            Create a new project to manage secrets for your team.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          <div className="space-y-1.5">
            <Label htmlFor="proj-name">Name</Label>
            <Input
              id="proj-name"
              placeholder="My App"
              value={name}
              onChange={e => handleNameChange(e.target.value)}
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="proj-slug">Slug</Label>
            <Input
              id="proj-slug"
              placeholder="my-app"
              value={slug}
              onChange={e => { setSlug(e.target.value); setSlugEdited(true); }}
            />
            <p className="text-xs text-muted-foreground">Lowercase letters, numbers and hyphens only.</p>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={!name || !slug || createProject.isPending}>
              {createProject.isPending ? 'Creating…' : 'Create project'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
