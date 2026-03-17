import { Eye, EyeOff, CheckCircle, RefreshCw, History } from 'lucide-react';
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Badge } from '../ui/badge';
import { useSecretHistory } from '../../hooks/useSecrets';

const ACTION_META: Record<string, { label: string; icon: React.ReactNode; classes: string }> = {
  created: {
    label: 'Created',
    icon: <CheckCircle className="h-3 w-3" />,
    classes: 'text-foreground bg-muted border-border',
  },
  updated: {
    label: 'Updated',
    icon: <RefreshCw className="h-3 w-3" />,
    classes: 'text-muted-foreground bg-muted border-border',
  },
};

interface SecretHistoryProps {
  secretId: string;
  secretKey: string;
  onClose: () => void;
}

export function SecretHistory({ secretId, secretKey, onClose }: SecretHistoryProps) {
  const [revealed, setRevealed] = useState<Set<number>>(new Set());
  const { data = [], isLoading } = useSecretHistory(secretId);

  const toggle = (v: number) =>
    setRevealed(prev => { const n = new Set(prev); n.has(v) ? n.delete(v) : n.add(v); return n; });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-mono text-sm">
            <History className="h-4 w-4 text-muted-foreground" />
            {secretKey}
            <span className="font-sans font-normal text-muted-foreground text-xs">history</span>
          </DialogTitle>
        </DialogHeader>

        {isLoading && (
          <p className="text-sm text-muted-foreground py-8 text-center">Loading…</p>
        )}

        {!isLoading && data.length === 0 && (
          <div className="py-10 text-center text-muted-foreground text-sm">
            <History className="h-8 w-8 mx-auto mb-2 opacity-25" />
            <p>No history recorded yet.</p>
            <p className="text-xs mt-1">History tracks shared value changes.</p>
          </div>
        )}

        {data.length > 0 && (
          <ol className="relative border-l border-border ml-3 space-y-0 max-h-96 overflow-y-auto pr-1">
            {data.map((v, i) => {
              const meta = ACTION_META[v.action] ?? ACTION_META.updated;
              const isFirst = i === 0;
              const isRev = revealed.has(v.version);
              return (
                <li key={v.version} className="mb-5 ml-5">
                  <span className={`absolute -left-[9px] flex h-4 w-4 items-center justify-center rounded-full border bg-background ${isFirst ? 'border-primary' : 'border-border'}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${isFirst ? 'bg-primary' : 'bg-muted-foreground'}`} />
                  </span>

                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium border ${meta.classes}`}>
                        {meta.icon} {meta.label}
                      </span>
                      <Badge variant="secondary" className="text-[10px] h-4 px-1.5">v{v.version}</Badge>
                      {isFirst && <Badge variant="default" className="text-[10px] h-4 px-1.5">current</Badge>}
                    </div>

                    <p className="text-xs text-muted-foreground">
                      {v.actor ? (
                        <><span className="font-medium text-foreground">{v.actor.name}</span> · {v.actor.email} · </>
                      ) : (
                        <span className="italic">System · </span>
                      )}
                      {new Date(v.createdAt).toLocaleString()}
                    </p>

                    {v.isShared && v.value !== null && (
                      <div className="flex items-center gap-2">
                        <code className="text-xs bg-muted px-2 py-0.5 rounded font-mono">
                          {isRev ? (v.value || <span className="opacity-40 italic">empty</span>) : '••••••••••'}
                        </code>
                        <button onClick={() => toggle(v.version)} className="text-muted-foreground hover:text-foreground transition-colors">
                          {isRev ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                        </button>
                      </div>
                    )}

                    {!v.isShared && (
                      <p className="text-xs text-muted-foreground/60 italic">Personal — not stored in history</p>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </DialogContent>
    </Dialog>
  );
}
