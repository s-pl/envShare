import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { randomBytes, createHash } from "crypto";
import { prisma } from "../utils/prisma";
import { AppError } from "../middleware/errorHandler";
import { logger } from "../utils/logger";
import { isServerAdmin } from "../utils/serverConfig";

// ─── Constants ────────────────────────────────────────────────────────────────

const BCRYPT_ROUNDS = 12;
const ACCESS_TOKEN_TTL = "15m";
const REFRESH_TOKEN_TTL_DAYS = 7;

/**
 * ISO 27001 A.9.4.2 — Secure log-on procedures.
 * After MAX_FAILED_ATTEMPTS consecutive failures the account is locked for
 * LOCKOUT_DURATION_MINUTES. The counter resets on any successful login.
 */
const MAX_FAILED_ATTEMPTS = 10;
const LOCKOUT_DURATION_MIN = 30;
const MAX_ACTIVE_SESSIONS = 5;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * One-way hash for refresh tokens stored in the database.
 *
 * Refresh tokens are long random values (40 bytes / 80 hex chars), so SHA-256
 * is sufficient — no need for bcrypt's cost factor. This means a database
 * breach exposes only hashes, not usable tokens.
 *
 * ISO 27001 A.9.4.3 — Password management system (extended to session tokens).
 */
function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function signAccess(userId: string, email: string): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET not configured");
  return jwt.sign({ sub: userId, email }, secret, {
    expiresIn: ACCESS_TOKEN_TTL,
  });
}

interface SessionMeta {
  ipAddress?: string;
  userAgent?: string;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const authService = {
  /**
   * Register a new user with email + password only.
   *
   * Name is derived from the email's local-part — display-only, editable later.
   * If the email is listed in server.config.json, the user is automatically
   * added as ADMIN to every existing project.
   */
  async register(email: string, password: string) {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing)
      throw new AppError(409, "Email already registered", "AUTH_EMAIL_TAKEN");

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const name = email.split("@")[0] || email;

    const user = await prisma.user.create({
      data: { email, passwordHash, name },
      select: { id: true, email: true, name: true, createdAt: true },
    });

    // Server-admins are auto-enrolled as ADMIN on every existing project so
    // they have the "admins in all projects" guarantee from day one.
    if (isServerAdmin(user.email)) {
      const projects = await prisma.project.findMany({ select: { id: true } });
      if (projects.length > 0) {
        await prisma.projectMember.createMany({
          data: projects.map(p => ({
            projectId: p.id,
            userId: user.id,
            role: "ADMIN" as const,
          })),
          skipDuplicates: true,
        });
      }
      logger.info("Server-admin registered — auto-enrolled on all projects", {
        userId: user.id,
        email: user.email,
        projectCount: projects.length,
      });
    } else {
      logger.info("User registered", { userId: user.id, email: user.email });
    }

    return user;
  },

  /**
   * Authenticate a user and issue a token pair.
   *
   * ISO 27001 A.9.4.2 — accounts are locked after MAX_FAILED_ATTEMPTS
   * consecutive failures and remain locked for LOCKOUT_DURATION_MIN minutes.
   * The lockout counter is stored in the database so it survives server restarts
   * and scales across multiple backend instances.
   *
   * We always run bcrypt.compare (even for non-existent users) to avoid
   * timing-based user-enumeration attacks.
   */
  async login(email: string, password: string, session: SessionMeta = {}) {
    const user = await prisma.user.findUnique({ where: { email } });

    // ── Account lockout check ────────────────────────────────────────────────
    if (user?.lockedUntil && user.lockedUntil > new Date()) {
      const minutesLeft = Math.ceil(
        (user.lockedUntil.getTime() - Date.now()) / 60_000,
      );

      // Log the attempt against the locked account for SIEM/alerting
      await prisma.auditLog.create({
        data: {
          action: "AUTH_LOGIN_LOCKED",
          actor: user.id,
          resourceId: user.id,
          resourceType: "user",
          metadata: { email, minutesLeft },
          ipAddress: session.ipAddress ?? null,
          userAgent: session.userAgent ?? null,
        },
      });

      throw new AppError(
        423,
        `Account temporarily locked. Try again in ${minutesLeft} minute${minutesLeft !== 1 ? "s" : ""}.`,
        "AUTH_ACCOUNT_LOCKED",
      );
    }

    // ── Constant-time comparison (prevents timing-based enumeration) ─────────
    const hash =
      user?.passwordHash ?? "$2a$12$invalidhashfortimingnormalization";
    const valid = await bcrypt.compare(password, hash);

    if (!user || !valid) {
      // ── Record failed attempt ────────────────────────────────────────────
      if (user) {
        const attempts = user.failedLoginAttempts + 1;
        const shouldLock = attempts >= MAX_FAILED_ATTEMPTS;

        await prisma.user.update({
          where: { id: user.id },
          data: {
            failedLoginAttempts: attempts,
            lockedUntil: shouldLock
              ? new Date(Date.now() + LOCKOUT_DURATION_MIN * 60_000)
              : null,
          },
        });

        await prisma.auditLog.create({
          data: {
            action: shouldLock ? "AUTH_ACCOUNT_LOCKED" : "AUTH_LOGIN_FAILED",
            actor: user.id,
            resourceId: user.id,
            resourceType: "user",
            metadata: { email, attempt: attempts, locked: shouldLock },
            ipAddress: session.ipAddress ?? null,
            userAgent: session.userAgent ?? null,
          },
        });

        if (shouldLock) {
          logger.warn("Account locked after repeated failed logins", {
            userId: user.id,
            email,
            attempts,
          });
        }
      } else {
        // Unknown email — still log for anomaly detection (ISO 27001 A.12.4)
        logger.warn("Failed login attempt for unknown email", {
          email,
          ip: session.ipAddress,
        });
      }

      throw new AppError(
        401,
        "Invalid email or password",
        "AUTH_INVALID_CREDENTIALS",
      );
    }

    // ── Successful login — reset lockout counter ─────────────────────────────
    if (user.failedLoginAttempts > 0 || user.lockedUntil) {
      await prisma.user.update({
        where: { id: user.id },
        data: { failedLoginAttempts: 0, lockedUntil: null },
      });
    }

    // ── Issue token pair ─────────────────────────────────────────────────────
    const accessToken = signAccess(user.id, user.email);
    const refreshToken = randomBytes(40).toString("hex");
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 864e5);

    // Enforce max active sessions per user — evict oldest if over the limit
    const activeSessions = await prisma.refreshToken.findMany({
      where: { userId: user.id, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    if (activeSessions.length >= MAX_ACTIVE_SESSIONS) {
      const toDelete = activeSessions.slice(0, activeSessions.length - MAX_ACTIVE_SESSIONS + 1);
      await prisma.refreshToken.deleteMany({ where: { id: { in: toDelete.map(s => s.id) } } });
    }

    await prisma.refreshToken.create({
      data: {
        token: hashRefreshToken(refreshToken),
        userId: user.id,
        expiresAt,
        ipAddress: session.ipAddress ?? null,
        userAgent: session.userAgent ?? null,
      },
    });

    // ── Audit successful login (ISO 27001 A.9.1.1) ───────────────────────────
    await prisma.auditLog.create({
      data: {
        action: "AUTH_LOGIN_SUCCESS",
        actor: user.id,
        resourceId: user.id,
        resourceType: "user",
        metadata: { email },
        ipAddress: session.ipAddress ?? null,
        userAgent: session.userAgent ?? null,
      },
    });

    logger.info("User logged in", { userId: user.id, ip: session.ipAddress });

    return {
      accessToken,
      refreshToken,
      user: { id: user.id, email: user.email, name: user.name },
    };
  },

  /**
   * Rotate a refresh token (single-use).
   * Returns a new access token + refresh token pair.
   */
  async refresh(refreshToken: string, session: SessionMeta = {}) {
    const record = await prisma.refreshToken.findUnique({
      where: { token: hashRefreshToken(refreshToken) },
      include: { user: true },
    });

    if (!record || record.expiresAt < new Date()) {
      if (record)
        await prisma.refreshToken.delete({ where: { id: record.id } });
      throw new AppError(
        401,
        "Refresh token invalid or expired",
        "AUTH_REFRESH_INVALID",
      );
    }

    // Rotate — delete old, issue new (single-use enforcement)
    await prisma.refreshToken.delete({ where: { id: record.id } });

    const newRefresh = randomBytes(40).toString("hex");
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 864e5);

    await prisma.refreshToken.create({
      data: {
        token: hashRefreshToken(newRefresh),
        userId: record.userId,
        expiresAt,
        ipAddress: session.ipAddress ?? null,
        userAgent: session.userAgent ?? null,
      },
    });

    const accessToken = signAccess(record.user.id, record.user.email);

    return {
      accessToken,
      refreshToken: newRefresh,
      user: {
        id: record.user.id,
        email: record.user.email,
        name: record.user.name,
      },
    };
  },

  /**
   * Invalidate a single refresh token (normal sign-out).
   */
  async logout(refreshToken: string): Promise<void> {
    await prisma.refreshToken.deleteMany({ where: { token: hashRefreshToken(refreshToken) } });
  },

  /**
   * ISO 27001 A.9.4 — Invalidate ALL active sessions for a user.
   * Useful when a user suspects their account has been compromised, or when
   * an admin revokes access.
   */
  async logoutAll(userId: string, session: SessionMeta = {}): Promise<number> {
    const { count } = await prisma.refreshToken.deleteMany({
      where: { userId },
    });

    await prisma.auditLog.create({
      data: {
        action: "AUTH_LOGOUT_ALL",
        actor: userId,
        resourceId: userId,
        resourceType: "user",
        metadata: { sessionsRevoked: count },
        ipAddress: session.ipAddress ?? null,
        userAgent: session.userAgent ?? null,
      },
    });

    logger.info("All sessions revoked", { userId, count });
    return count;
  },

  /**
   * Returns the number of active sessions for a user (useful for the UI).
   */
  async getActiveSessions(userId: string) {
    return prisma.refreshToken.findMany({
      where: { userId, expiresAt: { gt: new Date() } },
      select: {
        id: true,
        ipAddress: true,
        userAgent: true,
        createdAt: true,
        expiresAt: true,
      },
      orderBy: { createdAt: "desc" },
    });
  },
};
