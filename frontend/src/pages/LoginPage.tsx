import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { KeyRound, Mail, Lock, User, ArrowRight, Shield, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { api } from '../api';
import { useAuthStore } from '../store/authStore';

const TERMINAL_LINES = [
  { prefix: '$', text: ' esai pull --project my-app', color: 'text-background/90' },
  { prefix: '↓', text: ' Pulling 8 secrets…', color: 'text-emerald-400/70' },
  { prefix: ' ', text: '  DATABASE_URL    ████████████  shared', color: 'text-background/40', accent: 'shared' },
  { prefix: ' ', text: '  API_SECRET      ████████████  shared', color: 'text-background/40', accent: 'shared' },
  { prefix: ' ', text: '  JWT_PRIVATE_KEY ████████████  personal', color: 'text-background/40', accent: 'personal' },
  { prefix: ' ', text: '  STRIPE_KEY      ████████████  personal', color: 'text-background/40', accent: 'personal' },
  { prefix: '✓', text: ' Written to .env  (142ms)', color: 'text-emerald-400/80' },
];

function TerminalMockup() {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm overflow-hidden">
      {/* Title bar */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/10 bg-white/[0.03]">
        <div className="flex gap-1.5">
          <div className="h-2.5 w-2.5 rounded-full bg-red-400/50" />
          <div className="h-2.5 w-2.5 rounded-full bg-yellow-400/50" />
          <div className="h-2.5 w-2.5 rounded-full bg-green-400/50" />
        </div>
        <span className="ml-2 text-[11px] text-background/30 font-mono">esai — zsh</span>
      </div>
      {/* Terminal body */}
      <div className="p-4 space-y-1 font-mono text-[12px] leading-relaxed">
        {TERMINAL_LINES.map((line, i) => (
          <p key={i} className={`${line.color} flex gap-1`}>
            <span className={
              line.prefix === '$' ? 'text-primary/70' :
              line.prefix === '✓' ? 'text-emerald-400/80' :
              line.prefix === '↓' ? 'text-blue-400/70' : 'opacity-0'
            }>{line.prefix}</span>
            <span className="whitespace-pre">
              {line.text.replace('  shared', '').replace('  personal', '')}
              {line.accent === 'shared' && (
                <span className="text-emerald-400/60">  shared</span>
              )}
              {line.accent === 'personal' && (
                <span className="text-blue-400/60">  personal</span>
              )}
            </span>
          </p>
        ))}
        <p className="text-background/50 flex items-center gap-1">
          <span className="text-primary/70">$</span>
          <span className="animate-cursor-blink inline-block w-2 h-3.5 bg-background/50 ml-0.5" />
        </p>
      </div>
    </div>
  );
}

const FEATURES = [
  { icon: Shield, text: 'AES-256-GCM encryption at rest' },
  { icon: KeyRound, text: 'Per-user personal values' },
  { icon: User, text: 'Team roles & access control' },
];

export function LoginPage() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const navigate = useNavigate();
  const login = useAuthStore(s => s.login);

  function set(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const endpoint = mode === 'login' ? '/auth/login' : '/auth/register';
      const payload = mode === 'login'
        ? { email: form.email, password: form.password }
        : { name: form.name, email: form.email, password: form.password };

      const res = await api.post<{ accessToken: string; user: any }>(endpoint, payload);
      login(res.accessToken, res.user);
      navigate('/', { replace: true });
    } catch (err: any) {
      toast.error(err.message ?? 'Authentication failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* ── Left panel — brand ─────────────────────────────────────────── */}
      <div className="hidden lg:flex flex-col bg-foreground text-background p-12 relative overflow-hidden">
        {/* Dot-grid pattern */}
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.18) 1px, transparent 1px)',
            backgroundSize: '28px 28px',
          }}
        />
        {/* Radial glow */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full bg-primary/15 blur-[100px] -translate-y-1/4 translate-x-1/4 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-72 h-72 rounded-full bg-primary/10 blur-[80px] translate-y-1/4 -translate-x-1/4 pointer-events-none" />

        {/* Logo */}
        <div className="relative flex items-center gap-3 mb-auto animate-fade-in">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/20 border border-primary/30 shadow-lg shadow-primary/20">
            <KeyRound className="h-5 w-5 text-primary" />
          </div>
          <div>
            <span className="font-bold text-lg tracking-tight text-background">envShare</span>
            <p className="text-[11px] text-background/40 leading-none mt-0.5">secrets management</p>
          </div>
        </div>

        {/* Main copy */}
        <div className="relative space-y-8 mt-auto animate-fade-in stagger-1">
          <div>
            <h1 className="text-4xl font-bold leading-[1.15] tracking-tight">
              Secrets management<br />
              <span className="text-background/40">for your whole team.</span>
            </h1>
            <p className="text-background/55 mt-4 text-sm leading-relaxed max-w-xs">
              Share environment variables securely. Personal values stay private,
              shared values sync instantly across your team.
            </p>
          </div>

          {/* Terminal mockup */}
          <div className="animate-fade-in stagger-2">
            <TerminalMockup />
          </div>

          {/* Feature chips */}
          <div className="flex flex-wrap gap-2 animate-fade-in stagger-3">
            {FEATURES.map(({ icon: Icon, text }) => (
              <div
                key={text}
                className="flex items-center gap-1.5 text-xs text-background/60 bg-white/5 border border-white/10 rounded-full px-3 py-1.5"
              >
                <CheckCircle2 className="h-3 w-3 text-emerald-400/70 shrink-0" />
                {text}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right panel — form ─────────────────────────────────────────── */}
      <div className="flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-sm space-y-7">
          {/* Mobile logo */}
          <div className="flex items-center gap-2.5 lg:hidden mb-6 animate-fade-in">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md shadow-primary/30">
              <KeyRound className="h-4.5 w-4.5" />
            </div>
            <span className="font-bold text-base">envShare</span>
          </div>

          {/* Heading */}
          <div className="animate-fade-in stagger-1">
            <h2 className="text-2xl font-bold tracking-tight text-foreground">
              {mode === 'login' ? 'Welcome back' : 'Create account'}
            </h2>
            <p className="text-sm text-muted-foreground mt-1.5">
              {mode === 'login'
                ? 'Sign in to access your secrets.'
                : 'Get started with envShare.'}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4 animate-fade-in stagger-2">
            {mode === 'register' && (
              <div className="space-y-1.5">
                <Label htmlFor="name" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Full name
                </Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
                  <Input
                    id="name"
                    placeholder="Samuel Ponce"
                    value={form.name}
                    onChange={e => set('name', e.target.value)}
                    className="pl-9 h-10 focus-visible:ring-primary/40"
                    required
                  />
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Email
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
                <Input
                  id="email"
                  type="email"
                  placeholder="you@company.com"
                  value={form.email}
                  onChange={e => set('email', e.target.value)}
                  className="pl-9 h-10 focus-visible:ring-primary/40"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Password
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={form.password}
                  onChange={e => set('password', e.target.value)}
                  className="pl-9 h-10 focus-visible:ring-primary/40"
                  required
                />
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-10 gap-2 font-semibold shadow-md shadow-primary/20 hover:shadow-primary/30 transition-shadow"
              disabled={loading}
            >
              {loading
                ? <span className="flex items-center gap-2"><span className="h-3.5 w-3.5 rounded-full border-2 border-primary-foreground/40 border-t-primary-foreground animate-spin" />Please wait…</span>
                : <>{mode === 'login' ? 'Sign in' : 'Create account'}<ArrowRight className="h-4 w-4" /></>
              }
            </Button>
          </form>

          {/* Divider */}
          <div className="relative animate-fade-in stagger-3">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-background px-3 text-muted-foreground">
                {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}
              </span>
            </div>
          </div>

          <Button
            variant="outline"
            className="w-full h-10 animate-fade-in stagger-4"
            onClick={() => setMode(m => m === 'login' ? 'register' : 'login')}
          >
            {mode === 'login' ? 'Create account' : 'Sign in instead'}
          </Button>
        </div>
      </div>
    </div>
  );
}
