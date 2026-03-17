import { ChevronRight, Key, Users, Shield } from "lucide-react";
import { Badge } from "../ui/badge";
import { type Project } from "../../hooks/useProjects";
import { cn } from "../../lib/utils";

type RoleBadgeVariant = "default" | "blue" | "secondary";
const ROLE_BADGE: Record<string, RoleBadgeVariant> = {
  ADMIN: "default",
  DEVELOPER: "blue",
  VIEWER: "secondary",
};

function initials(name: string) {
  const words = name.trim().split(/\s+/);
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

interface ProjectCardProps {
  project: Project;
  onClick: () => void;
}

export function ProjectCard({ project, onClick }: ProjectCardProps) {
  const secretCount = project.secretCount ?? 0;
  const memberCount = project.memberCount ?? 0;
  const barWidth = Math.min((secretCount / 20) * 100, 100);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => e.key === "Enter" && onClick()}
      className={cn(
        "group relative flex items-stretch rounded-xl border border-border bg-card overflow-hidden",
        "cursor-pointer select-none outline-none",
        "transition-all duration-200 ease-out",
        "hover:-translate-y-0.5 hover:shadow-lg hover:border-foreground/20",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      )}
    >
      {/* Initials column */}
      <div className="flex items-center justify-center w-14 shrink-0 bg-foreground/5 dark:bg-foreground/8">
        <span className="font-bold text-sm text-foreground/60 select-none">
          {initials(project.name)}
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col justify-center min-w-0 px-4 py-3.5 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <p className="font-semibold text-foreground text-sm leading-tight truncate flex-1">
            {project.name}
          </p>
          <Badge
            variant={ROLE_BADGE[project.role] ?? "secondary"}
            className="shrink-0 text-[10px] px-1.5 py-0 h-4.5"
          >
            {project.role.charAt(0) + project.role.slice(1).toLowerCase()}
          </Badge>
        </div>

        <p className="text-[11px] text-muted-foreground font-mono leading-none truncate">
          {project.slug}
        </p>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Key className="h-3 w-3 shrink-0" />
            <span className="tabular-nums font-semibold text-foreground/80">{secretCount}</span>
            <span>secret{secretCount !== 1 ? "s" : ""}</span>
          </div>

          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Users className="h-3 w-3 shrink-0" />
            <span className="tabular-nums font-semibold text-foreground/80">{memberCount}</span>
            <span>member{memberCount !== 1 ? "s" : ""}</span>
          </div>

          <div className="hidden sm:flex items-center gap-1 text-[10px] text-muted-foreground/50 ml-auto">
            <Shield className="h-2.5 w-2.5" />
            <span>AES-256</span>
          </div>
        </div>

        {secretCount > 0 && (
          <div className="h-0.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-foreground/20 transition-all duration-700"
              style={{ width: `${barWidth}%` }}
            />
          </div>
        )}
      </div>

      {/* Arrow */}
      <div className="flex items-center pr-4 pl-1 shrink-0">
        <ChevronRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-muted-foreground group-hover:translate-x-0.5 transition-all duration-200" />
      </div>
    </div>
  );
}
