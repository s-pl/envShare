import { useState, useEffect, useCallback } from "react";
import {
  X,
  Lock,
  Monitor,
  Shield,
  Trash2,
  Download,
  LogOut,
  AlertTriangle,
  RefreshCw,
  Eye,
  EyeOff,
  CheckCircle2,
  Smartphone,
  Globe,
} from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Badge } from "../ui/badge";
import { Separator } from "../ui/separator";
import { api } from "../../api";
import { useAuthStore } from "../../store/authStore";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface Session {
  id: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  expiresAt: string;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

/** Formats an ISO timestamp as a human-readable relative time. */
function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 2) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/** Best-effort User-Agent parser — returns a friendly label. */
function parseUA(ua: string | null): string {
  if (!ua) return "Unknown device";
  if (/iPhone|iPad|iPod/i.test(ua)) return "iOS device";
  if (/Android/i.test(ua)) return "Android device";
  if (/Windows/i.test(ua)) {
    if (/Chrome/i.test(ua)) return "Chrome on Windows";
    if (/Firefox/i.test(ua)) return "Firefox on Windows";
    if (/Edge/i.test(ua)) return "Edge on Windows";
    return "Windows browser";
  }
  if (/Macintosh/i.test(ua)) {
    if (/Chrome/i.test(ua)) return "Chrome on macOS";
    if (/Firefox/i.test(ua)) return "Firefox on macOS";
    if (/Safari/i.test(ua)) return "Safari on macOS";
    return "macOS browser";
  }
  if (/Linux/i.test(ua)) return "Linux browser";
  if (/esai-cli/i.test(ua)) return "esai CLI";
  return "Unknown browser";
}

function SessionIcon({ ua }: { ua: string | null }) {
  if (!ua) return <Globe className="h-4 w-4 text-muted-foreground" />;
  if (/iPhone|iPad|Android/i.test(ua))
    return <Smartphone className="h-4 w-4 text-muted-foreground" />;
  if (/esai-cli/i.test(ua))
    return <Monitor className="h-4 w-4 text-muted-foreground font-mono" />;
  return <Monitor className="h-4 w-4 text-muted-foreground" />;
}

// ─── Sub-panels ────────────────────────────────────────────────────────────────

// ── Change Password ───────────────────────────────────────────────────────────

function ChangePasswordPanel({ onSuccess }: { onSuccess: () => void }) {
  const [form, setForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [loading, setLoading] = useState(false);

  function set(field: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  const passwordStrength = (() => {
    const p = form.newPassword;
    if (p.length === 0) return null;
    let score = 0;
    if (p.length >= 12) score++;
    if (p.length >= 16) score++;
    if (/[A-Z]/.test(p)) score++;
    if (/[0-9]/.test(p)) score++;
    if (/[^A-Za-z0-9]/.test(p)) score++;
    if (score <= 2) return { label: "Weak", color: "bg-foreground/30", width: "33%" };
    if (score <= 3)
      return { label: "Fair", color: "bg-foreground/60", width: "66%" };
    return { label: "Strong", color: "bg-foreground", width: "100%" };
  })();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (form.newPassword !== form.confirmPassword) {
      toast.error("New passwords do not match.");
      return;
    }
    if (form.newPassword.length < 12) {
      toast.error("New password must be at least 12 characters.");
      return;
    }
    setLoading(true);
    try {
      const res = await api.put<{ sessionsRevoked: number }>(
        "/account/password",
        {
          currentPassword: form.currentPassword,
          newPassword: form.newPassword,
        },
      );
      toast.success(
        `Password changed. ${res.sessionsRevoked} session${res.sessionsRevoked !== 1 ? "s" : ""} were signed out.`,
      );
      setForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      onSuccess();
    } catch (err: any) {
      toast.error(err.message ?? "Failed to change password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="rounded-lg border border-border/60 bg-muted/30 px-4 py-3 flex gap-2.5">
        <Shield className="h-4 w-4 text-primary mt-0.5 shrink-0" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          After changing your password, all active sessions will be signed out
          and you will need to log in again.{" "}
          <span className="text-foreground font-medium">
            ISO 27001 A.9.4.3 — Password Management.
          </span>
        </p>
      </div>

      {/* Current password */}
      <div className="space-y-1.5">
        <Label
          htmlFor="cp-current"
          className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
        >
          Current password
        </Label>
        <div className="relative">
          <Input
            id="cp-current"
            type={showCurrent ? "text" : "password"}
            placeholder="••••••••"
            value={form.currentPassword}
            onChange={(e) => set("currentPassword", e.target.value)}
            className="pr-10 h-10"
            required
            autoComplete="current-password"
          />
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setShowCurrent((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-muted-foreground"
            aria-label={showCurrent ? "Hide password" : "Show password"}
          >
            {showCurrent ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      {/* New password */}
      <div className="space-y-1.5">
        <Label
          htmlFor="cp-new"
          className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
        >
          New password
        </Label>
        <div className="relative">
          <Input
            id="cp-new"
            type={showNew ? "text" : "password"}
            placeholder="At least 12 characters"
            value={form.newPassword}
            onChange={(e) => set("newPassword", e.target.value)}
            className="pr-10 h-10"
            required
            autoComplete="new-password"
          />
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setShowNew((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-muted-foreground"
            aria-label={showNew ? "Hide password" : "Show password"}
          >
            {showNew ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        </div>

        {/* Strength meter */}
        {passwordStrength && (
          <div className="space-y-1 mt-1">
            <div className="h-1 w-full bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${passwordStrength.color}`}
                style={{ width: passwordStrength.width }}
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              Strength:{" "}
              <span className="font-medium text-foreground">
                {passwordStrength.label}
              </span>
            </p>
          </div>
        )}
      </div>

      {/* Confirm new password */}
      <div className="space-y-1.5">
        <Label
          htmlFor="cp-confirm"
          className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
        >
          Confirm new password
        </Label>
        <div className="relative">
          <Input
            id="cp-confirm"
            type="password"
            placeholder="••••••••"
            value={form.confirmPassword}
            onChange={(e) => set("confirmPassword", e.target.value)}
            className="pr-10 h-10"
            required
            autoComplete="new-password"
          />
          {form.confirmPassword && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              {form.confirmPassword === form.newPassword ? (
                <CheckCircle2 className="h-4 w-4 text-foreground" />
              ) : (
                <X className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
          )}
        </div>
      </div>

      <Button
        type="submit"
        disabled={loading}
        className="w-full h-10 font-semibold gap-2"
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <span className="h-3.5 w-3.5 rounded-full border-2 border-primary-foreground/40 border-t-primary-foreground animate-spin" />
            Changing password…
          </span>
        ) : (
          <>
            <Lock className="h-4 w-4" />
            Change password
          </>
        )}
      </Button>
    </form>
  );
}

// ── Active Sessions ────────────────────────────────────────────────────────────

function SessionsPanel() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [revokingAll, setRevokingAll] = useState(false);
  const logout = useAuthStore((s) => s.logout);

  const loadSessions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ sessions: Session[] }>("/account/sessions");
      setSessions(res.sessions);
    } catch (err: any) {
      toast.error(err.message ?? "Failed to load sessions.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  async function revokeOne(id: string) {
    setRevoking(id);
    try {
      await api.delete(`/account/sessions/${id}`);
      setSessions((prev) => prev.filter((s) => s.id !== id));
      toast.success("Session revoked.");
    } catch (err: any) {
      toast.error(err.message ?? "Failed to revoke session.");
    } finally {
      setRevoking(null);
    }
  }

  async function revokeAll() {
    setRevokingAll(true);
    try {
      await api.delete<{ sessionsRevoked: number }>("/account/sessions");
      toast.success("All sessions signed out. Please log in again.");
      await logout();
    } catch (err: any) {
      toast.error(err.message ?? "Failed to sign out all sessions.");
      setRevokingAll(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2].map((i) => (
          <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border/60 bg-muted/30 px-4 py-3 flex gap-2.5">
        <Shield className="h-4 w-4 text-primary mt-0.5 shrink-0" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          These are all devices currently signed into your account.{" "}
          <span className="text-foreground font-medium">
            ISO 27001 A.9.4 — Session Management.
          </span>{" "}
          Revoke any session you don't recognise immediately.
        </p>
      </div>

      {sessions.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">
          No active sessions found.
        </p>
      ) : (
        <div className="space-y-2">
          {sessions.map((session) => (
            <div
              key={session.id}
              className="flex items-center gap-3 rounded-lg border border-border/60 bg-card px-3.5 py-3"
            >
              <SessionIcon ua={session.userAgent} />

              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-foreground truncate">
                  {parseUA(session.userAgent)}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5 flex gap-2 flex-wrap">
                  {session.ipAddress && (
                    <span className="font-mono">{session.ipAddress}</span>
                  )}
                  <span>Started {relativeTime(session.createdAt)}</span>
                  <span>·</span>
                  <span>Expires {relativeTime(session.expiresAt)}</span>
                </p>
              </div>

              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2.5 text-xs text-muted-foreground hover:text-destructive shrink-0"
                onClick={() => revokeOne(session.id)}
                disabled={revoking === session.id}
              >
                {revoking === session.id ? (
                  <span className="h-3 w-3 rounded-full border-2 border-muted-foreground/40 border-t-muted-foreground animate-spin" />
                ) : (
                  <LogOut className="h-3.5 w-3.5" />
                )}
              </Button>
            </div>
          ))}
        </div>
      )}

      {sessions.length > 0 && (
        <>
          <Separator />
          <Button
            variant="outline"
            className="w-full h-9 text-xs gap-2 text-destructive border-destructive/30 hover:bg-destructive/5"
            onClick={revokeAll}
            disabled={revokingAll}
          >
            {revokingAll ? (
              <span className="h-3 w-3 rounded-full border-2 border-muted-foreground/40 border-t-muted-foreground animate-spin" />
            ) : (
              <LogOut className="h-3.5 w-3.5" />
            )}
            Sign out all devices
          </Button>
        </>
      )}
    </div>
  );
}

// ── Data & Privacy ─────────────────────────────────────────────────────────────

function DataPrivacyPanel({ onDeleted }: { onDeleted: () => void }) {
  const [exporting, setExporting] = useState(false);
  const [deleteStep, setDeleteStep] = useState<"idle" | "confirm">("idle");
  const [deleteForm, setDeleteForm] = useState({ password: "", phrase: "" });
  const [deleting, setDeleting] = useState(false);
  const logout = useAuthStore((s) => s.logout);

  async function handleExport() {
    setExporting(true);
    try {
      // Fetch the export as a Blob so we can trigger a file download
      const BASE_URL = (import.meta.env.VITE_API_URL ?? "") + "/api/v1";
      const res = await fetch(`${BASE_URL}/account/export`, {
        credentials: "include",
        headers: {
          // The access token is held in memory — read it via the existing api module
          // We use the Authorization header that axiosInstance would set.
          // Since we can't access axiosInstance internals directly, we rely on the
          // fact that the browser will include the cookie automatically and we can
          // use the same token we have in memory.
        },
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Export failed");
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `envshare-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Your data export has been downloaded.");
    } catch (err: any) {
      // Fallback: use the api module directly
      try {
        const data = await api.get<unknown>("/account/export");
        const blob = new Blob([JSON.stringify(data, null, 2)], {
          type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `envshare-export-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success("Your data export has been downloaded.");
      } catch (err2: any) {
        toast.error(err2.message ?? "Export failed. Please try again.");
      }
    } finally {
      setExporting(false);
    }
  }

  async function handleDelete(e: React.FormEvent) {
    e.preventDefault();
    if (deleteForm.phrase !== "DELETE MY ACCOUNT") {
      toast.error('Please type "DELETE MY ACCOUNT" exactly to confirm.');
      return;
    }
    setDeleting(true);
    try {
      await api.delete("/account", {
        password: deleteForm.password,
        confirmPhrase: deleteForm.phrase,
      } as any);
      toast.success("Your account has been permanently deleted.");
      onDeleted();
      await logout();
    } catch (err: any) {
      toast.error(err.message ?? "Failed to delete account.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Export */}
      <div className="rounded-xl border border-border/60 p-4 space-y-3">
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted shrink-0">
            <Download className="h-4 w-4 text-muted-foreground" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              Export your data
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
              Download a machine-readable JSON file containing all personal data
              we hold about you. This includes your profile, project
              memberships, personal secret key names, and activity history.{" "}
              <span className="font-medium text-foreground">
                GDPR Art. 15 &amp; 20 — Right of access &amp; portability.
              </span>
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="w-full h-9 gap-2 text-xs"
          onClick={handleExport}
          disabled={exporting}
        >
          {exporting ? (
            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Download className="h-3.5 w-3.5" />
          )}
          {exporting ? "Preparing export…" : "Download data export"}
        </Button>
      </div>

      {/* Privacy Policy link */}
      <div className="rounded-xl border border-border/60 p-4 flex items-start gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted shrink-0">
          <Shield className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-foreground">
            Privacy Policy
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
            Read our full Privacy Policy to understand how we collect, use, and
            protect your personal data in compliance with GDPR and the UK Data
            Protection Act 2018.
          </p>
          <a
            href="/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 mt-2 text-xs font-medium text-primary hover:underline underline-offset-2"
          >
            Read Privacy Policy →
          </a>
        </div>
      </div>

      <Separator />

      {/* Delete account */}
      <div className="rounded-xl border border-destructive/30 p-4 space-y-3">
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-destructive/10 shrink-0">
            <Trash2 className="h-4 w-4 text-destructive" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-destructive">
              Delete account
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
              Permanently delete your account and all associated personal data.
              Projects you are a member of will not be deleted — only your
              membership and personal secret values. This action{" "}
              <span className="font-semibold text-foreground">
                cannot be undone.
              </span>{" "}
              <span className="font-medium text-foreground">
                GDPR Art. 17 — Right to erasure.
              </span>
            </p>
          </div>
        </div>

        {deleteStep === "idle" ? (
          <Button
            variant="outline"
            size="sm"
            className="w-full h-9 gap-2 text-xs text-destructive border-destructive/30 hover:bg-destructive/5"
            onClick={() => setDeleteStep("confirm")}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete my account
          </Button>
        ) : (
          <form onSubmit={handleDelete} className="space-y-3 pt-1">
            <div className="rounded-lg bg-destructive/5 border border-destructive/20 px-3 py-2.5 flex gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
              <p className="text-xs text-destructive leading-relaxed">
                This will immediately and permanently delete your account. All
                your personal secret values, sessions, and profile data will be
                erased.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="del-password"
                className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
              >
                Confirm your password
              </Label>
              <Input
                id="del-password"
                type="password"
                placeholder="Your current password"
                value={deleteForm.password}
                onChange={(e) =>
                  setDeleteForm((f) => ({ ...f, password: e.target.value }))
                }
                className="h-9 text-sm"
                required
                autoComplete="current-password"
              />
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="del-phrase"
                className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
              >
                Type{" "}
                <code className="font-mono text-[11px] bg-muted px-1 py-0.5 rounded normal-case">
                  DELETE MY ACCOUNT
                </code>{" "}
                to confirm
              </Label>
              <Input
                id="del-phrase"
                type="text"
                placeholder="DELETE MY ACCOUNT"
                value={deleteForm.phrase}
                onChange={(e) =>
                  setDeleteForm((f) => ({ ...f, phrase: e.target.value }))
                }
                className="h-9 text-sm font-mono"
                required
                autoComplete="off"
                spellCheck={false}
              />
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="flex-1 h-9 text-xs"
                onClick={() => {
                  setDeleteStep("idle");
                  setDeleteForm({ password: "", phrase: "" });
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={
                  deleting ||
                  deleteForm.phrase !== "DELETE MY ACCOUNT" ||
                  !deleteForm.password
                }
                className="flex-1 h-9 text-xs bg-destructive hover:bg-destructive/90 text-destructive-foreground gap-1.5"
              >
                {deleting ? (
                  <span className="h-3 w-3 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
                {deleting ? "Deleting…" : "Permanently delete"}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// ─── Main Dialog ───────────────────────────────────────────────────────────────

type Tab = "password" | "sessions" | "data";

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "password", label: "Password", icon: Lock },
  { id: "sessions", label: "Sessions", icon: Monitor },
  { id: "data", label: "Data & Privacy", icon: Shield },
];

interface AccountSettingsDialogProps {
  open: boolean;
  onClose: () => void;
}

export function AccountSettingsDialog({
  open,
  onClose,
}: AccountSettingsDialogProps) {
  const [activeTab, setActiveTab] = useState<Tab>("password");

  if (!open) return null;

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-foreground/20 backdrop-blur-sm animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Account Settings"
    >
      <div className="relative w-full max-w-lg bg-card rounded-2xl border border-border shadow-2xl shadow-foreground/10 flex flex-col max-h-[90vh] overflow-hidden animate-fade-in">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border/60 shrink-0">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
            <Shield className="h-4.5 w-4.5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-bold text-foreground leading-tight">
              Account Settings
            </h2>
            <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">
              Security, privacy, and GDPR data rights
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground shrink-0"
            onClick={onClose}
            aria-label="Close account settings"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Tab bar */}
        <div className="flex gap-0.5 px-4 pt-3 pb-0 shrink-0">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`
                flex items-center gap-1.5 px-3 py-2 rounded-t-lg text-xs font-semibold
                transition-colors border-b-2 -mb-px
                ${
                  activeTab === id
                    ? "border-primary text-primary bg-primary/5"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50"
                }
              `}
              aria-selected={activeTab === id}
              role="tab"
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>

        <div className="w-full h-px bg-border/60 shrink-0" />

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto p-5">
          {activeTab === "password" && (
            <ChangePasswordPanel onSuccess={onClose} />
          )}
          {activeTab === "sessions" && <SessionsPanel />}
          {activeTab === "data" && <DataPrivacyPanel onDeleted={onClose} />}
        </div>
      </div>
    </div>
  );
}
