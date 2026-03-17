import express from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import compression from "compression";
import morgan from "morgan";
import rateLimit from "express-rate-limit";

import { authRouter } from "./routes/auth";
import { projectsRouter } from "./routes/projects";
import { organizationsRouter } from "./routes/organizations";
import { secretsRouter } from "./routes/secrets";
import { membersRouter } from "./routes/members";
import { environmentsRouter } from "./routes/environments";
import { syncRouter } from "./routes/sync";
import { auditRouter } from "./routes/audit";
import { accountRouter } from "./routes/account";
import { errorHandler } from "./middleware/errorHandler";
import { requestContextMiddleware } from "./middleware/requestContext";
import { logger } from "./utils/logger";
import { prisma } from "./utils/prisma";

// ─── App ──────────────────────────────────────────────────────────────────────

const app = express();
const PORT = process.env.PORT || 3000;

/**
 * ISO 27001 A.13.1 / GDPR Art. 32 — when running behind nginx or Caddy, the
 * app sees the proxy's IP instead of the real client IP. Setting trust proxy
 * tells Express to read X-Forwarded-For, which nginx sets via:
 *   proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
 *
 * Value "1" means: trust exactly one hop (the immediate upstream proxy).
 * This is the correct setting when there is a single reverse-proxy in front.
 * Increase to "2" if you add a CDN/load-balancer in front of nginx.
 */
app.set("trust proxy", 1);

// ─── Security headers (Helmet) ────────────────────────────────────────────────
//
// ISO 27001 A.14.2.5 — Secure system engineering principles.
// Helmet sets a comprehensive suite of HTTP security headers.
//
app.use(
  helmet({
    // Content-Security-Policy — prevent XSS / resource injection
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        // HSTS is set separately below
      },
    },
    // HSTS — force HTTPS for 1 year (ISO 27001 A.14.1.3, GDPR Art.32)
    strictTransportSecurity: {
      maxAge: 31_536_000,
      includeSubDomains: true,
      preload: true,
    },
    // Prevent MIME sniffing
    noSniff: true,
    // Prevent clickjacking
    frameguard: { action: "deny" },
    // Disable X-Powered-By
    hidePoweredBy: true,
    // Referrer policy — minimise data leakage in Referer header
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    // Cross-Origin policies
    crossOriginEmbedderPolicy: false, // disabled — API is consumed cross-origin by the SPA
    crossOriginOpenerPolicy: { policy: "same-origin" },
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
);

// ─── CORS ─────────────────────────────────────────────────────────────────────
app.use(
  cors({
    origin: process.env.ALLOWED_ORIGINS?.split(",") || [
      "http://localhost:5173",
    ],
    credentials: true,
  }),
);

// ─── Rate limiting ────────────────────────────────────────────────────────────
//
// ISO 27001 A.9.4.2 / A.12.6.1 — Brute-force and DoS mitigation.
//
// Strict limit on auth endpoints (login + register) to prevent credential
// stuffing and brute-force attacks.
// A more generous global limit protects all other endpoints from DoS.
//
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too many requests, please try again later.",
    code: "RATE_LIMITED",
  },
});

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too many requests, please try again later.",
    code: "RATE_LIMITED",
  },
});

app.use(globalLimiter);

// ─── Request parsing & utilities ──────────────────────────────────────────────
app.use(compression());
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

// ─── Request context ──────────────────────────────────────────────────────────
//
// ISO 27001 A.12.4.1 — Event Logging.
// Must be registered BEFORE routes so that req.ctx (IP + UserAgent) is
// available to every handler and audit-logging call.
//
app.use(requestContextMiddleware);

// ─── HTTP access logging ──────────────────────────────────────────────────────
//
// ISO 27001 A.12.4.1 — Log all inbound requests.
// Uses 'combined' format (includes User-Agent, status, response time).
// In production the log stream is forwarded to Winston for structured output
// and optional file transport.
//
app.use(
  morgan("combined", {
    stream: { write: (msg) => logger.info(msg.trim()) },
    // Skip health-check polls to keep logs clean
    skip: (req) => req.url === "/health",
  }),
);

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use("/api/v1/auth/login", loginLimiter);
app.use("/api/v1/auth/register", loginLimiter);

app.use("/api/v1/auth", authRouter);
app.use("/api/v1/account", accountRouter);
app.use("/api/v1/projects", projectsRouter);
app.use("/api/v1/projects", membersRouter);
app.use("/api/v1/projects/:projectId/environments", environmentsRouter);
app.use("/api/v1/organizations", organizationsRouter);
app.use("/api/v1/secrets", secretsRouter);
app.use("/api/v1/sync", syncRouter);
app.use("/api/v1/audit", auditRouter);

// ─── Health check ─────────────────────────────────────────────────────────────
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
  });
});

// ─── Error handler ────────────────────────────────────────────────────────────
app.use(errorHandler);

// ─── Data Retention Job ───────────────────────────────────────────────────────
//
// GDPR Art. 5(1)(e) — Storage limitation principle:
//   "Personal data shall be kept in a form which permits identification of
//    data subjects for no longer than is necessary."
//
// ISO 27001 A.12.4.1 — Audit logs should be retained for a defined period
//   (default: 365 days) and then purged to minimise exposure.
//
// This job runs once at startup and then every 24 hours.
// For multi-instance deployments consider moving this to a dedicated
// cron service (e.g. a Kubernetes CronJob) to avoid concurrent execution.
//
const AUDIT_LOG_RETENTION_DAYS = parseInt(
  process.env.AUDIT_LOG_RETENTION_DAYS ?? "365",
  10,
);
const TOKEN_CLEANUP_ENABLED = process.env.TOKEN_CLEANUP !== "false";

async function runRetentionJob() {
  const label = "DataRetentionJob";
  try {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - AUDIT_LOG_RETENTION_DAYS);

    // 1. Purge expired refresh tokens (they are useless but take up space
    //    and constitute stored personal data — IP address, User-Agent).
    if (TOKEN_CLEANUP_ENABLED) {
      const { count: tokensDeleted } = await prisma.refreshToken.deleteMany({
        where: { expiresAt: { lt: new Date() } },
      });
      if (tokensDeleted > 0) {
        logger.info(`${label}: purged ${tokensDeleted} expired refresh tokens`);
      }
    }

    // 2. Purge audit logs older than the retention window.
    //    IP addresses embedded in those rows are personal data (GDPR Rec.30).
    //    Deletion is the correct action once the security-monitoring window
    //    has passed.
    const { count: logsDeleted } = await prisma.auditLog.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });
    if (logsDeleted > 0) {
      logger.info(
        `${label}: purged ${logsDeleted} audit log entries older than ` +
          `${AUDIT_LOG_RETENTION_DAYS} days (GDPR Art.5(1)(e) storage limitation)`,
      );
    }
  } catch (err) {
    // Never let a retention job failure crash the server
    logger.error(`${label}: retention job failed`, {
      error: (err as Error).message,
    });
  }
}

// ─── Server startup ───────────────────────────────────────────────────────────
app.listen(PORT, () => {
  logger.info(`envShare backend running on port ${PORT}`);

  // Run the retention job on startup (catches any backlog), then daily
  runRetentionJob();
  setInterval(runRetentionJob, 24 * 60 * 60 * 1000);
});

export default app;
