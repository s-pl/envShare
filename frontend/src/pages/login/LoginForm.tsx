import { useState } from "react";
import { ArrowRight, Eye, EyeOff, ExternalLink, Mail, Lock, User, CheckCircle2 } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Logo } from "../../components/brand/Logo";
import { api } from "../../api";
import { useAuthStore } from "../../store/authStore";
import { useNavigate } from "react-router-dom";

type Mode = "login" | "register";

function passwordStrength(p: string): { label: string; width: string; color: string } | null {
  if (!p) return null;
  let score = 0;
  if (p.length >= 12) score++;
  if (p.length >= 16) score++;
  if (/[A-Z]/.test(p)) score++;
  if (/[0-9]/.test(p)) score++;
  if (/[^A-Za-z0-9]/.test(p)) score++;
  if (score <= 2) return { label: "Weak",   width: "33%",  color: "bg-foreground/30" };
  if (score <= 3) return { label: "Fair",   width: "66%",  color: "bg-foreground/60" };
  return            { label: "Strong", width: "100%", color: "bg-foreground" };
}

export function LoginForm() {
  const navigate  = useNavigate();
  const loginStore = useAuthStore((s) => s.login);

  const [mode,     setMode]     = useState<Mode>("login");
  const [loading,  setLoading]  = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "", consent: false });

  const strength = mode === "register" ? passwordStrength(form.password) : null;

  function field(key: keyof typeof form, value: string | boolean) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function switchMode(next: Mode) {
    setMode(next);
    setForm({ name: "", email: "", password: "", consent: false });
    setShowPass(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (mode === "register" && !form.consent) return;
    setLoading(true);
    try {
      const endpoint = mode === "login" ? "/auth/login" : "/auth/register";
      const payload  = mode === "login"
        ? { email: form.email, password: form.password }
        : { name: form.name, email: form.email, password: form.password, consent: true };

      const res = await api.post<{ accessToken: string; user: unknown }>(endpoint, payload);
      loginStore((res as any).accessToken, (res as any).user);
      navigate("/", { replace: true });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background px-8 py-16">
      <div className="w-full max-w-[360px] space-y-8">

        {/* Mobile logo */}
        <div className="flex lg:hidden justify-center mb-2">
          <Logo size="md" />
        </div>

        {/* Mode switcher */}
        <div className="flex gap-1 p-1 rounded-xl bg-muted">
          {(["login", "register"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => switchMode(m)}
              className={`
                flex-1 py-2 rounded-lg text-sm font-semibold transition-all duration-150
                ${mode === m
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
                }
              `}
            >
              {m === "login" ? "Sign in" : "Create account"}
            </button>
          ))}
        </div>

        {/* Heading */}
        <div className="space-y-1">
          <h2 className="text-xl font-bold text-foreground">
            {mode === "login" ? "Welcome back" : "Get started"}
          </h2>
          <p className="text-sm text-muted-foreground">
            {mode === "login"
              ? "Sign in to access your team's secrets."
              : "Create your account in under a minute."}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">

          {/* Full name — register only */}
          {mode === "register" && (
            <div className="space-y-1.5">
              <Label htmlFor="name" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Full name
              </Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
                <Input
                  id="name"
                  autoFocus
                  placeholder="Samuel Ponce"
                  value={form.name}
                  onChange={(e) => field("name", e.target.value)}
                  className="pl-9 h-11"
                  required
                  autoComplete="name"
                />
              </div>
            </div>
          )}

          {/* Email */}
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Email
            </Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
              <Input
                id="email"
                type="email"
                autoFocus={mode === "login"}
                placeholder="you@company.com"
                value={form.email}
                onChange={(e) => field("email", e.target.value)}
                className="pl-9 h-11"
                required
                autoComplete="email"
              />
            </div>
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Password
            </Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
              <Input
                id="password"
                type={showPass ? "text" : "password"}
                placeholder={mode === "register" ? "At least 12 characters" : "••••••••"}
                value={form.password}
                onChange={(e) => field("password", e.target.value)}
                className="pl-9 pr-10 h-11"
                required
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                minLength={mode === "register" ? 12 : undefined}
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowPass((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                aria-label={showPass ? "Hide password" : "Show password"}
              >
                {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>

            {/* Strength bar — register only */}
            {strength && (
              <div className="space-y-1 pt-0.5">
                <div className="h-1 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-400 ${strength.color}`}
                    style={{ width: strength.width }}
                  />
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Strength:{" "}
                  <span className="font-semibold text-foreground">
                    {strength.label}
                  </span>
                </p>
              </div>
            )}
          </div>

          {/* GDPR consent — register only */}
          {mode === "register" && (
            <div className="flex items-start gap-3 p-3 rounded-lg border border-border bg-muted/40">
              <input
                id="consent"
                type="checkbox"
                checked={form.consent}
                onChange={(e) => field("consent", e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-border accent-foreground cursor-pointer"
                aria-required="true"
              />
              <label htmlFor="consent" className="text-xs text-muted-foreground leading-relaxed cursor-pointer">
                I have read and agree to the{" "}
                <a
                  href="/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center gap-0.5 font-semibold text-foreground underline underline-offset-2 hover:opacity-70 transition-opacity"
                >
                  Privacy Policy
                  <ExternalLink className="h-2.5 w-2.5" />
                </a>
                {" "}and consent to processing my personal data{" "}
                <span className="font-medium">(GDPR Art. 7)</span>.
              </label>
            </div>
          )}

          {/* Submit */}
          <Button
            type="submit"
            size="lg"
            className="w-full h-11 font-bold gap-2"
            disabled={loading || (mode === "register" && !form.consent)}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground animate-spin" />
                Please wait…
              </span>
            ) : (
              <>
                {mode === "login" ? "Sign in" : "Create account"}
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>
        </form>

        {/* Trust signals */}
        <div className="flex items-center justify-center gap-3 text-[11px] text-muted-foreground/60 pt-1">
          {[
            "AES-256-GCM",
            "GDPR compliant",
            "Self-hosted",
          ].map((item, i, arr) => (
            <span key={item} className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" />
                {item}
              </span>
              {i < arr.length - 1 && <span className="w-px h-3 bg-border" />}
            </span>
          ))}
        </div>

      </div>
    </div>
  );
}
