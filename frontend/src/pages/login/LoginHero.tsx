import { Logo } from "../../components/brand/Logo";
import { ShieldCheck, Users, Zap } from "lucide-react";

const STATS = [
  { icon: ShieldCheck, label: "AES-256-GCM encrypted at rest" },
  { icon: Users,       label: "Per-user personal values" },
  { icon: Zap,         label: "CLI sync in one command" },
];

interface VaultItem {
  key:    string;
  masked: string;
  shared: boolean;
}

const VAULT_ITEMS: VaultItem[] = [
  { key: "DATABASE_URL",  masked: "postgres://••••@host/db",  shared: true  },
  { key: "REDIS_URL",     masked: "redis://••••••:6379",       shared: true  },
  { key: "JWT_SECRET",    masked: "eyJhbG••••••••••",          shared: false },
  { key: "STRIPE_KEY",    masked: "sk_live_••••••••",          shared: false },
  { key: "AWS_SECRET",    masked: "wJalrX••••••••••",          shared: false },
];

function VaultCard({ item, index }: { item: VaultItem; index: number }) {
  return (
    <div
      className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg border border-white/10 bg-white/5 font-mono text-[11px] text-white/60 select-none"
      style={{
        animation: "vault-float 4s ease-in-out infinite alternate",
        animationDelay: `${index * 0.5}s`,
      }}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full shrink-0 ${
          item.shared ? "bg-white/60" : "bg-white/25"
        }`}
      />
      <div className="min-w-0">
        <p className="text-white/35 text-[9px] leading-none mb-0.5 truncate">{item.key}</p>
        <p className="truncate text-white/55">{item.masked}</p>
      </div>
      {item.shared && (
        <span className="ml-auto text-[9px] text-white/30 shrink-0">shared</span>
      )}
    </div>
  );
}

export function LoginHero() {
  return (
    <div className="relative hidden lg:grid lg:grid-cols-[1fr_200px] overflow-hidden bg-[#0a0a0a]">
      {/* Grid background */}
      <div
        className="absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.8) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.8) 1px, transparent 1px)
          `,
          backgroundSize: "48px 48px",
        }}
      />

      {/* Text content — left column */}
      <div className="relative z-10 flex flex-col h-full p-12">
        <Logo size="md" showTagline className="mb-auto" />

        <div className="mt-auto space-y-8 pb-4">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/10 bg-white/5 text-white/50 text-xs font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-white/60 animate-pulse" />
            End-to-end encrypted
          </div>

          {/* Headline */}
          <div className="space-y-3">
            <h1 className="text-4xl xl:text-5xl font-extrabold leading-[1.1] tracking-tight text-white">
              Secrets for your{" "}
              <span className="text-white/35">whole team.</span>
            </h1>
            <p className="text-white/40 text-sm leading-relaxed">
              Stop sharing{" "}
              <code className="text-white/60 bg-white/8 px-1.5 py-0.5 rounded text-[12px] font-mono">
                .env
              </code>{" "}
              files over Slack. Personal values stay private; shared ones sync instantly.
            </p>
          </div>

          {/* Feature list */}
          <div className="space-y-2">
            {STATS.map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-2.5 text-white/40 text-sm">
                <div className="flex h-6 w-6 items-center justify-center rounded-md bg-white/8 shrink-0">
                  <Icon className="h-3.5 w-3.5 text-white/55" />
                </div>
                {label}
              </div>
            ))}
          </div>

          {/* Terminal snippet */}
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl border border-white/10 bg-white/4 font-mono text-sm">
            <span className="text-white/30">$</span>
            <span className="text-white/65">esai pull</span>
            <span className="text-white/15 mx-1">·</span>
            <span className="text-white/40 text-xs">✓ 12 secrets synced</span>
          </div>
        </div>
      </div>

      {/* Vault cards — isolated right column, never overlaps text */}
      <div className="relative z-10 flex flex-col justify-center gap-2.5 pr-6 py-12">
        {VAULT_ITEMS.map((item, i) => (
          <VaultCard key={item.key} item={item} index={i} />
        ))}
      </div>

      <style>{`
        @keyframes vault-float {
          from { transform: translateY(0px); opacity: 0.6; }
          to   { transform: translateY(-6px); opacity: 0.9; }
        }
      `}</style>
    </div>
  );
}
