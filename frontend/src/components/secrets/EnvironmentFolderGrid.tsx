import { Folder, Key, AlertTriangle, ChevronRight } from "lucide-react";
import { type Environment } from "../../hooks/useEnvironments";
import { type Secret } from "../../hooks/useSecrets";

interface FolderItem {
  env: Environment;
  pendingCount: number;
}

interface Props {
  environments: Environment[];
  secrets: Secret[];
  onSelect: (env: Environment) => void;
}

export function EnvironmentFolderGrid({ environments, secrets, onSelect }: Props) {
  const folders: FolderItem[] = environments.map(env => {
    const envSecrets = secrets.filter(s => s.filePath === env.filePath);
    const pendingCount = envSecrets.filter(s => !s.isShared && !s.hasPersonalValue).length;
    return { env, pendingCount };
  });

  return (
    <div className="space-y-2">
      {folders.map(({ env, pendingCount }) => (
        <button
          key={env.id}
          onClick={() => onSelect(env)}
          className="w-full group flex items-center gap-3 px-4 py-3.5 rounded-xl border border-border bg-card hover:border-foreground/20 hover:shadow-sm transition-all duration-150 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {/* Icon */}
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted shrink-0">
            <Folder className="h-4.5 w-4.5 text-muted-foreground group-hover:text-foreground transition-colors" />
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-semibold text-sm text-foreground">{env.name}</p>
              {pendingCount > 0 && (
                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground bg-muted border border-border/60 px-1.5 py-0.5 rounded-full">
                  <AlertTriangle className="h-2.5 w-2.5" />
                  {pendingCount} pending
                </span>
              )}
            </div>
            <p className="font-mono text-[11px] text-muted-foreground truncate mt-0.5">
              {env.filePath}
            </p>
          </div>

          {/* Secret count */}
          <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
            <Key className="h-3 w-3" />
            <span>{env.secretCount}</span>
          </div>

          {/* Arrow */}
          <ChevronRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-muted-foreground group-hover:translate-x-0.5 transition-all duration-150 shrink-0" />
        </button>
      ))}
    </div>
  );
}
