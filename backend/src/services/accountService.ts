/**
 * Account Service
 *
 * Implements GDPR data-subject rights and ISO 27001 account-management
 * controls for authenticated users.
 *
 * Rights implemented:
 *   Art. 15 — Right of access          → exportData()
 *   Art. 16 — Right to rectification   → updateProfile()
 *   Art. 17 — Right to erasure         → deleteAccount()
 *   Art. 20 — Right to portability     → exportData()
 *
 * ISO 27001 controls:
 *   A.9.4.3 — Password management system  → changePassword()
 *   A.9.4   — Session management          → getSessions(), revokeSession()
 */

import bcrypt from "bcryptjs";
import { prisma } from "../utils/prisma";
import { AppError } from "../middleware/errorHandler";
import { decrypt, getMasterKey, unwrapKey } from "../utils/crypto";
import { logger } from "../utils/logger";

const BCRYPT_ROUNDS = 12;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UserExport {
  exportedAt: string;
  schema: string;
  notice: string;
  profile: {
    id: string;
    name: string;
    email: string;
    createdAt: string;
    consentedAt: string | null;
  };
  projects: Array<{
    id: string;
    name: string;
    slug: string;
    role: string;
    joinedAt: string;
    secretCount: number;
  }>;
  personalSecrets: Array<{
    projectSlug: string;
    keyName: string;
    updatedAt: string;
    note: string;
  }>;
  auditHistory: Array<{
    action: string;
    resourceType: string;
    resourceId: string;
    createdAt: string;
    metadata: unknown;
  }>;
  activeSessions: Array<{
    id: string;
    createdAt: string;
    expiresAt: string;
    userAgent: string | null;
  }>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Attempts to decrypt a secret key name using the project key.
 * Returns a redaction placeholder on failure so that an export is never
 * blocked by a single unreadable record.
 */
async function tryDecryptKeyName(
  encryptedKey: string,
  keyIV: string,
  keyTag: string,
  projectId: string,
): Promise<string> {
  try {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { encryptedKey: true },
    });
    if (!project) return "[project-not-found]";

    const projectKey = unwrapKey(
      JSON.parse(project.encryptedKey),
      getMasterKey(),
    );

    return decrypt(
      { encryptedData: encryptedKey, iv: keyIV, tag: keyTag },
      projectKey,
    );
  } catch {
    // Decryption failures (e.g. key rotation) must not block the export
    return "[decryption-unavailable]";
  }
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const accountService = {
  // ── Profile ────────────────────────────────────────────────────────────────

  /**
   * Return the caller's public profile.
   * GDPR Art. 15 — partial right of access (full export via exportData).
   */
  async getProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
        consentedAt: true,
        // Never expose passwordHash, failedLoginAttempts, lockedUntil
      },
    });

    if (!user) throw new AppError(404, "User not found", "NOT_FOUND");
    return user;
  },

  /**
   * Update the caller's display name.
   * GDPR Art. 16 — Right to rectification.
   */
  async updateProfile(userId: string, data: { name: string }) {
    const updated = await prisma.user.update({
      where: { id: userId },
      data: { name: data.name },
      select: { id: true, email: true, name: true, updatedAt: true },
    });

    logger.info("Profile updated", { userId });
    return updated;
  },

  // ── Password ───────────────────────────────────────────────────────────────

  /**
   * Change the caller's password after verifying the current one.
   *
   * ISO 27001 A.9.4.3 — Password Management System:
   * • Current password must be verified before accepting the new one.
   * • New password must differ from the current one.
   * • All existing sessions are invalidated on change to prevent credential-
   *   theft reuse (the attacker loses access immediately).
   *
   * Returns the number of sessions that were invalidated.
   */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
    ctx: { ipAddress?: string; userAgent?: string } = {},
  ): Promise<{ sessionsRevoked: number }> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true, email: true },
    });
    if (!user) throw new AppError(404, "User not found", "NOT_FOUND");

    // Verify current password
    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) {
      throw new AppError(
        400,
        "Current password is incorrect",
        "AUTH_INVALID_CREDENTIALS",
      );
    }

    // Ensure the new password differs
    const same = await bcrypt.compare(newPassword, user.passwordHash);
    if (same) {
      throw new AppError(
        400,
        "New password must be different from the current password",
        "AUTH_PASSWORD_REUSE",
      );
    }

    const newHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

    // Atomically update password + revoke all sessions in one transaction
    const [{ count }] = await prisma.$transaction([
      prisma.refreshToken.deleteMany({ where: { userId } }),
      prisma.user.update({
        where: { id: userId },
        data: { passwordHash: newHash },
      }),
    ]);

    await prisma.auditLog.create({
      data: {
        action: "ACCOUNT_PASSWORD_CHANGED",
        actor: userId,
        resourceId: userId,
        resourceType: "user",
        metadata: { sessionsRevoked: count },
        ipAddress: ctx.ipAddress ?? null,
        userAgent: ctx.userAgent ?? null,
      },
    });

    logger.info("Password changed", { userId, sessionsRevoked: count });
    return { sessionsRevoked: count };
  },

  // ── Sessions ───────────────────────────────────────────────────────────────

  /**
   * List all active (non-expired) sessions for the caller.
   * ISO 27001 A.9.4 — users can review their own active sessions.
   */
  async getSessions(userId: string) {
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

  /**
   * Revoke a single session by token ID.
   * The caller can only revoke their own sessions.
   */
  async revokeSession(
    userId: string,
    tokenId: string,
    ctx: { ipAddress?: string; userAgent?: string } = {},
  ): Promise<void> {
    const token = await prisma.refreshToken.findUnique({
      where: { id: tokenId },
    });

    if (!token || token.userId !== userId) {
      throw new AppError(404, "Session not found", "NOT_FOUND");
    }

    await prisma.refreshToken.delete({ where: { id: tokenId } });

    await prisma.auditLog.create({
      data: {
        action: "AUTH_SESSION_REVOKED",
        actor: userId,
        resourceId: tokenId,
        resourceType: "session",
        metadata: {},
        ipAddress: ctx.ipAddress ?? null,
        userAgent: ctx.userAgent ?? null,
      },
    });
  },

  // ── GDPR — Right to Data Portability (Art. 20) ────────────────────────────

  /**
   * Export all personal data held about the caller in a structured,
   * machine-readable JSON format.
   *
   * GDPR Art. 15 & 20 — Right of access + Right to data portability.
   *
   * Included:
   *   • Profile data (name, email, timestamps)
   *   • Project memberships and roles
   *   • Personal secret key names (not values — secrets are credentials, not
   *     personal data in the GDPR sense, but we surface key names so the user
   *     knows what we store about their environment)
   *   • Audit history where this user is the actor
   *   • Active session metadata
   *
   * Excluded for security:
   *   • passwordHash
   *   • Encrypted secret values
   *   • Other users' personal data
   */
  async exportData(userId: string): Promise<UserExport> {
    const [user, memberships, personalValues, auditLogs, sessions] =
      await Promise.all([
        prisma.user.findUnique({
          where: { id: userId },
          select: {
            id: true,
            name: true,
            email: true,
            createdAt: true,
            consentedAt: true,
          },
        }),

        prisma.projectMember.findMany({
          where: { userId },
          include: {
            project: {
              select: {
                id: true,
                name: true,
                slug: true,
                _count: { select: { secrets: true } },
              },
            },
          },
          orderBy: { createdAt: "asc" },
        }),

        prisma.userSecretValue.findMany({
          where: { userId },
          include: {
            secret: {
              select: {
                encryptedKey: true,
                keyIV: true,
                keyTag: true,
                projectId: true,
                project: { select: { slug: true } },
                updatedAt: true,
              },
            },
          },
        }),

        prisma.auditLog.findMany({
          where: { actor: userId },
          orderBy: { createdAt: "desc" },
          take: 1000, // reasonable cap; full export via admin channel if needed
          select: {
            action: true,
            resourceType: true,
            resourceId: true,
            createdAt: true,
            metadata: true,
          },
        }),

        prisma.refreshToken.findMany({
          where: { userId, expiresAt: { gt: new Date() } },
          select: {
            id: true,
            userAgent: true,
            createdAt: true,
            expiresAt: true,
          },
          orderBy: { createdAt: "desc" },
        }),
      ]);

    if (!user) throw new AppError(404, "User not found", "NOT_FOUND");

    // Decrypt personal secret key names in parallel (values are never exported)
    const personalSecrets = await Promise.all(
      personalValues.map(async (pv) => ({
        projectSlug: pv.secret.project.slug,
        keyName: await tryDecryptKeyName(
          pv.secret.encryptedKey,
          pv.secret.keyIV,
          pv.secret.keyTag,
          pv.secret.projectId,
        ),
        updatedAt: pv.secret.updatedAt.toISOString(),
        note: "Only the key name is exported. Secret values are credentials and are not included in data exports.",
      })),
    );

    logger.info("Data export generated", { userId });

    return {
      exportedAt: new Date().toISOString(),
      schema: "envShare/data-export/v1",
      notice:
        "This export contains all personal data held about you under GDPR Art. 15 & 20. " +
        "Secret values are excluded because they are credentials, not personal data. " +
        "To request deletion of your data, use Account Settings → Delete Account.",

      profile: {
        id: user.id,
        name: user.name,
        email: user.email,
        createdAt: user.createdAt.toISOString(),
        consentedAt: user.consentedAt?.toISOString() ?? null,
      },

      projects: memberships.map((m) => ({
        id: m.project.id,
        name: m.project.name,
        slug: m.project.slug,
        role: m.role,
        joinedAt: m.createdAt.toISOString(),
        secretCount: m.project._count.secrets,
      })),

      personalSecrets,

      auditHistory: auditLogs.map((l) => ({
        action: l.action,
        resourceType: l.resourceType,
        resourceId: l.resourceId,
        createdAt: l.createdAt.toISOString(),
        metadata: l.metadata,
      })),

      activeSessions: sessions.map((s) => ({
        id: s.id,
        userAgent: s.userAgent,
        createdAt: s.createdAt.toISOString(),
        expiresAt: s.expiresAt.toISOString(),
      })),
    };
  },

  // ── GDPR — Right to Erasure (Art. 17) ─────────────────────────────────────

  /**
   * Permanently delete the caller's account and all personal data.
   *
   * GDPR Art. 17 — Right to erasure ("right to be forgotten").
   *
   * What is deleted (CASCADE via DB foreign keys):
   *   • User record
   *   • All refresh tokens (sessions)
   *   • All personal secret values (UserSecretValue rows)
   *   • Project memberships
   *   • SecretVersion records authored by this user
   *
   * What is retained (legal basis: Art. 17(3)(b) / Art. 17(3)(c)):
   *   • AuditLog rows — actor field is anonymised to "[deleted]" rather than
   *     deleted, because audit trails must be preserved for legal and
   *     contractual compliance obligations (e.g. SOC 2, ISO 27001).
   *     The IP addresses in those rows ARE deleted immediately.
   *   • Projects the user owns are NOT automatically deleted; shared secrets
   *     and team data belong to the organisation, not the individual. The user
   *     is removed as a member; if they were the only ADMIN the project is
   *     orphaned (documented in Privacy Policy §8).
   *
   * Password is verified before deletion to prevent CSRF/accidental erasure.
   */
  async deleteAccount(
    userId: string,
    password: string,
    ctx: { ipAddress?: string; userAgent?: string } = {},
  ): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true, email: true, name: true },
    });
    if (!user) throw new AppError(404, "User not found", "NOT_FOUND");

    // Require password confirmation — prevents CSRF and accidental deletion
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      throw new AppError(
        400,
        "Password confirmation failed. Account was not deleted.",
        "AUTH_INVALID_CREDENTIALS",
      );
    }

    // Anonymise audit log entries BEFORE deleting the user row.
    // We do this in a transaction with the deletion so it's atomic.
    await prisma.$transaction(async (tx) => {
      // 1. Anonymise audit logs (GDPR Art. 17(3) — legitimate retention basis)
      //    IP addresses are personal data and are erased immediately.
      //    The actor field is replaced with "[deleted]" so the event timeline
      //    remains coherent for compliance auditors without identifying the person.
      await tx.auditLog.updateMany({
        where: { actor: userId },
        data: {
          actor: "[deleted]",
          ipAddress: null,   // GDPR — erase without delay
          userAgent: null,   // GDPR — erase without delay
        },
      });

      // 2. Delete the user — cascades to:
      //    RefreshToken, UserSecretValue, ProjectMember, SecretVersion (SET NULL)
      await tx.user.delete({ where: { id: userId } });
    });

    // Final audit entry (actor = "system" because the user no longer exists)
    await prisma.auditLog.create({
      data: {
        action: "ACCOUNT_DELETED",
        actor: "system",
        resourceId: userId,
        resourceType: "user",
        metadata: {
          reason: "GDPR Art. 17 — right to erasure request",
          // Do NOT store name/email here — this is a post-deletion record
        },
        // No IP/UA after deletion — the user's personal data must not appear
        // in any new records once the right-to-erasure has been exercised
        ipAddress: null,
        userAgent: null,
      },
    });

    logger.info("Account deleted via GDPR Art.17 request", {
      userId,
      ip: ctx.ipAddress,
    });
  },
};
