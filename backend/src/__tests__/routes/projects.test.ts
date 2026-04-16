import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../middleware/auth';

vi.mock('../../utils/prisma', () => ({
  prisma: {
    projectMember: { findUnique: vi.fn(), findMany: vi.fn(), createMany: vi.fn() },
    project: { findMany: vi.fn(), create: vi.fn(), findUnique: vi.fn(), delete: vi.fn() },
    user: { findMany: vi.fn() },
  },
}));

vi.mock('../../utils/crypto', () => ({
  generateKey: vi.fn(() => Buffer.alloc(32)),
  wrapKey: vi.fn(() => ({ iv: 'iv', ciphertext: 'ct', tag: 'tg' })),
  getMasterKey: vi.fn(() => Buffer.alloc(32)),
}));

vi.mock('../../services/environmentService', () => ({
  environmentService: { getOrCreate: vi.fn().mockResolvedValue({}) },
}));

vi.mock('../../utils/serverConfig', () => ({
  isServerAdmin: () => false,
  getAdminEmails: () => [],
  getServerConfig: () => ({ admins: [] }),
}));

import { prisma } from '../../utils/prisma';
import { projectsRouter } from '../../routes/projects';

const mockPrisma = prisma as any;

function makeReq(userId: string, params: Record<string, string> = {}, body = {}): AuthRequest {
  return {
    user: { id: userId, email: 'user@test.com' },
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
  return (projectsRouter as any).stack.find(
    (l: any) => l.route?.path === path && l.route?.methods?.[method],
  )?.route.stack.at(-1).handle;
}

beforeEach(() => vi.clearAllMocks());

describe('GET /projects', () => {
  it('returns projects with role and counts', async () => {
    mockPrisma.projectMember.findMany.mockResolvedValue([
      {
        role: 'ADMIN',
        project: { id: 'p1', name: 'Proj', slug: 'proj', encryptedKey: 'x', _count: { secrets: 3, members: 2 } },
      },
    ]);
    const req = makeReq('u1');
    const res = makeRes();
    const next = vi.fn() as NextFunction;

    const handler = getHandler('get', '/');
    await handler(req, res, next);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        projects: expect.arrayContaining([
          expect.objectContaining({ role: 'ADMIN', secretCount: 3, memberCount: 2 }),
        ]),
      }),
    );
    // encryptedKey must not be exposed
    const [call] = (res.json as any).mock.calls;
    expect(call[0].projects[0].encryptedKey).toBeUndefined();
  });
});

describe('POST /projects', () => {
  it('creates a project and returns it without encryptedKey', async () => {
    const project = { id: 'p1', name: 'My App', slug: 'my-app', encryptedKey: 'wrapped' };
    mockPrisma.project.create.mockResolvedValue(project);
    mockPrisma.user.findMany.mockResolvedValue([]);

    const req = makeReq('u1', {}, { name: 'My App', slug: 'my-app' });
    const res = makeRes();
    const next = vi.fn() as NextFunction;

    const handler = getHandler('post', '/');
    await handler(req, res, next);

    expect(res.status).toHaveBeenCalledWith(201);
    const [call] = (res.json as any).mock.calls;
    expect(call[0].project.encryptedKey).toBeUndefined();
    expect(call[0].project.slug).toBe('my-app');
  });

  it('rejects invalid slug (uppercase letters)', async () => {
    const req = makeReq('u1', {}, { name: 'App', slug: 'My-App' });
    const res = makeRes();
    const next = vi.fn() as NextFunction;

    const handler = getHandler('post', '/');
    await handler(req, res, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'ZodError' }),
    );
  });

  it('rejects name shorter than 2 chars', async () => {
    const req = makeReq('u1', {}, { name: 'A', slug: 'a' });
    const res = makeRes();
    const next = vi.fn() as NextFunction;

    const handler = getHandler('post', '/');
    await handler(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ name: 'ZodError' }));
  });
});

describe('GET /projects/:projectId', () => {
  it('returns project detail to a member', async () => {
    mockPrisma.projectMember.findUnique.mockResolvedValue({ role: 'DEVELOPER' });
    mockPrisma.project.findUnique.mockResolvedValue({
      id: 'p1', name: 'App', slug: 'app', encryptedKey: 'secret', members: [],
    });

    const req = makeReq('u1', { projectId: 'p1' });
    const res = makeRes();
    const next = vi.fn() as NextFunction;

    const handler = getHandler('get', '/:projectId');
    await handler(req, res, next);

    const [call] = (res.json as any).mock.calls;
    expect(call[0].project.id).toBe('p1');
    expect(call[0].project.encryptedKey).toBeUndefined();
  });

  it('denies access to non-members', async () => {
    mockPrisma.projectMember.findUnique.mockResolvedValue(null);

    const req = makeReq('u1', { projectId: 'p1' });
    const res = makeRes();
    const next = vi.fn() as NextFunction;

    const handler = getHandler('get', '/:projectId');
    await handler(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 'FORBIDDEN' }));
  });
});

describe('DELETE /projects/:projectId', () => {
  it('allows ADMIN to delete project', async () => {
    mockPrisma.projectMember.findUnique.mockResolvedValue({ role: 'ADMIN' });
    mockPrisma.project.delete.mockResolvedValue({});

    const req = makeReq('u1', { projectId: 'p1' });
    const res = makeRes();
    const next = vi.fn() as NextFunction;

    const handler = getHandler('delete', '/:projectId');
    await handler(req, res, next);

    expect(res.json).toHaveBeenCalledWith({ ok: true });
    expect(mockPrisma.project.delete).toHaveBeenCalledWith({ where: { id: 'p1' } });
  });

  it('blocks DEVELOPER from deleting project', async () => {
    mockPrisma.projectMember.findUnique.mockResolvedValue({ role: 'DEVELOPER' });

    const req = makeReq('u1', { projectId: 'p1' });
    const res = makeRes();
    const next = vi.fn() as NextFunction;

    const handler = getHandler('delete', '/:projectId');
    await handler(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 'FORBIDDEN_ROLE' }));
    expect(mockPrisma.project.delete).not.toHaveBeenCalled();
  });

  it('blocks non-members from deleting project', async () => {
    mockPrisma.projectMember.findUnique.mockResolvedValue(null);

    const req = makeReq('u1', { projectId: 'p1' });
    const res = makeRes();
    const next = vi.fn() as NextFunction;

    const handler = getHandler('delete', '/:projectId');
    await handler(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 'FORBIDDEN_ROLE' }));
  });
});
