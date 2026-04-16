import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';

vi.mock('../../services/authService', () => ({
  authService: {
    register: vi.fn(),
    login: vi.fn(),
    refresh: vi.fn(),
    logout: vi.fn(),
  },
}));

import { authService } from '../../services/authService';
import { authRouter } from '../../routes/auth';

const mockAuth = authService as Record<string, ReturnType<typeof vi.fn>>;

function makeReq(body = {}, cookies = {}, headers = {}): Request {
  return {
    body,
    cookies,
    headers,
    ctx: { ipAddress: '127.0.0.1', userAgent: 'test-agent' },
  } as unknown as Request;
}

function makeRes(): Response {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    cookie: vi.fn().mockReturnThis(),
    clearCookie: vi.fn().mockReturnThis(),
  } as unknown as Response;
  return res;
}

function getHandler(method: string, path: string) {
  return (authRouter as any).stack.find(
    (l: any) => l.route?.path === path && l.route?.methods?.[method],
  )?.route.stack.at(-1).handle;
}

beforeEach(() => vi.clearAllMocks());

describe('POST /register', () => {
  it('creates a user and returns 201', async () => {
    const user = { id: 'u1', email: 'a@b.com', name: 'a', createdAt: new Date() };
    mockAuth.register.mockResolvedValue(user);

    const req = makeReq({ email: 'a@b.com', password: 'strongpassword1' });
    const res = makeRes();
    const next = vi.fn() as NextFunction;

    const handler = getHandler('post', '/register');
    await handler(req, res, next);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ user });
  });

  it('rejects invalid email', async () => {
    const req = makeReq({ email: 'not-an-email', password: 'strongpassword1' });
    const res = makeRes();
    const next = vi.fn() as NextFunction;

    const handler = getHandler('post', '/register');
    await handler(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ name: 'ZodError' }));
    expect(mockAuth.register).not.toHaveBeenCalled();
  });

  it('rejects password shorter than 12 chars', async () => {
    const req = makeReq({ email: 'a@b.com', password: 'short' });
    const res = makeRes();
    const next = vi.fn() as NextFunction;

    const handler = getHandler('post', '/register');
    await handler(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ name: 'ZodError' }));
  });

  it('passes service errors to next', async () => {
    mockAuth.register.mockRejectedValue({ code: 'AUTH_EMAIL_TAKEN' });

    const req = makeReq({ email: 'a@b.com', password: 'strongpassword1' });
    const res = makeRes();
    const next = vi.fn() as NextFunction;

    const handler = getHandler('post', '/register');
    await handler(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 'AUTH_EMAIL_TAKEN' }));
  });
});

describe('POST /login', () => {
  const tokens = {
    accessToken: 'at',
    refreshToken: 'rt',
    user: { id: 'u1', email: 'a@b.com', name: 'Alice' },
  };

  it('sets cookie and returns accessToken for browser clients', async () => {
    mockAuth.login.mockResolvedValue(tokens);

    const req = makeReq({ email: 'a@b.com', password: 'correct' });
    const res = makeRes();
    const next = vi.fn() as NextFunction;

    const handler = getHandler('post', '/login');
    await handler(req, res, next);

    expect(res.cookie).toHaveBeenCalledWith('refresh_token', 'rt', expect.any(Object));
    const [call] = (res.json as any).mock.calls;
    expect(call[0].accessToken).toBe('at');
    expect(call[0].refreshToken).toBeUndefined(); // not returned to browser
  });

  it('returns refreshToken in body for CLI clients', async () => {
    mockAuth.login.mockResolvedValue(tokens);

    const req = makeReq({ email: 'a@b.com', password: 'correct' }, {}, { 'x-client': 'cli' });
    const res = makeRes();
    const next = vi.fn() as NextFunction;

    const handler = getHandler('post', '/login');
    await handler(req, res, next);

    const [call] = (res.json as any).mock.calls;
    expect(call[0].refreshToken).toBe('rt');
  });

  it('rejects missing email', async () => {
    const req = makeReq({ password: 'strongpassword1' });
    const res = makeRes();
    const next = vi.fn() as NextFunction;

    const handler = getHandler('post', '/login');
    await handler(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ name: 'ZodError' }));
  });
});

describe('POST /refresh', () => {
  const tokens = {
    accessToken: 'new-at',
    refreshToken: 'new-rt',
    user: { id: 'u1', email: 'a@b.com', name: 'Alice' },
  };

  it('rotates cookie when token comes from cookie', async () => {
    mockAuth.refresh.mockResolvedValue(tokens);

    const req = makeReq({}, { refresh_token: 'old-rt' });
    const res = makeRes();
    const next = vi.fn() as NextFunction;

    const handler = getHandler('post', '/refresh');
    await handler(req, res, next);

    expect(res.cookie).toHaveBeenCalledWith('refresh_token', 'new-rt', expect.any(Object));
    const [call] = (res.json as any).mock.calls;
    expect(call[0].refreshToken).toBeUndefined(); // not in body for browser
  });

  it('returns token pair in body when CLI sends token in body', async () => {
    mockAuth.refresh.mockResolvedValue(tokens);

    const req = makeReq({ refreshToken: 'old-rt' });
    const res = makeRes();
    const next = vi.fn() as NextFunction;

    const handler = getHandler('post', '/refresh');
    await handler(req, res, next);

    const [call] = (res.json as any).mock.calls;
    expect(call[0].refreshToken).toBe('new-rt');
  });

  it('throws AUTH_TOKEN_MISSING when no token provided', async () => {
    const req = makeReq();
    const res = makeRes();
    const next = vi.fn() as NextFunction;

    const handler = getHandler('post', '/refresh');
    await handler(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 'AUTH_TOKEN_MISSING' }));
  });
});

describe('POST /logout', () => {
  it('clears cookie and calls logout service', async () => {
    mockAuth.logout.mockResolvedValue(undefined);

    const req = makeReq({}, { refresh_token: 'rt' });
    const res = makeRes();
    const next = vi.fn() as NextFunction;

    const handler = getHandler('post', '/logout');
    await handler(req, res, next);

    expect(mockAuth.logout).toHaveBeenCalledWith('rt');
    expect(res.clearCookie).toHaveBeenCalledWith('refresh_token', expect.any(Object));
    expect(res.json).toHaveBeenCalledWith({ ok: true });
  });

  it('returns ok even with no token (graceful logout)', async () => {
    const req = makeReq();
    const res = makeRes();
    const next = vi.fn() as NextFunction;

    const handler = getHandler('post', '/logout');
    await handler(req, res, next);

    expect(mockAuth.logout).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ ok: true });
  });
});
