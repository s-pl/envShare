import { cn } from '../../lib/utils';

function colorForName(_name: string) {
  return 'bg-muted text-foreground';
}

interface AvatarProps {
  name: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function Avatar({ name, size = 'md', className }: AvatarProps) {
  const initials = name
    .split(' ')
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? '')
    .join('');

  const sizeClass = { sm: 'h-7 w-7 text-xs', md: 'h-9 w-9 text-sm', lg: 'h-11 w-11 text-base' }[size];

  return (
    <div
      className={cn(
        'flex items-center justify-center rounded-full font-semibold shrink-0 select-none',
        sizeClass,
        colorForName(name),
        className,
      )}
    >
      {initials || '?'}
    </div>
  );
}
