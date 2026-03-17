import { Prisma } from "@prisma/client";
import { prisma } from "../utils/prisma";

interface AuditLogInput {
  action: string;
  actor: string;
  resourceId: string;
  resourceType: string;
  metadata?: Record<string, unknown>;
  // ISO 27001 A.12.4.1 — source context captured by requestContextMiddleware
  ipAddress?: string;
  userAgent?: string;
}

export const auditService = {
  /**
   * Persist a single audit event.
   *
   * ISO 27001 A.12.4.1 — Event Logging.
   * Every security-relevant action (secret read/write/delete, auth events,
   * member changes) must be recorded with at minimum: who, what, when, and
   * from where (IP + User-Agent).
   *
   * IP addresses are personal data under GDPR Recital 30 and are collected
   * under the legitimate-interests basis (Art. 6(1)(f)) solely for security
   * monitoring. They are purged after AUDIT_LOG_RETENTION_DAYS (default 365).
   */
  async log(input: AuditLogInput): Promise<void> {
    await prisma.auditLog.create({
      data: {
        action: input.action,
        actor: input.actor,
        resourceId: input.resourceId,
        resourceType: input.resourceType,
        metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
      },
    });
  },

  /**
   * Query audit logs with optional filters.
   *
   * ISO 27001 A.12.4 — audit logs must be queryable by administrators for
   * incident response and compliance reporting.
   *
   * Note: access to this endpoint is restricted to project ADMINs or
   * organisation-level admins — see routes/audit.ts.
   */
  async query(filters: {
    resourceType?: string;
    action?: string;
    actor?: string;
    resourceId?: string;
    from?: Date;
    to?: Date;
    limit?: number;
    offset?: number;
  }) {
    const where: Prisma.AuditLogWhereInput = {};

    if (filters.resourceType) where.resourceType = filters.resourceType;
    if (filters.action) where.action = filters.action;
    if (filters.actor) where.actor = filters.actor;
    if (filters.resourceId) where.resourceId = filters.resourceId;

    if (filters.from || filters.to) {
      where.createdAt = {
        ...(filters.from ? { gte: filters.from } : {}),
        ...(filters.to ? { lte: filters.to } : {}),
      };
    }

    const [items, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: filters.limit ?? 50,
        skip: filters.offset ?? 0,
        // Never return raw IP/UserAgent in list responses — they are visible
        // only in detail views to authorised admins (GDPR data minimisation).
        select: {
          id: true,
          action: true,
          actor: true,
          resourceId: true,
          resourceType: true,
          metadata: true,
          createdAt: true,
          // Omit ipAddress / userAgent from list to minimise personal data exposure
        },
      }),
      prisma.auditLog.count({ where }),
    ]);

    return { items, total };
  },
};
