import { useState, useMemo } from 'react';
import { KeyRound, AlertTriangle, Plus, ArrowLeft, Folder } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { SearchInput } from '../components/common/SearchInput';
import { EmptyState } from '../components/common/EmptyState';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { Skeleton, SkeletonRow, SkeletonCard } from '../components/common/Skeleton';
import { SecretRow } from '../components/secrets/SecretRow';
import { SecretHistory } from '../components/secrets/SecretHistory';
import { AddSecretDialog } from '../components/secrets/AddSecretDialog';
import { EnvironmentFolderGrid } from '../components/secrets/EnvironmentFolderGrid';
import { useSecrets, useDeleteSecret } from '../hooks/useSecrets';
import { useEnvironments, type Environment } from '../hooks/useEnvironments';

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

function FolderSkeleton() {
  return (
    <div className="space-y-2">
      {[1, 2, 3].map(i => <SkeletonCard key={i} />)}
    </div>
  );
}

// ── Secrets view for a specific environment ───────────────────────────────────

interface EnvSecretsViewProps {
  projectId: string;
  env: Environment;
  /** null when there's only one environment (no folder view to go back to) */
  onBack: (() => void) | null;
}

function EnvSecretsView({ projectId, env, onBack }: EnvSecretsViewProps) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'shared' | 'personal'>('all');
  const [addOpen, setAddOpen] = useState(false);
  const [historyFor, setHistoryFor] = useState<{ id: string; key: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; key: string } | null>(null);

  const { data: allSecrets = [], isLoading } = useSecrets(projectId);
  const deleteSecret = useDeleteSecret(projectId);

  // Filter to this environment only
  const secrets = useMemo(
    () => allSecrets.filter(s => s.filePath === env.filePath),
    [allSecrets, env.filePath],
  );

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
      {/* Breadcrumb header — only shown when there are multiple environments */}
      {onBack !== null && (
        <div className="flex items-center gap-2">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Environments
          </button>
          <span className="text-muted-foreground/40">/</span>
          <div className="flex items-center gap-1.5">
            <Folder className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-semibold text-foreground">{env.name}</span>
            <span className="font-mono text-[10px] text-muted-foreground/60">{env.filePath}</span>
          </div>
        </div>
      )}

      {/* Pending banner */}
      {!isLoading && pending.length > 0 && (
        <div className="rounded-xl border border-border/60 bg-muted/30 p-4 animate-fade-in">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted mt-0.5">
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">
                {pending.length} key{pending.length !== 1 ? 's' : ''} need your personal value
              </p>
              <p className="text-xs text-muted-foreground mt-0.5 mb-2">
                Run these commands to set your values:
              </p>
              <div className="space-y-1">
                {pending.map(s => (
                  <code key={s.id} className="flex items-center gap-2 text-xs font-mono text-foreground/70 bg-muted rounded-lg px-3 py-1.5">
                    <span className="text-muted-foreground/50 select-none">$</span>
                    esai set {s.key} <span className="text-muted-foreground/50">"your-value"</span>
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
          <span className="inline-flex items-center gap-1 bg-muted px-2 py-0.5 rounded-full">
            <span className="font-medium text-foreground">{sharedCount}</span> shared
          </span>
          <span className="inline-flex items-center gap-1 bg-muted px-2 py-0.5 rounded-full">
            <span className="font-medium text-foreground">{personalCount}</span> personal
          </span>
          {pending.length > 0 && (
            <span className="inline-flex items-center gap-1 bg-muted px-2 py-0.5 rounded-full">
              <span className="font-medium text-foreground">{pending.length}</span> pending
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
          <Button size="sm" onClick={() => setAddOpen(true)} className="gap-1.5">
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
          title="No secrets in this environment"
          description={`Push your ${env.filePath} file with \`esai push ${env.filePath}\` or add one manually.`}
          action={{ label: 'Add first secret', onClick: () => setAddOpen(true) }}
        />
      ) : visible.length === 0 ? (
        <EmptyState icon={KeyRound} title="No matches" description="Try adjusting your search or filter." />
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

      <AddSecretDialog
        projectId={projectId}
        open={addOpen}
        onClose={() => setAddOpen(false)}
        filePath={env.filePath}
      />

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

// ── Main SecretsPage ──────────────────────────────────────────────────────────

export function SecretsPage({ projectId, projectName }: SecretsPageProps) {
  const [selectedEnv, setSelectedEnv] = useState<Environment | null>(null);

  const { data: environments = [], isLoading: envsLoading } = useEnvironments(projectId);
  const { data: secrets = [], isLoading: secretsLoading } = useSecrets(projectId);

  const isLoading = envsLoading || secretsLoading;

  // If only one environment, skip the folder view and go straight in
  const singleEnv = !isLoading && environments.length === 1 ? environments[0] : null;
  const activeEnv = selectedEnv ?? singleEnv;

  if (activeEnv) {
    return (
      <EnvSecretsView
        projectId={projectId}
        env={activeEnv}
        onBack={singleEnv ? null : () => setSelectedEnv(null)}
      />
    );
  }

  // ── Folder view ─────────────────────────────────────────────────────────────
  if (isLoading) return <FolderSkeleton />;

  if (environments.length === 0) {
    return (
      <EmptyState
        icon={Folder}
        title="No environments yet"
        description="Create an environment first, then push your .env files."
      />
    );
  }

  return (
    <EnvironmentFolderGrid
      environments={environments}
      secrets={secrets}
      onSelect={setSelectedEnv}
    />
  );
}
