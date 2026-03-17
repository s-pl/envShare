import { Request, Response, NextFunction } from 'express';

/**
 * Request Context Middleware
 *
 * ISO 27001 A.12.4.1 — Event Logging
 * GDPR Art. 5(1)(f) — Integrity and confidentiality
 *
 * Extracts the real client IP (respecting X-Forwarded-For when behind a trusted
 * reverse proxy) and User-Agent string, then attaches them to the request object
 * so that downstream handlers and audit logging can use them without re-parsing.
 *
 * IP addresses are personal data under GDPR (Recital 30). They are collected
 * under the "legitimate interests" basis (Art. 6(1)(f)) solely for security
 * monitoring, fraud detection, and anomaly alerting. They are never exposed in
 * API responses and are purged after AUDIT_LOG_RETENTION_DAYS (default: 365).
 */

export interface RequestContext {
  ipAddress: string;
  userAgent: string;
}

declare global {
  // Augment the Express Request type so every handler can access ctx without casting
  namespace Express {
    interface Request {
      ctx: RequestContext;
    }
  }
}

/**
 * Parses the leftmost (i.e. original client) IP from an X-Forwarded-For header.
 * Returns the raw value if parsing fails.
 */
function parseForwardedFor(header: string): string {
  // X-Forwarded-For: client, proxy1, proxy2
  const first = header.split(',')[0]?.trim();
  return first || header;
}

/**
 * Resolves the real client IP address.
 *
 * Priority (highest → lowest):
 *   1. X-Forwarded-For (only when app.set('trust proxy', 1) is active — set in app.ts)
 *   2. X-Real-IP (set by nginx: proxy_set_header X-Real-IP $remote_addr)
 *   3. req.ip (Express — already handles trust proxy for us at this layer)
 *   4. socket.remoteAddress (raw TCP, last resort)
 */
function resolveIp(req: Request): string {
  const xff = req.headers['x-forwarded-for'];
  if (xff) {
    const ip = Array.isArray(xff) ? xff[0] : parseForwardedFor(xff);
    if (ip) return ip;
  }

  const xri = req.headers['x-real-ip'];
  if (xri && !Array.isArray(xri)) return xri;

  return req.ip ?? req.socket?.remoteAddress ?? 'unknown';
}

/**
 * Middleware — must be registered BEFORE any route handlers.
 *
 * Usage in app.ts:
 *   app.use(requestContextMiddleware);
 *
 * Usage in a handler / service:
 *   req.ctx.ipAddress
 *   req.ctx.userAgent
 */
export function requestContextMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  req.ctx = {
    ipAddress: resolveIp(req),
    userAgent: (req.headers['user-agent'] ?? 'unknown').slice(0, 512), // cap length
  };
  next();
}
