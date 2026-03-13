import { Prisma } from '@prisma/client';
import { prisma } from '../utils/prisma';

interface AuditLogInput {
  action: string;
  actor: string;
  resourceId: string;
  resourceType: string;
  metadata?: Record<string, unknown>;
}

export const auditService = {
  async log(input: AuditLogInput): Promise<void> {
    await prisma.auditLog.create({
      data: {
        action: input.action,
        actor: input.actor,
        resourceId: input.resourceId,
        resourceType: input.resourceType,
        metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
      },
    });
  },

  async query(filters: {
    resourceType?: string;
    action?: string;
    actor?: string;
    from?: Date;
    to?: Date;
    limit?: number;
    offset?: number;
  }) {
    const where: Record<string, unknown> = {};
    if (filters.resourceType) where.resourceType = filters.resourceType;
    if (filters.action) where.action = filters.action;
    if (filters.actor) where.actor = filters.actor;
    if (filters.from || filters.to) {
      where.createdAt = {
        ...(filters.from ? { gte: filters.from } : {}),
        ...(filters.to ? { lte: filters.to } : {}),
      };
    }

    const [items, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: filters.limit ?? 50,
        skip: filters.offset ?? 0,
      }),
      prisma.auditLog.count({ where }),
    ]);

    return { items, total };
  },
};
