import { ChevronRight, FolderOpen, Key, Users } from 'lucide-react';
import { Badge } from '../ui/badge';
import { type Project } from '../../hooks/useProjects';
import { cn } from '../../lib/utils';

type RoleBadgeVariant = 'default' | 'blue' | 'secondary';
const ROLE_BADGE: Record<string, RoleBadgeVariant> = {
  ADMIN: 'default',
  DEVELOPER: 'blue',
  VIEWER: 'secondary',
};

const ROLE_ACCENT: Record<string, string> = {
  ADMIN: 'border-l-violet-500',
  DEVELOPER: 'border-l-blue-400',
  VIEWER: 'border-l-border',
};

const PROJECT_COLORS = [
  { bg: 'bg-violet-100 dark:bg-violet-950/60', icon: 'text-violet-600 dark:text-violet-400', glow: 'group-hover:shadow-violet-500/20' },
  { bg: 'bg-blue-100 dark:bg-blue-950/60',     icon: 'text-blue-600 dark:text-blue-400',     glow: 'group-hover:shadow-blue-500/20' },
  { bg: 'bg-emerald-100 dark:bg-emerald-950/60',icon: 'text-emerald-600 dark:text-emerald-400',glow: 'group-hover:shadow-emerald-500/20' },
  { bg: 'bg-amber-100 dark:bg-amber-950/60',   icon: 'text-amber-600 dark:text-amber-400',   glow: 'group-hover:shadow-amber-500/20' },
  { bg: 'bg-rose-100 dark:bg-rose-950/60',     icon: 'text-rose-600 dark:text-rose-400',     glow: 'group-hover:shadow-rose-500/20' },
  { bg: 'bg-cyan-100 dark:bg-cyan-950/60',     icon: 'text-cyan-600 dark:text-cyan-400',     glow: 'group-hover:shadow-cyan-500/20' },
];

function projectColor(name: string) {
  let h = 0;
  for (const c of name) h = h * 31 + c.charCodeAt(0);
  return PROJECT_COLORS[Math.abs(h) % PROJECT_COLORS.length];
}

interface ProjectCardProps {
  project: Project;
  onClick: () => void;
}

export function ProjectCard({ project, onClick }: ProjectCardProps) {
  const color = projectColor(project.name);
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={e => e.key === 'Enter' && onClick()}
      className={cn(
        'group flex items-center gap-4 h-[72px] px-4 rounded-xl border border-border border-l-4 bg-card',
        'cursor-pointer select-none',
        'transition-all duration-200 ease-out',
        'hover:border-primary/25 hover:bg-accent/30 hover:-translate-y-px',
        'hover:shadow-lg',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        ROLE_ACCENT[project.role] ?? 'border-l-border',
        color.glow,
      )}
    >
      {/* Icon */}
      <div className={cn(
        'flex items-center justify-center w-10 h-10 rounded-xl shrink-0',
        'transition-transform duration-200 group-hover:scale-105',
        color.bg,
      )}>
        <FolderOpen className={cn('h-5 w-5', color.icon)} />
      </div>

      {/* Name + slug */}
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-foreground text-sm leading-tight truncate">{project.name}</p>
        <p className="text-[11px] text-muted-foreground font-mono mt-0.5 truncate">{project.slug}</p>
      </div>

      {/* Stats */}
      <div className="hidden sm:flex items-center gap-4 text-xs text-muted-foreground shrink-0">
        <span className="flex items-center gap-1.5 tabular-nums">
          <Key className="h-3 w-3" />
          <span className="font-medium text-foreground/70">{project.secretCount ?? 0}</span>
          <span className="text-muted-foreground/60">secrets</span>
        </span>
        <span className="flex items-center gap-1.5 tabular-nums">
          <Users className="h-3 w-3" />
          <span className="font-medium text-foreground/70">{project.memberCount ?? 0}</span>
          <span className="text-muted-foreground/60">members</span>
        </span>
      </div>

      <Badge variant={ROLE_BADGE[project.role] ?? 'secondary'} className="shrink-0 text-[11px]">
        {project.role.charAt(0) + project.role.slice(1).toLowerCase()}
      </Badge>

      <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground group-hover:translate-x-0.5 transition-all duration-200 shrink-0" />
    </div>
  );
}
