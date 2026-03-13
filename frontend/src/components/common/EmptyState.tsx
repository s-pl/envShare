import { type LucideIcon } from 'lucide-react';
import { Button } from '../ui/button';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: { label: string; onClick: () => void };
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center animate-fade-in">
      <div className="relative mb-5">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/10">
          <Icon className="h-7 w-7 text-primary/60" />
        </div>
        <div className="absolute inset-0 rounded-2xl bg-primary/5 blur-xl" />
      </div>
      <p className="font-semibold text-foreground text-base">{title}</p>
      <p className="text-sm text-muted-foreground mt-1.5 max-w-[260px] leading-relaxed">{description}</p>
      {action && (
        <Button variant="outline" size="sm" className="mt-5 gap-1.5 shadow-sm" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
}
