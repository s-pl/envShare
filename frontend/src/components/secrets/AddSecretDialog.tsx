import { useState } from 'react';
import { KeyRound, Globe, User } from 'lucide-react';
import toast from 'react-hot-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { usePushSecrets } from '../../hooks/useSecrets';

interface AddSecretDialogProps {
  projectId: string;
  open: boolean;
  onClose: () => void;
  filePath?: string;
}

export function AddSecretDialog({ projectId, open, onClose, filePath }: AddSecretDialogProps) {
  const [key, setKey] = useState('');
  const [value, setValue] = useState('');
  const [isShared, setIsShared] = useState(false);
  const push = usePushSecrets(projectId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!key.trim()) return;
    try {
      await push.mutateAsync({ secrets: [{ key: key.trim().toUpperCase(), value, isShared }], filePath });
      toast.success(`Secret "${key.trim().toUpperCase()}" added`);
      setKey(''); setValue(''); setIsShared(false);
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? err.message ?? 'Failed to add secret');
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <KeyRound className="h-5 w-5 text-primary" />
            <DialogTitle>Add secret</DialogTitle>
          </div>
          <DialogDescription>
            Add a new environment variable to this project.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          <div className="space-y-1.5">
            <Label htmlFor="s-key">Key</Label>
            <Input
              id="s-key"
              placeholder="DATABASE_URL"
              value={key}
              onChange={e => setKey(e.target.value)}
              className="font-mono"
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="s-value">Value</Label>
            <Input
              id="s-value"
              type="password"
              placeholder="your-secret-value"
              value={value}
              onChange={e => setValue(e.target.value)}
              className="font-mono"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Visibility</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setIsShared(false)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors ${!isShared ? 'border-primary bg-primary/5 text-primary' : 'border-border text-muted-foreground hover:border-border/80'}`}
              >
                <User className="h-4 w-4" />
                Personal
              </button>
              <button
                type="button"
                onClick={() => setIsShared(true)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors ${isShared ? 'border-primary bg-primary/5 text-primary' : 'border-border text-muted-foreground hover:border-border/80'}`}
              >
                <Globe className="h-4 w-4" />
                Shared
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              {isShared ? 'Same value for everyone on the team.' : 'Each team member sets their own value.'}
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={!key || push.isPending}>
              {push.isPending ? 'Adding…' : 'Add secret'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
