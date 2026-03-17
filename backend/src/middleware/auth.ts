import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../utils/prisma';

export interface AuthRequest extends Request {
  user?: { id: string; email: string };
}

export function authenticate(req: AuthRequest, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid Authorization header', code: 'AUTH_TOKEN_MISSING' });
    return;
  }

  const token = header.slice(7);
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET not configured');

  try {
    const payload = jwt.verify(token, secret) as { sub: string; email: string };
    req.user = { id: payload.sub, email: payload.email };
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token', code: 'AUTH_TOKEN_INVALID' });
  }
}

/**
 * Middleware to verify that the authenticated user has access to a project.
 * Attaches req.projectMember for downstream role checks.
 */
export function requireProjectAccess(minRole: 'VIEWER' | 'DEVELOPER' | 'ADMIN' = 'VIEWER') {
  const roleWeight: Record<string, number> = { VIEWER: 0, DEVELOPER: 1, ADMIN: 2 };

  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    const projectId = req.params.projectId || req.body.projectId;
    if (!projectId) {
      res.status(400).json({ error: 'projectId is required' });
      return;
    }

    const member = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: req.user!.id } },
    });

    if (!member) {
      res.status(403).json({ error: 'Access denied to this project', code: 'FORBIDDEN' });
      return;
    }

    if (roleWeight[member.role] < roleWeight[minRole]) {
      res.status(403).json({ error: `Requires ${minRole} role or higher`, code: 'FORBIDDEN_ROLE' });
      return;
    }

    (req as any).projectMember = member;
    next();
  };
}
