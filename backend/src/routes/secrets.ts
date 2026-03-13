import { Router } from 'express';
import { z } from 'zod';
import { authenticate, AuthRequest } from '../middleware/auth';
import { secretsService } from '../services/secretsService';
import { prisma } from '../utils/prisma';
import { AppError } from '../middleware/errorHandler';

export const secretsRouter = Router();
secretsRouter.use(authenticate);

// GET /api/v1/secrets/:projectId
secretsRouter.get('/:projectId', async (req: AuthRequest, res, next) => {
  try {
    const member = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId: req.params.projectId, userId: req.user!.id } },
    });
    if (!member) throw new AppError(403, 'Access denied');

    const secrets = await secretsService.listForUser(req.params.projectId, req.user!.id);
    res.json({ secrets });
  } catch (err) { next(err); }
});

// GET /api/v1/secrets/:secretId/history
secretsRouter.get('/:secretId/history', async (req: AuthRequest, res, next) => {
  try {
    const secret = await prisma.secret.findUnique({
      where: { id: req.params.secretId },
      select: { projectId: true },
    });
    if (!secret) throw new AppError(404, 'Secret not found');

    const member = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId: secret.projectId, userId: req.user!.id } },
    });
    if (!member) throw new AppError(403, 'Access denied');

    const history = await secretsService.getHistory(req.params.secretId, secret.projectId);
    res.json({ history });
  } catch (err) { next(err); }
});

// PATCH /api/v1/secrets/:secretId/value
secretsRouter.patch('/:secretId/value', async (req: AuthRequest, res, next) => {
  try {
    const { value } = z.object({ value: z.string() }).parse(req.body);
    await secretsService.setPersonalValue(req.params.secretId, value, req.user!.id);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// PATCH /api/v1/secrets/:secretId/shared
secretsRouter.patch('/:secretId/shared', async (req: AuthRequest, res, next) => {
  try {
    const { value } = z.object({ value: z.string() }).parse(req.body);
    await secretsService.setSharedValue(req.params.secretId, value, req.user!.id);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// DELETE /api/v1/secrets/:secretId
secretsRouter.delete('/:secretId', async (req: AuthRequest, res, next) => {
  try {
    await secretsService.delete(req.params.secretId, req.user!.id);
    res.json({ ok: true });
  } catch (err) { next(err); }
});
