import { useState, useRef, useEffect } from 'react';
import { Eye, EyeOff, Globe, User, History, Trash2, Check, X, Pencil } from 'lucide-react';
import toast from 'react-hot-toast';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { type Secret, useSetPersonalValue, useSetSharedValue } from '../../hooks/useSecrets';

interface SecretRowProps {
  secret: Secret;
  projectId: string;
  onHistory: () => void;
  onDelete: () => void;
}

export function SecretRow({ secret, projectId, onHistory, onDelete }: SecretRowProps) {
  const [revealed, setRevealed] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const setPersonal = useSetPersonalValue(projectId);
  const setShared = useSetSharedValue(projectId);

  const isPending = !secret.isShared && !secret.hasPersonalValue;

  useEffect(() => {
    if (editing) { setDraft(secret.value); inputRef.current?.focus(); }
  }, [editing]);

  async function saveEdit() {
    try {
      if (secret.isShared) {
        await setShared.mutateAsync({ secretId: secret.id, value: draft });
        toast.success('Shared value updated');
      } else {
        await setPersonal.mutateAsync({ secretId: secret.id, value: draft });
        toast.success('Personal value saved');
      }
      setEditing(false);
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? 'Failed to save');
    }
  }

  function cancelEdit() { setEditing(false); setDraft(''); }
  const isSaving = setPersonal.isPending || setShared.isPending;

  return (
    <tr className={`group transition-colors hover:bg-muted/30 ${isPending ? 'bg-amber-50/50' : ''}`}>
      {/* Key */}
      <td className="px-4 py-3 font-mono text-sm font-semibold text-foreground whitespace-nowrap">
        {secret.key}
      </td>

      {/* Type */}
      <td className="px-4 py-3">
        {secret.isShared ? (
          <Badge variant="blue" className="gap-1 text-[11px]">
            <Globe className="h-2.5 w-2.5" /> shared
          </Badge>
        ) : (
          <Badge variant="secondary" className="gap-1 text-[11px]">
            <User className="h-2.5 w-2.5" /> personal
          </Badge>
        )}
      </td>

      {/* Value */}
      <td className="px-4 py-3 font-mono text-sm text-muted-foreground max-w-xs">
        {editing ? (
          <div className="flex items-center gap-1.5">
            <input
              ref={inputRef}
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') cancelEdit(); }}
              className="h-7 w-full rounded border border-input bg-background px-2 text-xs font-mono focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
            <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0 text-emerald-600" onClick={saveEdit} disabled={isSaving}>
              <Check className="h-3 w-3" />
            </Button>
            <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0" onClick={cancelEdit}>
              <X className="h-3 w-3" />
            </Button>
          </div>
        ) : isPending ? (
          <span className="text-amber-500 text-xs italic">not set yet</span>
        ) : revealed ? (
          <span className="break-all">{secret.value || <span className="opacity-40 italic text-xs">empty</span>}</span>
        ) : (
          '••••••••••••'
        )}
      </td>

      {/* Version */}
      <td className="px-4 py-3 text-right">
        <span className="text-[11px] font-mono text-muted-foreground/50">v{secret.version}</span>
      </td>

      {/* Actions */}
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          {!isPending && !editing && (
            <Button
              size="icon" variant="ghost" className="h-7 w-7"
              onClick={() => setRevealed(r => !r)}
              title={revealed ? 'Hide' : 'Reveal'}
            >
              {revealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </Button>
          )}
          {!editing && (
            <Button
              size="icon" variant="ghost" className="h-7 w-7"
              onClick={() => setEditing(true)}
              title="Edit value"
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button
            size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground"
            onClick={onHistory}
            title="View history"
          >
            <History className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="icon" variant="ghost" className="h-7 w-7 text-destructive/50 hover:text-destructive"
            onClick={onDelete}
            title="Delete"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </td>
    </tr>
  );
}
