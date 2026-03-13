import { Router } from 'express';
import { z } from 'zod';
import { authenticate, AuthRequest } from '../middleware/auth';
import { syncService } from '../services/syncService';
import { prisma } from '../utils/prisma';
import { AppError } from '../middleware/errorHandler';

export const syncRouter = Router();
syncRouter.use(authenticate);

// POST /api/v1/sync/:projectId/push
syncRouter.post('/:projectId/push', async (req: AuthRequest, res, next) => {
  try {
    const body = z.object({
      secrets: z.array(z.object({
        key: z.string().min(1),
        value: z.string(),
        isShared: z.boolean(),
      })).min(1),
    }).parse(req.body);

    const member = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId: req.params.projectId, userId: req.user!.id } },
    });
    if (!member || member.role === 'VIEWER') throw new AppError(403, 'Requires DEVELOPER or ADMIN role');

    const result = await syncService.push(req.params.projectId, body.secrets, req.user!.id);
    res.json({ result });
  } catch (err) { next(err); }
});

// GET /api/v1/sync/:projectId/pull
syncRouter.get('/:projectId/pull', async (req: AuthRequest, res, next) => {
  try {
    const member = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId: req.params.projectId, userId: req.user!.id } },
    });
    if (!member) throw new AppError(403, 'Access denied');

    const secrets = await syncService.pull(req.params.projectId, req.user!.id);
    res.json({ secrets });
  } catch (err) { next(err); }
});
