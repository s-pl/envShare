import { cn } from '../../lib/utils';

const COLORS = [
  'bg-blue-100 text-blue-700',
  'bg-violet-100 text-violet-700',
  'bg-emerald-100 text-emerald-700',
  'bg-amber-100 text-amber-700',
  'bg-rose-100 text-rose-700',
  'bg-cyan-100 text-cyan-700',
];

function colorForName(name: string) {
  let hash = 0;
  for (const ch of name) hash = hash * 31 + ch.charCodeAt(0);
  return COLORS[Math.abs(hash) % COLORS.length];
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
