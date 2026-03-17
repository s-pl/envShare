import { useState } from "react";
import { Plus, Folder, Trash2, Key } from "lucide-react";
import { Button } from "../ui/button";
import { ConfirmDialog } from "../common/ConfirmDialog";
import { SkeletonCard } from "../common/Skeleton";
import { EmptyState } from "../common/EmptyState";
import { CreateEnvironmentDialog } from "./CreateEnvironmentDialog";
import { useEnvironments, useDeleteEnvironment } from "../../hooks/useEnvironments";
import toast from "react-hot-toast";

interface Props {
  projectId: string;
  userRole: string;
}

export function EnvironmentList({ projectId, userRole }: Props) {
  const { data: environments = [], isLoading } = useEnvironments(projectId);
  const deleteEnv = useDeleteEnvironment(projectId);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  const canCreate = userRole === "ADMIN" || userRole === "DEVELOPER";
  const canDelete = userRole === "ADMIN";

  async function handleDelete(id: string) {
    try {
      await deleteEnv.mutateAsync(id);
      toast.success("Environment deleted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete environment");
    } finally {
      setDeleteTarget(null);
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2].map((i) => <SkeletonCard key={i} />)}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Each environment maps to a{" "}
          <code className="font-mono text-xs bg-muted px-1 rounded">.env</code>{" "}
          file on disk. The CLI writes secrets to the correct path on{" "}
          <code className="font-mono text-xs bg-muted px-1 rounded">esai pull</code>.
        </p>
        {canCreate && (
          <Button size="sm" variant="outline" className="gap-1.5 shrink-0" onClick={() => setCreateOpen(true)}>
            <Plus className="h-3.5 w-3.5" />
            New environment
          </Button>
        )}
      </div>

      {environments.length === 0 ? (
        <EmptyState
          icon={Folder}
          title="No environments"
          description="Create an environment to organise secrets by file path (e.g. .env, .env.staging)."
          action={canCreate ? { label: "Create environment", onClick: () => setCreateOpen(true) } : undefined}
        />
      ) : (
        <div className="space-y-2">
          {environments.map((env) => (
            <div
              key={env.id}
              className="flex items-center gap-3 px-4 py-3 rounded-xl border border-border bg-card"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted shrink-0">
                <Folder className="h-4 w-4 text-muted-foreground" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-sm text-foreground">{env.name}</p>
                </div>
                <p className="font-mono text-[11px] text-muted-foreground truncate">
                  {env.filePath}
                </p>
                {env.description && (
                  <p className="text-[11px] text-muted-foreground/70 truncate mt-0.5">
                    {env.description}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground shrink-0">
                <Key className="h-3 w-3" />
                <span>{env.secretCount} secret{env.secretCount !== 1 ? "s" : ""}</span>
              </div>

              {canDelete && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
                  onClick={() => setDeleteTarget({ id: env.id, name: env.name })}
                  title="Delete environment"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      <CreateEnvironmentDialog
        projectId={projectId}
        open={createOpen}
        onClose={() => setCreateOpen(false)}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete environment"
        description={
          deleteTarget
            ? `Delete "${deleteTarget.name}"? Secrets in this environment will be unlinked but not deleted.`
            : ""
        }
        confirmLabel="Delete"
        onConfirm={() => deleteTarget && handleDelete(deleteTarget.id)}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}
