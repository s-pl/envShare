import { type LucideIcon } from "lucide-react";
import { Button } from "../ui/button";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: { label: string; onClick: () => void };
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted mb-4">
        <Icon className="h-5 w-5 text-muted-foreground" />
      </div>
      <p className="font-semibold text-foreground text-sm">{title}</p>
      <p className="text-sm text-muted-foreground mt-1.5 max-w-[260px] leading-relaxed">
        {description}
      </p>
      {action && (
        <Button
          variant="outline"
          size="sm"
          className="mt-5 gap-1.5"
          onClick={action.onClick}
        >
          {action.label}
        </Button>
      )}
    </div>
  );
}
