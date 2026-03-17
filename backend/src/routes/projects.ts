import { Router } from 'express';
import { z } from 'zod';
import { authenticate, AuthRequest } from '../middleware/auth';
import { prisma } from '../utils/prisma';
import { generateKey, wrapKey, getMasterKey } from '../utils/crypto';
import { AppError } from '../middleware/errorHandler';
import { environmentService } from '../services/environmentService';

export const projectsRouter = Router();
projectsRouter.use(authenticate);

projectsRouter.get('/', async (req: AuthRequest, res, next) => {
  try {
    const memberships = await prisma.projectMember.findMany({
      where: { userId: req.user!.id },
      include: {
        project: {
          include: {
            _count: { select: { secrets: true, members: true } },
          },
        },
      },
    });
    const projects = memberships.map(m => ({
      ...m.project,
      encryptedKey: undefined,
      role: m.role,
      secretCount: m.project._count.secrets,
      memberCount: m.project._count.members,
    }));
    res.json({ projects });
  } catch (err) { next(err); }
});

projectsRouter.post('/', async (req: AuthRequest, res, next) => {
  try {
    const body = z.object({
      name: z.string().min(2),
      slug: z.string().min(2).regex(/^[a-z0-9-]+$/),
    }).parse(req.body);

    const projectKey = generateKey();
    const wrapped = wrapKey(projectKey, getMasterKey());

    const project = await prisma.project.create({
      data: {
        name: body.name,
        slug: body.slug,
        encryptedKey: JSON.stringify(wrapped),
        members: { create: { userId: req.user!.id, role: 'ADMIN' } },
      },
    });

    // Auto-create a default "production" environment for every new project
    await environmentService.getOrCreate(project.id, 'production', '.env');

    res.status(201).json({ project: { ...project, encryptedKey: undefined } });
  } catch (err) { next(err); }
});

projectsRouter.get('/:projectId', async (req: AuthRequest, res, next) => {
  try {
    const member = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId: req.params.projectId, userId: req.user!.id } },
    });
    if (!member) throw new AppError(403, 'Access denied', 'FORBIDDEN');

    const project = await prisma.project.findUnique({
      where: { id: req.params.projectId },
      include: { members: { include: { user: { select: { id: true, email: true, name: true } } } } },
    });
    res.json({ project: { ...project, encryptedKey: undefined } });
  } catch (err) { next(err); }
});

projectsRouter.delete('/:projectId', async (req: AuthRequest, res, next) => {
  try {
    const member = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId: req.params.projectId, userId: req.user!.id } },
    });
    if (!member || member.role !== 'ADMIN') throw new AppError(403, 'Requires ADMIN role', 'FORBIDDEN_ROLE');

    await prisma.project.delete({ where: { id: req.params.projectId } });
    res.json({ ok: true });
  } catch (err) { next(err); }
});
