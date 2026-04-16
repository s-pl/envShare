import { Router } from 'express';
import { z } from 'zod';
import { authenticate, AuthRequest } from '../middleware/auth';
import { prisma } from '../utils/prisma';
import { AppError } from '../middleware/errorHandler';
import { isServerAdmin } from '../utils/serverConfig';

export const membersRouter = Router();
membersRouter.use(authenticate);

// POST /api/v1/projects/:projectId/members — add a user by email
membersRouter.post('/:projectId/members', async (req: AuthRequest, res, next) => {
  try {
    const body = z.object({
      email: z.string().email(),
      role: z.enum(['ADMIN', 'DEVELOPER', 'VIEWER']).default('DEVELOPER'),
    }).parse(req.body);

    // Only admins can add members
    const requester = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId: req.params.projectId, userId: req.user!.id } },
    });
    if (!requester || requester.role === 'VIEWER' || requester.role === 'DEVELOPER') {
      throw new AppError(403, 'Only project ADMINs can add members', 'FORBIDDEN_ROLE');
    }

    const target = await prisma.user.findUnique({ where: { email: body.email } });
    if (!target) throw new AppError(404, `No user found with email: ${body.email}`, 'NOT_FOUND');

    const existing = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId: req.params.projectId, userId: target.id } },
    });
    if (existing) throw new AppError(409, `${body.email} is already a member`, 'MEMBER_ALREADY_EXISTS');

    // Server-admins (server.config.json) are always enrolled as ADMIN,
    // regardless of the role requested.
    const effectiveRole = isServerAdmin(target.email) ? 'ADMIN' : body.role;

    const member = await prisma.projectMember.create({
      data: { projectId: req.params.projectId, userId: target.id, role: effectiveRole },
      include: { user: { select: { email: true, name: true } } },
    });

    res.status(201).json({ member });
  } catch (err) { next(err); }
});

// GET /api/v1/projects/:projectId/members — list members
membersRouter.get('/:projectId/members', async (req: AuthRequest, res, next) => {
  try {
    const access = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId: req.params.projectId, userId: req.user!.id } },
    });
    if (!access) throw new AppError(403, 'Access denied', 'FORBIDDEN');

    const members = await prisma.projectMember.findMany({
      where: { projectId: req.params.projectId },
      include: { user: { select: { id: true, email: true, name: true } } },
    });

    res.json({ members });
  } catch (err) { next(err); }
});

// PATCH /api/v1/projects/:projectId/members/:userId — change role
membersRouter.patch('/:projectId/members/:userId', async (req: AuthRequest, res, next) => {
  try {
    const body = z.object({
      role: z.enum(['ADMIN', 'DEVELOPER', 'VIEWER']),
    }).parse(req.body);

    const requester = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId: req.params.projectId, userId: req.user!.id } },
    });
    if (!requester || requester.role !== 'ADMIN') {
      throw new AppError(403, 'Only project ADMINs can change roles', 'FORBIDDEN_ROLE');
    }

    if (req.params.userId === req.user!.id) {
      throw new AppError(400, 'You cannot change your own role', 'SELF_ROLE_CHANGE');
    }

    // Server-admins cannot be downgraded — their ADMIN status is enforced by
    // server.config.json and must stay in sync across every project.
    const targetUser = await prisma.user.findUnique({
      where: { id: req.params.userId },
      select: { email: true },
    });
    if (targetUser && isServerAdmin(targetUser.email) && body.role !== 'ADMIN') {
      throw new AppError(
        400,
        `${targetUser.email} is a server admin and must remain ADMIN.`,
        'SERVER_ADMIN_IMMUTABLE',
      );
    }

    const member = await prisma.projectMember.update({
      where: { projectId_userId: { projectId: req.params.projectId, userId: req.params.userId } },
      data: { role: body.role },
      include: { user: { select: { email: true, name: true } } },
    });

    res.json({ member });
  } catch (err) { next(err); }
});

// DELETE /api/v1/projects/:projectId/members/:userId — remove a member
membersRouter.delete('/:projectId/members/:userId', async (req: AuthRequest, res, next) => {
  try {
    const requester = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId: req.params.projectId, userId: req.user!.id } },
    });
    if (!requester || requester.role !== 'ADMIN') {
      throw new AppError(403, 'Only project ADMINs can remove members', 'FORBIDDEN_ROLE');
    }

    const target = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId: req.params.projectId, userId: req.params.userId } },
      include: { user: { select: { email: true } } },
    });

    // Server-admins are pinned to every project by server.config.json — block
    // removal so admins-in-all-projects cannot be circumvented per-project.
    if (target && isServerAdmin(target.user.email)) {
      throw new AppError(
        400,
        `${target.user.email} is a server admin and cannot be removed from a project.`,
        'SERVER_ADMIN_IMMUTABLE',
      );
    }

    // Prevent orphaning the project by removing the last ADMIN
    if (target?.role === 'ADMIN') {
      const adminCount = await prisma.projectMember.count({
        where: { projectId: req.params.projectId, role: 'ADMIN' },
      });
      if (adminCount <= 1) {
        throw new AppError(400, 'Cannot remove the last admin. Promote another member first.', 'LAST_ADMIN');
      }
    }

    await prisma.projectMember.delete({
      where: { projectId_userId: { projectId: req.params.projectId, userId: req.params.userId } },
    });

    res.json({ message: 'Member removed' });
  } catch (err) { next(err); }
});
