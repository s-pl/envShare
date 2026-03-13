import { useState } from 'react';
import { KeyRound, AlertTriangle, Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { SearchInput } from '../components/common/SearchInput';
import { EmptyState } from '../components/common/EmptyState';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { Skeleton, SkeletonRow } from '../components/common/Skeleton';
import { SecretRow } from '../components/secrets/SecretRow';
import { SecretHistory } from '../components/secrets/SecretHistory';
import { AddSecretDialog } from '../components/secrets/AddSecretDialog';
import { useSecrets, useDeleteSecret } from '../hooks/useSecrets';

interface SecretsPageProps { projectId: string; projectName: string; }

function SecretsTableSkeleton() {
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-6 px-4 py-3 border-b bg-muted/40">
        <Skeleton className="h-3 w-8" />
        <Skeleton className="h-3 w-10" />
        <Skeleton className="h-3 w-12" />
      </div>
      {[1, 2, 3, 4].map(i => <SkeletonRow key={i} />)}
    </Card>
  );
}

export function SecretsPage({ projectId, projectName }: SecretsPageProps) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'shared' | 'personal'>('all');
  const [addOpen, setAddOpen] = useState(false);
  const [historyFor, setHistoryFor] = useState<{ id: string; key: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; key: string } | null>(null);

  const { data: secrets = [], isLoading } = useSecrets(projectId);
  const deleteSecret = useDeleteSecret(projectId);

  const visible = secrets
    .filter(s => s.key.toLowerCase().includes(search.toLowerCase()))
    .filter(s => filter === 'all' || (filter === 'shared' ? s.isShared : !s.isShared));

  const pending = secrets.filter(s => !s.isShared && !s.hasPersonalValue);
  const sharedCount = secrets.filter(s => s.isShared).length;
  const personalCount = secrets.filter(s => !s.isShared).length;

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await deleteSecret.mutateAsync(deleteTarget.id);
      toast.success(`"${deleteTarget.key}" deleted`);
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? 'Failed to delete');
    } finally {
      setDeleteTarget(null);
    }
  }

  return (
    <div className="space-y-4">
      {/* Pending banner */}
      {!isLoading && pending.length > 0 && (
        <div className="rounded-xl border border-amber-200/80 bg-amber-50/80 dark:bg-amber-950/20 dark:border-amber-900/60 p-4 animate-fade-in">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/40 mt-0.5">
              <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                {pending.length} key{pending.length !== 1 ? 's' : ''} need your personal value
              </p>
              <p className="text-xs text-amber-700/70 dark:text-amber-500/70 mt-0.5 mb-2">
                Run these commands to set your personal values:
              </p>
              <div className="space-y-1">
                {pending.map(s => (
                  <code key={s.id} className="flex items-center gap-2 text-xs font-mono text-amber-800 dark:text-amber-400 bg-amber-100/70 dark:bg-amber-900/30 rounded-lg px-3 py-1.5">
                    <span className="text-amber-500/60 select-none">$</span>
                    esai set {s.key} <span className="text-amber-600/60 dark:text-amber-500/50">"your-value"</span>
                  </code>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stats chips */}
      {!isLoading && secrets.length > 0 && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1 bg-muted px-2 py-0.5 rounded-full">
            <span className="font-medium text-foreground">{secrets.length}</span> total
          </span>
          <span className="inline-flex items-center gap-1 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 px-2 py-0.5 rounded-full">
            <span className="font-medium">{sharedCount}</span> shared
          </span>
          <span className="inline-flex items-center gap-1 bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full">
            <span className="font-medium">{personalCount}</span> personal
          </span>
          {pending.length > 0 && (
            <span className="inline-flex items-center gap-1 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-full">
              <span className="font-medium">{pending.length}</span> pending
            </span>
          )}
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Filter by key name…"
          className="w-56"
        />

        <div className="flex rounded-lg border border-border overflow-hidden text-xs">
          {(['all', 'shared', 'personal'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 capitalize transition-colors ${
                filter === f
                  ? 'bg-primary text-primary-foreground font-medium'
                  : 'text-muted-foreground hover:bg-muted'
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2">
          {!isLoading && (
            <span className="text-xs text-muted-foreground">
              {visible.length}{search || filter !== 'all' ? ` of ${secrets.length}` : ''}
            </span>
          )}
          <Button size="sm" onClick={() => setAddOpen(true)} className="gap-1.5 shadow-sm shadow-primary/20">
            <Plus className="h-3.5 w-3.5" /> Add secret
          </Button>
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <SecretsTableSkeleton />
      ) : secrets.length === 0 ? (
        <EmptyState
          icon={KeyRound}
          title="No secrets yet"
          description="Push your .env file with `esai push` or add secrets manually."
          action={{ label: 'Add first secret', onClick: () => setAddOpen(true) }}
        />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={KeyRound}
          title="No matches"
          description="Try adjusting your search or filter."
        />
      ) : (
        <Card className="overflow-hidden shadow-sm">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider w-[30%]">Key</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider w-24">Type</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Value</th>
                <th className="px-4 py-3 w-10 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">v</th>
                <th className="px-4 py-3 w-36" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {visible.map(secret => (
                <SecretRow
                  key={secret.id}
                  secret={secret}
                  projectId={projectId}
                  onHistory={() => setHistoryFor({ id: secret.id, key: secret.key })}
                  onDelete={() => setDeleteTarget({ id: secret.id, key: secret.key })}
                />
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <AddSecretDialog projectId={projectId} open={addOpen} onClose={() => setAddOpen(false)} />

      {historyFor && (
        <SecretHistory
          secretId={historyFor.id}
          secretKey={historyFor.key}
          onClose={() => setHistoryFor(null)}
        />
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title={`Delete "${deleteTarget?.key}"?`}
        description="This permanently removes the secret and all version history."
        loading={deleteSecret.isPending}
      />
    </div>
  );
}
