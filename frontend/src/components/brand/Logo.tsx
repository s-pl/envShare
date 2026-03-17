import { useId } from "react";

interface LogoMarkProps {
  size?: number;
  animated?: boolean;
  className?: string;
}

/**
 * envShare logomark — circuit-key "E" monogram.
 *
 * Light mode: dark mark on white rounded square.
 * Dark mode:  light mark on near-black rounded square.
 * The three horizontal bars with terminal dots represent
 * env variables (E) and connection/share nodes.
 */
export function LogoMark({
  size = 32,
  animated = false,
  className = "",
}: LogoMarkProps) {
  const uid = useId().replace(/:/g, "");

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="envShare"
      role="img"
    >
      <defs>
        {/* Light mode fill — near-black */}
        <linearGradient id={`bg-light-${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#18181b" />
          <stop offset="100%" stopColor="#09090b" />
        </linearGradient>
        {/* Dark mode fill — near-white */}
        <linearGradient id={`bg-dark-${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#fafafa" />
          <stop offset="100%" stopColor="#e4e4e7" />
        </linearGradient>

        <clipPath id={`clip-${uid}`}>
          <rect width="32" height="32" rx="8" />
        </clipPath>
      </defs>

      {/* Background rounded square — switches with color-scheme */}
      {/* Light: dark bg */}
      <rect
        width="32"
        height="32"
        rx="8"
        fill={`url(#bg-light-${uid})`}
        className="dark:opacity-0"
      />
      {/* Dark: light bg */}
      <rect
        width="32"
        height="32"
        rx="8"
        fill={`url(#bg-dark-${uid})`}
        className="opacity-0 dark:opacity-100"
      />

      {/* Subtle top-left sheen */}
      <rect
        x="0"
        y="0"
        width="32"
        height="14"
        fill="white"
        fillOpacity="0.06"
        clipPath={`url(#clip-${uid})`}
      />

      {/* ── Circuit-key "E" icon ─────────────────────────────────── */}

      {/* Vertical stem */}
      <rect
        x="9"
        y="8"
        width="2.5"
        height="16"
        rx="1.25"
        fill="white"
        className="dark:fill-[#09090b]"
      />

      {/* Top horizontal bar */}
      <rect
        x="11.5"
        y="8"
        width="5.5"
        height="2.5"
        rx="1.25"
        fill="white"
        className="dark:fill-[#09090b]"
      />
      {/* Top end node */}
      <circle
        cx="18.5"
        cy="9.25"
        r="2"
        fill="white"
        fillOpacity="0.9"
        className="dark:fill-[#09090b]"
      />
      <circle
        cx="18.5"
        cy="9.25"
        r="0.8"
        fill="white"
        fillOpacity="0.35"
        className="dark:fill-[#09090b] dark:fill-opacity-40"
      />

      {/* Middle horizontal bar (shorter) */}
      <rect
        x="11.5"
        y="14.75"
        width="4"
        height="2.5"
        rx="1.25"
        fill="white"
        className="dark:fill-[#09090b]"
      />
      {/* Middle end node */}
      <circle
        cx="17"
        cy="16"
        r="2"
        fill="white"
        fillOpacity="0.9"
        className="dark:fill-[#09090b]"
      />
      <circle
        cx="17"
        cy="16"
        r="0.8"
        fill="white"
        fillOpacity="0.35"
        className="dark:fill-[#09090b] dark:fill-opacity-40"
      />

      {/* Bottom horizontal bar */}
      <rect
        x="11.5"
        y="21.5"
        width="5.5"
        height="2.5"
        rx="1.25"
        fill="white"
        className="dark:fill-[#09090b]"
      />
      {/* Bottom end node */}
      <circle
        cx="18.5"
        cy="22.75"
        r="2"
        fill="white"
        fillOpacity="0.9"
        className="dark:fill-[#09090b]"
      />
      <circle
        cx="18.5"
        cy="22.75"
        r="0.8"
        fill="white"
        fillOpacity="0.35"
        className="dark:fill-[#09090b] dark:fill-opacity-40"
      />

    </svg>
  );
}

/* ── Full logotype ─────────────────────────────────────────────────── */

interface LogoProps {
  size?: "sm" | "md" | "lg" | "xl";
  animated?: boolean;
  className?: string;
  showTagline?: boolean;
}

const SIZES = {
  sm: { mark: 24, text: "text-sm", tagline: "text-[10px]" },
  md: { mark: 32, text: "text-base", tagline: "text-[11px]" },
  lg: { mark: 40, text: "text-lg", tagline: "text-xs" },
  xl: { mark: 52, text: "text-2xl", tagline: "text-sm" },
};

export function Logo({
  size = "md",
  animated = false,
  className = "",
  showTagline = false,
}: LogoProps) {
  const s = SIZES[size];
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <LogoMark size={s.mark} animated={animated} className="shrink-0" />
      <div>
        <span
          className={`font-extrabold tracking-tight leading-none ${s.text} text-foreground`}
        >
          envShare
        </span>
        {showTagline && (
          <p
            className={`${s.tagline} text-muted-foreground leading-none mt-0.5`}
          >
            secrets management
          </p>
        )}
      </div>
    </div>
  );
}
