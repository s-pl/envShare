import { Router } from 'express';
import { z } from 'zod';
import { authenticate, AuthRequest } from '../middleware/auth';
import { secretsService } from '../services/secretsService';
import { prisma } from '../utils/prisma';
import { AppError } from '../middleware/errorHandler';
import { ROLE_WEIGHT } from '../utils/roles';

export const secretsRouter = Router();
secretsRouter.use(authenticate);

const SECRET_VALUE_MAX = 100_000;
const HISTORY_LIMIT_MAX = 200;

/** Look up a secret and verify the caller is a project member with at least `minRole`. */
async function requireSecretAccess(
  secretId: string,
  userId: string,
  minRole: 'VIEWER' | 'DEVELOPER' | 'ADMIN' = 'VIEWER',
) {
  const secret = await prisma.secret.findUnique({
    where: { id: secretId },
    select: {
      projectId: true,
      project: {
        select: {
          members: {
            where: { userId },
            select: { role: true },
            take: 1,
          },
        },
      },
    },
  });
  if (!secret) throw new AppError(404, 'Secret not found', 'NOT_FOUND');

  const member = secret.project.members[0];
  if (!member) throw new AppError(403, 'Access denied', 'FORBIDDEN');

  if (ROLE_WEIGHT[member.role] < ROLE_WEIGHT[minRole]) {
    throw new AppError(403, `Requires ${minRole} role or higher`, 'FORBIDDEN_ROLE');
  }

  return { projectId: secret.projectId };
}

// GET /api/v1/secrets/:projectId
secretsRouter.get('/:projectId', async (req: AuthRequest, res, next) => {
  try {
    const member = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId: req.params.projectId, userId: req.user!.id } },
    });
    if (!member) throw new AppError(403, 'Access denied', 'FORBIDDEN');

    const secrets = await secretsService.listForUser(req.params.projectId, req.user!.id);
    res.json({ secrets });
  } catch (err) { next(err); }
});

// GET /api/v1/secrets/:secretId/history
secretsRouter.get('/:secretId/history', async (req: AuthRequest, res, next) => {
  try {
    const secret = await requireSecretAccess(req.params.secretId, req.user!.id);
    const rawLimit = parseInt(req.query.limit as string, 10);
    const limit = Number.isFinite(rawLimit) && rawLimit > 0
      ? Math.min(rawLimit, HISTORY_LIMIT_MAX)
      : HISTORY_LIMIT_MAX;
    const history = await secretsService.getHistory(req.params.secretId, secret.projectId, limit);
    res.json({ history });
  } catch (err) { next(err); }
});

// PATCH /api/v1/secrets/:secretId/value
secretsRouter.patch('/:secretId/value', async (req: AuthRequest, res, next) => {
  try {
    await requireSecretAccess(req.params.secretId, req.user!.id, 'DEVELOPER');
    const { value } = z.object({ value: z.string().max(SECRET_VALUE_MAX) }).parse(req.body);
    await secretsService.setPersonalValue(req.params.secretId, value, req.user!.id);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// PATCH /api/v1/secrets/:secretId/shared
secretsRouter.patch('/:secretId/shared', async (req: AuthRequest, res, next) => {
  try {
    await requireSecretAccess(req.params.secretId, req.user!.id, 'DEVELOPER');
    const { value } = z.object({ value: z.string().max(SECRET_VALUE_MAX) }).parse(req.body);
    await secretsService.setSharedValue(req.params.secretId, value, req.user!.id);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// DELETE /api/v1/secrets/:secretId
secretsRouter.delete('/:secretId', async (req: AuthRequest, res, next) => {
  try {
    await requireSecretAccess(req.params.secretId, req.user!.id, 'ADMIN');
    await secretsService.delete(req.params.secretId, req.user!.id);
    res.json({ ok: true });
  } catch (err) { next(err); }
});
