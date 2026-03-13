import { LogOut, KeyRound, ChevronRight } from 'lucide-react';
import { Button } from '../ui/button';
import { Separator } from '../ui/separator';
import { Avatar } from '../common/Avatar';
import { ThemeToggle } from '../common/ThemeToggle';

interface NavbarProps {
  user: { name: string; email: string } | null;
  onLogout: () => void;
  crumbs?: { label: string; onClick?: () => void }[];
}

export function Navbar({ user, onLogout, crumbs = [] }: NavbarProps) {
  return (
    <header className="sticky top-0 z-20 border-b border-border/60 bg-card/80 backdrop-blur-md">
      {/* Subtle primary glow line at bottom */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/25 to-transparent" />

      <div className="max-w-5xl mx-auto px-6 h-14 flex items-center gap-2 min-w-0">
        {/* Logo */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm shadow-primary/30">
            <KeyRound className="h-3.5 w-3.5" />
          </div>
          <span className="font-bold text-sm tracking-tight text-foreground">envShare</span>
        </div>

        {/* Breadcrumbs */}
        {crumbs.map((crumb, i) => (
          <span key={i} className="flex items-center gap-1 min-w-0">
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
            {crumb.onClick ? (
              <button
                onClick={crumb.onClick}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors truncate hover:underline underline-offset-2"
              >
                {crumb.label}
              </button>
            ) : (
              <span className="text-xs font-semibold text-foreground truncate">{crumb.label}</span>
            )}
          </span>
        ))}

        {/* Right side */}
        <div className="ml-auto flex items-center gap-1 shrink-0">
          <ThemeToggle />

          {user && (
            <>
              <Separator orientation="vertical" className="h-5 mx-2 opacity-60" />
              <div className="flex items-center gap-2.5">
                <Avatar name={user.name} size="sm" />
                <div className="hidden md:block">
                  <p className="text-xs font-semibold text-foreground leading-tight">{user.name}</p>
                  <p className="text-[10px] text-muted-foreground leading-tight">{user.email}</p>
                </div>
              </div>
            </>
          )}

          <Separator orientation="vertical" className="h-5 mx-2 opacity-60" />
          <Button
            variant="ghost"
            size="sm"
            onClick={onLogout}
            className="h-8 gap-1.5 text-muted-foreground hover:text-foreground"
            title="Sign out"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span className="hidden sm:inline text-xs">Sign out</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
