import { describe, it, expect, vi, beforeEach } from 'vitest';
import bcrypt from 'bcryptjs';

// Mock prisma before importing authService
vi.mock('../../utils/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    refreshToken: {
      create: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
      findMany: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  },
}));

import { prisma } from '../../utils/prisma';
import { authService } from '../../services/authService';
import { AppError } from '../../middleware/errorHandler';

const mockPrisma = prisma as any;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('authService.register', () => {
  it('creates a user and returns profile without passwordHash', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    const created = { id: 'u1', email: 'a@b.com', name: 'Alice', createdAt: new Date(), consentedAt: new Date() };
    mockPrisma.user.create.mockResolvedValue(created);

    const result = await authService.register('a@b.com', 'strongpassword1', 'Alice', true);
    expect(result.email).toBe('a@b.com');
    expect(result).not.toHaveProperty('passwordHash');
  });

  it('throws AUTH_EMAIL_TAKEN if email already exists', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'existing' });
    await expect(authService.register('a@b.com', 'pass', 'Alice', true))
      .rejects.toMatchObject({ code: 'AUTH_EMAIL_TAKEN' });
  });

  it('throws GDPR_CONSENT_REQUIRED when consent is false', async () => {
    await expect(authService.register('a@b.com', 'pass', 'Alice', false))
      .rejects.toMatchObject({ code: 'GDPR_CONSENT_REQUIRED' });
  });
});

describe('authService.login', () => {
  const passwordHash = bcrypt.hashSync('correctpassword123', 1);
  const mockUser = {
    id: 'u1',
    email: 'a@b.com',
    name: 'Alice',
    passwordHash,
    failedLoginAttempts: 0,
    lockedUntil: null,
  };

  it('returns token pair on valid credentials', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(mockUser);
    mockPrisma.refreshToken.create.mockResolvedValue({});
    mockPrisma.auditLog.create.mockResolvedValue({});

    const result = await authService.login('a@b.com', 'correctpassword123');
    expect(result).toHaveProperty('accessToken');
    expect(result).toHaveProperty('refreshToken');
    expect(result.user.email).toBe('a@b.com');
  });

  it('throws AUTH_INVALID_CREDENTIALS on wrong password', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(mockUser);
    mockPrisma.user.update.mockResolvedValue({});
    mockPrisma.auditLog.create.mockResolvedValue({});

    await expect(authService.login('a@b.com', 'wrongpassword'))
      .rejects.toMatchObject({ code: 'AUTH_INVALID_CREDENTIALS' });
  });

  it('throws AUTH_INVALID_CREDENTIALS on unknown email', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);

    await expect(authService.login('nobody@example.com', 'any'))
      .rejects.toMatchObject({ code: 'AUTH_INVALID_CREDENTIALS' });
  });

  it('locks account after MAX_FAILED_ATTEMPTS', async () => {
    const almostLocked = { ...mockUser, failedLoginAttempts: 9 };
    mockPrisma.user.findUnique.mockResolvedValue(almostLocked);
    mockPrisma.user.update.mockResolvedValue({});
    mockPrisma.auditLog.create.mockResolvedValue({});

    await expect(authService.login('a@b.com', 'wrongpassword'))
      .rejects.toMatchObject({ code: 'AUTH_INVALID_CREDENTIALS' });

    // verify lockout fields were set
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ failedLoginAttempts: 10 }),
      }),
    );
  });

  it('throws AUTH_ACCOUNT_LOCKED when lockedUntil is in the future', async () => {
    const locked = {
      ...mockUser,
      lockedUntil: new Date(Date.now() + 60_000),
    };
    mockPrisma.user.findUnique.mockResolvedValue(locked);
    mockPrisma.auditLog.create.mockResolvedValue({});

    await expect(authService.login('a@b.com', 'correctpassword123'))
      .rejects.toMatchObject({ code: 'AUTH_ACCOUNT_LOCKED' });
  });
});

describe('authService.refresh', () => {
  it('rotates token and returns new pair', async () => {
    const future = new Date(Date.now() + 86400_000);
    mockPrisma.refreshToken.findUnique.mockResolvedValue({
      id: 'rt1',
      userId: 'u1',
      expiresAt: future,
      user: { id: 'u1', email: 'a@b.com', name: 'Alice' },
    });
    mockPrisma.refreshToken.delete.mockResolvedValue({});
    mockPrisma.refreshToken.create.mockResolvedValue({});

    const result = await authService.refresh('sometoken');
    expect(result).toHaveProperty('accessToken');
    expect(result).toHaveProperty('refreshToken');
    expect(mockPrisma.refreshToken.delete).toHaveBeenCalledOnce();
    expect(mockPrisma.refreshToken.create).toHaveBeenCalledOnce();
  });

  it('throws AUTH_REFRESH_INVALID when token not found', async () => {
    mockPrisma.refreshToken.findUnique.mockResolvedValue(null);
    await expect(authService.refresh('invalid'))
      .rejects.toMatchObject({ code: 'AUTH_REFRESH_INVALID' });
  });

  it('throws AUTH_REFRESH_INVALID when token is expired', async () => {
    const past = new Date(Date.now() - 1000);
    mockPrisma.refreshToken.findUnique.mockResolvedValue({
      id: 'rt1',
      expiresAt: past,
      user: { id: 'u1', email: 'a@b.com', name: 'Alice' },
    });
    mockPrisma.refreshToken.delete.mockResolvedValue({});

    await expect(authService.refresh('expiredtoken'))
      .rejects.toMatchObject({ code: 'AUTH_REFRESH_INVALID' });
  });
});

describe('authService.logout', () => {
  it('deletes the refresh token', async () => {
    mockPrisma.refreshToken.deleteMany.mockResolvedValue({ count: 1 });
    await authService.logout('sometoken');
    // logout hashes the token before querying the DB (ISO 27001 A.9.4.3)
    const { createHash } = await import('crypto');
    const expectedHash = createHash('sha256').update('sometoken').digest('hex');
    expect(mockPrisma.refreshToken.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { token: expectedHash } }),
    );
  });
});
