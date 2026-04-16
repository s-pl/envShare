import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../middleware/auth';

vi.mock('../../utils/prisma', () => ({
  prisma: {
    projectMember: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    user: { findUnique: vi.fn() },
  },
}));

vi.mock('../../utils/serverConfig', () => ({
  isServerAdmin: vi.fn(() => false),
  getAdminEmails: () => [],
}));

import { prisma } from '../../utils/prisma';
import { isServerAdmin } from '../../utils/serverConfig';
import { membersRouter } from '../../routes/members';

const mockPrisma = prisma as any;
const mockIsServerAdmin = isServerAdmin as ReturnType<typeof vi.fn>;

function makeReq(userId: string, params: Record<string, string> = {}, body = {}): AuthRequest {
  return {
    user: { id: userId, email: 'admin@test.com' },
    params,
    body,
    headers: {},
  } as unknown as AuthRequest;
}

function makeRes(): Response {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;
}

function getHandler(method: string, path: string) {
  return (membersRouter as any).stack.find(
    (l: any) => l.route?.path === path && l.route?.methods?.[method],
  )?.route.stack.at(-1).handle;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockIsServerAdmin.mockReturnValue(false);
});

describe('POST /:projectId/members', () => {
  it('allows ADMIN to add a member', async () => {
    mockPrisma.projectMember.findUnique.mockResolvedValueOnce({ role: 'ADMIN' }); // requester
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'u2', email: 'dev@test.com' });
    mockPrisma.projectMember.findUnique.mockResolvedValueOnce(null); // not already member
    const created = { userId: 'u2', role: 'DEVELOPER', user: { email: 'dev@test.com', name: 'Dev' } };
    mockPrisma.projectMember.create.mockResolvedValue(created);

    const req = makeReq('u1', { projectId: 'p1' }, { email: 'dev@test.com', role: 'DEVELOPER' });
    const res = makeRes();
    const next = vi.fn() as NextFunction;

    const handler = getHandler('post', '/:projectId/members');
    await handler(req, res, next);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ member: created });
  });

  it('blocks DEVELOPER from adding members', async () => {
    mockPrisma.projectMember.findUnique.mockResolvedValue({ role: 'DEVELOPER' });

    const req = makeReq('u1', { projectId: 'p1' }, { email: 'other@test.com' });
    const res = makeRes();
    const next = vi.fn() as NextFunction;

    const handler = getHandler('post', '/:projectId/members');
    await handler(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 'FORBIDDEN_ROLE' }));
  });

  it('throws NOT_FOUND when user email does not exist', async () => {
    mockPrisma.projectMember.findUnique.mockResolvedValue({ role: 'ADMIN' });
    mockPrisma.user.findUnique.mockResolvedValue(null);

    const req = makeReq('u1', { projectId: 'p1' }, { email: 'nobody@test.com' });
    const res = makeRes();
    const next = vi.fn() as NextFunction;

    const handler = getHandler('post', '/:projectId/members');
    await handler(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 'NOT_FOUND' }));
  });

  it('throws MEMBER_ALREADY_EXISTS for duplicate add', async () => {
    mockPrisma.projectMember.findUnique
      .mockResolvedValueOnce({ role: 'ADMIN' }) // requester
      .mockResolvedValueOnce({ userId: 'u2' }); // existing member
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'u2', email: 'dev@test.com' });

    const req = makeReq('u1', { projectId: 'p1' }, { email: 'dev@test.com' });
    const res = makeRes();
    const next = vi.fn() as NextFunction;

    const handler = getHandler('post', '/:projectId/members');
    await handler(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 'MEMBER_ALREADY_EXISTS' }));
  });

  it('forces ADMIN role for server-admins regardless of requested role', async () => {
    mockIsServerAdmin.mockReturnValue(true);
    mockPrisma.projectMember.findUnique
      .mockResolvedValueOnce({ role: 'ADMIN' })
      .mockResolvedValueOnce(null);
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'u2', email: 'sa@test.com' });
    mockPrisma.projectMember.create.mockResolvedValue({ role: 'ADMIN', user: { email: 'sa@test.com', name: 'SA' } });

    const req = makeReq('u1', { projectId: 'p1' }, { email: 'sa@test.com', role: 'VIEWER' });
    const res = makeRes();
    const next = vi.fn() as NextFunction;

    const handler = getHandler('post', '/:projectId/members');
    await handler(req, res, next);

    expect(mockPrisma.projectMember.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ role: 'ADMIN' }) }),
    );
  });
});

describe('GET /:projectId/members', () => {
  it('returns member list to project members', async () => {
    mockPrisma.projectMember.findUnique.mockResolvedValue({ role: 'VIEWER' });
    mockPrisma.projectMember.findMany.mockResolvedValue([
      { role: 'ADMIN', user: { id: 'u1', email: 'admin@test.com', name: 'Admin' } },
    ]);

    const req = makeReq('u1', { projectId: 'p1' });
    const res = makeRes();
    const next = vi.fn() as NextFunction;

    const handler = getHandler('get', '/:projectId/members');
    await handler(req, res, next);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ members: expect.any(Array) }),
    );
  });

  it('denies non-members', async () => {
    mockPrisma.projectMember.findUnique.mockResolvedValue(null);

    const req = makeReq('u1', { projectId: 'p1' });
    const res = makeRes();
    const next = vi.fn() as NextFunction;

    const handler = getHandler('get', '/:projectId/members');
    await handler(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 'FORBIDDEN' }));
  });
});

describe('PATCH /:projectId/members/:userId', () => {
  it('allows ADMIN to change a member role', async () => {
    mockPrisma.projectMember.findUnique.mockResolvedValue({ role: 'ADMIN' });
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'u2', email: 'dev@test.com' });
    mockPrisma.projectMember.update.mockResolvedValue({
      role: 'VIEWER',
      user: { email: 'dev@test.com', name: 'Dev' },
    });

    const req = makeReq('u1', { projectId: 'p1', userId: 'u2' }, { role: 'VIEWER' });
    const res = makeRes();
    const next = vi.fn() as NextFunction;

    const handler = getHandler('patch', '/:projectId/members/:userId');
    await handler(req, res, next);

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ member: expect.any(Object) }));
  });

  it('prevents self role change', async () => {
    mockPrisma.projectMember.findUnique.mockResolvedValue({ role: 'ADMIN' });

    const req = makeReq('u1', { projectId: 'p1', userId: 'u1' }, { role: 'VIEWER' });
    const res = makeRes();
    const next = vi.fn() as NextFunction;

    const handler = getHandler('patch', '/:projectId/members/:userId');
    await handler(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 'SELF_ROLE_CHANGE' }));
  });

  it('prevents downgrading a server-admin', async () => {
    mockIsServerAdmin.mockReturnValue(true);
    mockPrisma.projectMember.findUnique.mockResolvedValue({ role: 'ADMIN' });
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'u2', email: 'sa@test.com' });

    const req = makeReq('u1', { projectId: 'p1', userId: 'u2' }, { role: 'VIEWER' });
    const res = makeRes();
    const next = vi.fn() as NextFunction;

    const handler = getHandler('patch', '/:projectId/members/:userId');
    await handler(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 'SERVER_ADMIN_IMMUTABLE' }));
  });

  it('blocks non-ADMIN from changing roles', async () => {
    mockPrisma.projectMember.findUnique.mockResolvedValue({ role: 'DEVELOPER' });

    const req = makeReq('u1', { projectId: 'p1', userId: 'u2' }, { role: 'VIEWER' });
    const res = makeRes();
    const next = vi.fn() as NextFunction;

    const handler = getHandler('patch', '/:projectId/members/:userId');
    await handler(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 'FORBIDDEN_ROLE' }));
  });
});

describe('DELETE /:projectId/members/:userId', () => {
  it('allows ADMIN to remove a DEVELOPER', async () => {
    mockPrisma.projectMember.findUnique
      .mockResolvedValueOnce({ role: 'ADMIN' }) // requester
      .mockResolvedValueOnce({ role: 'DEVELOPER', user: { email: 'dev@test.com' } }); // target
    mockPrisma.projectMember.delete.mockResolvedValue({});

    const req = makeReq('u1', { projectId: 'p1', userId: 'u2' });
    const res = makeRes();
    const next = vi.fn() as NextFunction;

    const handler = getHandler('delete', '/:projectId/members/:userId');
    await handler(req, res, next);

    expect(res.json).toHaveBeenCalledWith({ message: 'Member removed' });
  });

  it('prevents removing the last ADMIN', async () => {
    mockPrisma.projectMember.findUnique
      .mockResolvedValueOnce({ role: 'ADMIN' }) // requester
      .mockResolvedValueOnce({ role: 'ADMIN', user: { email: 'other@test.com' } }); // target is also admin
    mockPrisma.projectMember.count.mockResolvedValue(1);

    const req = makeReq('u1', { projectId: 'p1', userId: 'u2' });
    const res = makeRes();
    const next = vi.fn() as NextFunction;

    const handler = getHandler('delete', '/:projectId/members/:userId');
    await handler(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 'LAST_ADMIN' }));
  });

  it('prevents removing a server-admin', async () => {
    mockIsServerAdmin.mockReturnValue(true);
    mockPrisma.projectMember.findUnique
      .mockResolvedValueOnce({ role: 'ADMIN' })
      .mockResolvedValueOnce({ role: 'ADMIN', user: { email: 'sa@test.com' } });

    const req = makeReq('u1', { projectId: 'p1', userId: 'u2' });
    const res = makeRes();
    const next = vi.fn() as NextFunction;

    const handler = getHandler('delete', '/:projectId/members/:userId');
    await handler(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 'SERVER_ADMIN_IMMUTABLE' }));
  });

  it('blocks DEVELOPER from removing members', async () => {
    mockPrisma.projectMember.findUnique.mockResolvedValue({ role: 'DEVELOPER' });

    const req = makeReq('u1', { projectId: 'p1', userId: 'u2' });
    const res = makeRes();
    const next = vi.fn() as NextFunction;

    const handler = getHandler('delete', '/:projectId/members/:userId');
    await handler(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 'FORBIDDEN_ROLE' }));
  });
});
