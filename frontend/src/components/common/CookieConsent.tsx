import { useState, useEffect } from 'react';
import { Cookie, X, ExternalLink } from 'lucide-react';
import { Button } from '../ui/button';

const STORAGE_KEY = 'envshare_cookie_notice_acknowledged';

/**
 * CookieConsent — GDPR / UK PECR (Privacy and Electronic Communications Regulations)
 *
 * The only cookie this application sets is the `refresh_token` HttpOnly cookie,
 * which is strictly necessary for the authentication session to function.
 *
 * Under ICO guidance and EU GDPR Recital 47 / PECR Reg. 6(1), strictly-necessary
 * cookies are exempt from the requirement to obtain prior opt-in consent.
 * However, we are still required to inform users that the cookie exists and
 * explain its purpose — which is the sole function of this notice.
 *
 * This banner is shown once per browser until the user dismisses it, after
 * which the acknowledgement is stored in localStorage so it is not shown again.
 * localStorage itself contains no personal data — only the boolean flag.
 */
export function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Only show the banner if the user hasn't acknowledged it before
    try {
      const ack = localStorage.getItem(STORAGE_KEY);
      if (!ack) setVisible(true);
    } catch {
      // localStorage unavailable (private browsing mode, etc.) — show anyway
      setVisible(true);
    }
  }, []);

  function dismiss() {
    try {
      localStorage.setItem(STORAGE_KEY, new Date().toISOString());
    } catch {
      // If localStorage is unavailable the banner will reappear next visit,
      // which is acceptable — better than silently failing.
    }
    setVisible(false);
  }

  if (!visible) return null;

  return (
    /**
     * Fixed bottom bar — does not obstruct main content, accessible via
     * keyboard (focus-trap is intentionally NOT used because this is an
     * informational notice, not a blocking modal).
     */
    <div
      role="region"
      aria-label="Cookie notice"
      className="fixed bottom-0 left-0 right-0 z-50 p-4 animate-fade-in"
    >
      <div className="max-w-3xl mx-auto">
        <div className="
          relative flex flex-col sm:flex-row items-start sm:items-center gap-3
          rounded-xl border border-border/80 bg-card/95 backdrop-blur-md
          shadow-lg shadow-foreground/5 px-4 py-3.5
        ">
          {/* Icon */}
          <div className="shrink-0 flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
            <Cookie className="h-4 w-4 text-primary" />
          </div>

          {/* Text */}
          <p className="flex-1 text-xs text-muted-foreground leading-relaxed">
            <span className="font-semibold text-foreground">Cookie notice. </span>
            This site uses a single{' '}
            <span className="font-medium text-foreground">strictly-necessary</span>{' '}
            HttpOnly session cookie (<code className="font-mono text-[11px] bg-muted px-1 py-0.5 rounded">refresh_token</code>)
            to keep you signed in. No tracking, analytics, or advertising cookies are used.
            This cookie is exempt from prior-consent requirements under GDPR and the UK PECR.{' '}
            <a
              href="/privacy"
              className="
                inline-flex items-center gap-0.5 font-medium text-primary
                underline underline-offset-2 hover:text-primary/80 transition-colors
              "
              target="_blank"
              rel="noopener noreferrer"
            >
              Privacy Policy
              <ExternalLink className="h-2.5 w-2.5" />
            </a>
          </p>

          {/* Dismiss */}
          <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
            <Button
              size="sm"
              className="h-7 px-3 text-xs font-semibold"
              onClick={dismiss}
            >
              Got it
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={dismiss}
              aria-label="Dismiss cookie notice"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
