import { Request, Response, NextFunction } from 'express';

/**
 * Request Context Middleware
 *
 * ISO 27001 A.12.4.1 — Event Logging
 * GDPR Art. 5(1)(f) — Integrity and confidentiality
 *
 * Extracts the client IP and User-Agent string, then attaches them to the
 * request object so downstream handlers and audit logging can use them without
 * re-parsing.
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
 * Resolves the real client IP address.
 *
 * Security note:
 *   - We intentionally DO NOT read X-Forwarded-For or X-Real-IP manually.
 *   - Express computes req.ip based on app.set('trust proxy', ...).
 *   - This prevents header spoofing when trust proxy is disabled.
 */
function resolveIp(req: Request): string {
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
