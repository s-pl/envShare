import { cn } from '../../lib/utils';

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-md bg-muted', className)} />;
}

export function SkeletonRow() {
  return (
    <div className="flex items-center gap-4 px-4 py-3.5 border-b last:border-0">
      <Skeleton className="h-3.5 w-36" />
      <Skeleton className="h-5 w-16 rounded-full" />
      <Skeleton className="h-3.5 w-28" />
      <Skeleton className="h-3.5 w-6 ml-auto" />
      <Skeleton className="h-6 w-20 ml-4" />
    </div>
  );
}

export function SkeletonCard() {
  return (
    <div className="flex items-center gap-4 p-4 border rounded-xl">
      <Skeleton className="h-10 w-10 rounded-xl shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-3.5 w-32" />
        <Skeleton className="h-3 w-20" />
      </div>
      <Skeleton className="h-5 w-20 rounded-full" />
    </div>
  );
}
