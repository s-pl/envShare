import { Router } from 'express';
import { z } from 'zod';
import { authenticate, AuthRequest } from '../middleware/auth';
import { syncService } from '../services/syncService';
import { prisma } from '../utils/prisma';
import { AppError } from '../middleware/errorHandler';
import { environmentService } from '../services/environmentService';

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
      // Optional: which file/env these secrets belong to
      filePath: z.string().optional(),
      environmentName: z.string().optional(),
    }).parse(req.body);

    const member = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId: req.params.projectId, userId: req.user!.id } },
    });
    if (!member || member.role === 'VIEWER') throw new AppError(403, 'Requires DEVELOPER or ADMIN role', 'FORBIDDEN_ROLE');

    // Resolve environment if filePath is provided
    let environmentId: string | undefined;
    if (body.filePath) {
      const name = body.environmentName || body.filePath;
      environmentId = await environmentService.getOrCreate(req.params.projectId, name, body.filePath);
    }

    const result = await syncService.push(req.params.projectId, body.secrets, req.user!.id, environmentId);
    res.json({ result });
  } catch (err) { next(err); }
});

// GET /api/v1/sync/:projectId/pull[?env=environmentName]
syncRouter.get('/:projectId/pull', async (req: AuthRequest, res, next) => {
  try {
    const member = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId: req.params.projectId, userId: req.user!.id } },
    });
    if (!member) throw new AppError(403, 'Access denied', 'FORBIDDEN');

    const envFilter = typeof req.query.env === 'string' ? req.query.env : undefined;
    const secrets = await syncService.pull(req.params.projectId, req.user!.id, envFilter);
    res.json({ secrets });
  } catch (err) { next(err); }
});
