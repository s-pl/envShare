import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../../middleware/auth';

// Mock prisma
vi.mock('../../utils/prisma', () => ({
  prisma: {
    secret: { findUnique: vi.fn() },
    projectMember: { findUnique: vi.fn() },
  },
}));

// Mock secretsService
vi.mock('../../services/secretsService', () => ({
  secretsService: {
    setPersonalValue: vi.fn().mockResolvedValue(undefined),
    setSharedValue: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    getHistory: vi.fn().mockResolvedValue([]),
  },
}));

import { prisma } from '../../utils/prisma';
import { secretsRouter } from '../../routes/secrets';

const mockPrisma = prisma as any;

function makeReqRes(userId: string, secretId: string, body = {}) {
  const req = {
    user: { id: userId, email: 'test@test.com' },
    params: { secretId },
    body,
    headers: {},
  } as unknown as AuthRequest;
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;
  const next = vi.fn() as NextFunction;
  return { req, res, next };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.secret.findUnique.mockResolvedValue({ id: 's1', projectId: 'p1' });
});

describe('RBAC: PATCH /:secretId/value', () => {
  it('allows DEVELOPER to set personal value', async () => {
    mockPrisma.projectMember.findUnique.mockResolvedValue({ role: 'DEVELOPER' });
    const { req, res, next } = makeReqRes('u1', 's1', { value: 'test' });

    // find the route handler for PATCH /:secretId/value
    const layer = (secretsRouter as any).stack.find(
      (l: any) => l.route?.path === '/:secretId/value' && l.route?.methods?.patch,
    );
    await layer.route.stack[0].handle(req, res, next);
    expect(next).not.toHaveBeenCalledWith(expect.objectContaining({ code: 'FORBIDDEN_ROLE' }));
  });

  it('blocks VIEWER from setting personal value', async () => {
    mockPrisma.projectMember.findUnique.mockResolvedValue({ role: 'VIEWER' });
    const { req, res, next } = makeReqRes('u1', 's1', { value: 'test' });

    const layer = (secretsRouter as any).stack.find(
      (l: any) => l.route?.path === '/:secretId/value' && l.route?.methods?.patch,
    );
    await layer.route.stack[0].handle(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 'FORBIDDEN_ROLE' }));
  });
});

describe('RBAC: DELETE /:secretId', () => {
  it('allows ADMIN to delete a secret', async () => {
    mockPrisma.projectMember.findUnique.mockResolvedValue({ role: 'ADMIN' });
    const { req, res, next } = makeReqRes('u1', 's1');

    const layer = (secretsRouter as any).stack.find(
      (l: any) => l.route?.path === '/:secretId' && l.route?.methods?.delete,
    );
    await layer.route.stack[0].handle(req, res, next);
    expect(next).not.toHaveBeenCalledWith(expect.objectContaining({ code: 'FORBIDDEN_ROLE' }));
  });

  it('blocks DEVELOPER from deleting a secret', async () => {
    mockPrisma.projectMember.findUnique.mockResolvedValue({ role: 'DEVELOPER' });
    const { req, res, next } = makeReqRes('u1', 's1');

    const layer = (secretsRouter as any).stack.find(
      (l: any) => l.route?.path === '/:secretId' && l.route?.methods?.delete,
    );
    await layer.route.stack[0].handle(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 'FORBIDDEN_ROLE' }));
  });

  it('blocks VIEWER from deleting a secret', async () => {
    mockPrisma.projectMember.findUnique.mockResolvedValue({ role: 'VIEWER' });
    const { req, res, next } = makeReqRes('u1', 's1');

    const layer = (secretsRouter as any).stack.find(
      (l: any) => l.route?.path === '/:secretId' && l.route?.methods?.delete,
    );
    await layer.route.stack[0].handle(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 'FORBIDDEN_ROLE' }));
  });
});

describe('RBAC: non-member', () => {
  it('returns FORBIDDEN for non-member access', async () => {
    mockPrisma.projectMember.findUnique.mockResolvedValue(null);
    const { req, res, next } = makeReqRes('u1', 's1', { value: 'v' });

    const layer = (secretsRouter as any).stack.find(
      (l: any) => l.route?.path === '/:secretId/value' && l.route?.methods?.patch,
    );
    await layer.route.stack[0].handle(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 'FORBIDDEN' }));
  });
});
