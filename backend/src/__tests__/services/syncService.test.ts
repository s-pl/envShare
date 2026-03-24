import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock prisma
vi.mock('../../utils/prisma', () => {
  const tx = {
    secret: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    secretVersion: { create: vi.fn() },
    auditLog: { create: vi.fn() },
  };
  return {
    prisma: {
      $transaction: vi.fn(async (fn: (tx: typeof tx) => Promise<unknown>) => fn(tx)),
      secret: { findMany: vi.fn() },
      environment: { findMany: vi.fn() },
      _tx: tx,
    },
  };
});

// Mock projectKey utility
vi.mock('../../utils/projectKey', () => ({
  getProjectKey: vi.fn().mockResolvedValue('a'.repeat(64)),
}));

// Mock secretsService to avoid nested encryption in tests
vi.mock('../../services/secretsService', () => ({
  secretsService: {
    setSharedValue: vi.fn().mockResolvedValue(undefined),
    setPersonalValue: vi.fn().mockResolvedValue(undefined),
    listForUser: vi.fn(),
  },
}));

import { prisma } from '../../utils/prisma';
import { syncService } from '../../services/syncService';
import { secretsService } from '../../services/secretsService';

const mockPrisma = prisma as any;
const tx = mockPrisma._tx;

beforeEach(() => {
  vi.clearAllMocks();
  // Reset $transaction to use tx
  mockPrisma.$transaction.mockImplementation(
    async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx),
  );
});

describe('syncService.push', () => {
  it('creates a new secret for an unknown key', async () => {
    tx.secret.findUnique.mockResolvedValue(null);
    tx.secret.create.mockResolvedValue({ id: 's1' });
    tx.secretVersion.create.mockResolvedValue({});
    tx.auditLog.create.mockResolvedValue({});

    const result = await syncService.push('proj1', [{ key: 'NEW_KEY', value: 'val', isShared: false }], 'u1');
    expect(result.created).toContain('NEW_KEY');
    expect(result.updated).toHaveLength(0);
    expect(tx.secret.create).toHaveBeenCalledOnce();
  });

  it('updates result for existing secret', async () => {
    tx.secret.findUnique.mockResolvedValue({ id: 's1', environmentId: null });
    tx.auditLog.create.mockResolvedValue({});

    const result = await syncService.push('proj1', [{ key: 'OLD_KEY', value: 'val', isShared: false }], 'u1');
    expect(result.updated).toContain('OLD_KEY');
    expect(result.created).toHaveLength(0);
  });

  it('calls setSharedValue for shared entries', async () => {
    tx.secret.findUnique.mockResolvedValue({ id: 's1', environmentId: null });
    tx.auditLog.create.mockResolvedValue({});

    await syncService.push('proj1', [{ key: 'DB_URL', value: 'postgres://...', isShared: true }], 'u1');
    expect(secretsService.setSharedValue).toHaveBeenCalledWith('s1', 'postgres://...', 'u1');
  });

  it('tracks shared updates in result.sharedUpdated', async () => {
    tx.secret.findUnique.mockResolvedValue({ id: 's1', environmentId: null });
    tx.auditLog.create.mockResolvedValue({});

    const result = await syncService.push('proj1', [{ key: 'DB_URL', value: 'val', isShared: true }], 'u1');
    expect(result.sharedUpdated).toContain('DB_URL');
  });

  it('creates audit log entry', async () => {
    tx.secret.findUnique.mockResolvedValue({ id: 's1', environmentId: null });
    tx.auditLog.create.mockResolvedValue({});

    await syncService.push('proj1', [{ key: 'KEY', value: 'v', isShared: false }], 'u1');
    expect(tx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: 'SECRETS_PUSHED' }) }),
    );
  });

  it('processes multiple entries', async () => {
    tx.secret.findUnique
      .mockResolvedValueOnce(null) // first key is new
      .mockResolvedValueOnce({ id: 's2', environmentId: null }); // second key exists
    tx.secret.create.mockResolvedValue({ id: 's1' });
    tx.secretVersion.create.mockResolvedValue({});
    tx.auditLog.create.mockResolvedValue({});

    const result = await syncService.push('proj1', [
      { key: 'NEW', value: 'v1', isShared: false },
      { key: 'OLD', value: 'v2', isShared: false },
    ], 'u1');

    expect(result.created).toHaveLength(1);
    expect(result.updated).toHaveLength(1);
  });
});

describe('syncService.pull', () => {
  it('returns secrets with filePath from environment', async () => {
    const mockSecrets = [{ id: 's1', key: 'KEY', value: 'val', isShared: true, hasPersonalValue: false, version: 1, updatedAt: new Date() }];
    (secretsService.listForUser as any).mockResolvedValue(mockSecrets);
    mockPrisma.secret.findMany.mockResolvedValue([{ id: 's1', environmentId: 'env1' }]);
    mockPrisma.environment.findMany.mockResolvedValue([{ id: 'env1', filePath: '.env.staging', name: 'staging' }]);

    const result = await syncService.pull('proj1', 'u1');
    expect(result[0].filePath).toBe('.env.staging');
    expect(result[0].environmentName).toBe('staging');
  });

  it('defaults filePath to .env for secrets without environment', async () => {
    const mockSecrets = [{ id: 's1', key: 'KEY', value: 'val', isShared: true, hasPersonalValue: false, version: 1, updatedAt: new Date() }];
    (secretsService.listForUser as any).mockResolvedValue(mockSecrets);
    mockPrisma.secret.findMany.mockResolvedValue([{ id: 's1', environmentId: null }]);
    mockPrisma.environment.findMany.mockResolvedValue([]);

    const result = await syncService.pull('proj1', 'u1');
    expect(result[0].filePath).toBe('.env');
    expect(result[0].environmentName).toBe('production');
  });

  it('filters by envFilter when provided', async () => {
    const mockSecrets = [
      { id: 's1', key: 'KEY1', value: 'v1', isShared: true, hasPersonalValue: false, version: 1, updatedAt: new Date() },
      { id: 's2', key: 'KEY2', value: 'v2', isShared: true, hasPersonalValue: false, version: 1, updatedAt: new Date() },
    ];
    (secretsService.listForUser as any).mockResolvedValue(mockSecrets);
    mockPrisma.secret.findMany.mockResolvedValue([
      { id: 's1', environmentId: 'e1' },
      { id: 's2', environmentId: 'e2' },
    ]);
    mockPrisma.environment.findMany.mockResolvedValue([
      { id: 'e1', filePath: '.env.staging', name: 'staging' },
      { id: 'e2', filePath: '.env.prod', name: 'production' },
    ]);

    const result = await syncService.pull('proj1', 'u1', 'staging');
    expect(result).toHaveLength(1);
    expect(result[0].key).toBe('KEY1');
  });
});
