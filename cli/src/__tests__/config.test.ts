import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { join } from 'path';

// Mock fs module
vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>();
  return {
    ...actual,
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
  };
});

// Mock conf module so tests don't read/write real config
vi.mock('conf', () => {
  return {
    default: class MockConf {
      get = vi.fn();
      set = vi.fn();
    },
  };
});

import { existsSync, readFileSync } from 'fs';
import {
  readProjectLink,
  readPushConfig,
  clearConfigCache,
  matchesPattern,
  isAutoShared,
  isIgnored,
} from '../config';

const mockExistsSync = existsSync as ReturnType<typeof vi.fn>;
const mockReadFileSync = readFileSync as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  clearConfigCache();
});

describe('readProjectLink', () => {
  it('returns null when .envshare.json does not exist', () => {
    mockExistsSync.mockReturnValue(false);
    expect(readProjectLink()).toBeNull();
  });

  it('parses .envshare.json and returns link', () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(JSON.stringify({ projectId: 'p1', projectName: 'My Project' }));
    const link = readProjectLink();
    expect(link).toEqual({ projectId: 'p1', projectName: 'My Project' });
  });

  it('returns null on JSON parse error', () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue('invalid json{{{');
    expect(readProjectLink()).toBeNull();
  });
});

describe('readPushConfig', () => {
  it('returns defaults when .envshare.config.json does not exist', () => {
    mockExistsSync.mockReturnValue(false);
    const cfg = readPushConfig();
    expect(cfg.defaultFile).toBe('.env');
    expect(cfg.sharedKeys).toEqual([]);
    expect(cfg.sharedPatterns).toEqual([]);
    expect(cfg.ignoredKeys).toEqual([]);
  });

  it('merges file with defaults', () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(JSON.stringify({ sharedKeys: ['DB_URL'] }));
    const cfg = readPushConfig();
    expect(cfg.sharedKeys).toEqual(['DB_URL']);
    expect(cfg.defaultFile).toBe('.env'); // default preserved
  });
});

describe('matchesPattern', () => {
  it('matches *_URL pattern', () => {
    expect(matchesPattern('DATABASE_URL', '*_URL')).toBe(true);
    expect(matchesPattern('REDIS_URL', '*_URL')).toBe(true);
    expect(matchesPattern('DATABASE_HOST', '*_URL')).toBe(false);
  });

  it('matches DB_* prefix pattern', () => {
    expect(matchesPattern('DB_HOST', 'DB_*')).toBe(true);
    expect(matchesPattern('DB_PORT', 'DB_*')).toBe(true);
    expect(matchesPattern('REDIS_HOST', 'DB_*')).toBe(false);
  });

  it('matches *HOST* pattern in middle', () => {
    expect(matchesPattern('REDIS_HOST_NAME', '*HOST*')).toBe(true);
    expect(matchesPattern('HOST', '*HOST*')).toBe(true);
  });

  it('is case-insensitive', () => {
    expect(matchesPattern('database_url', '*_URL')).toBe(true);
  });

  it('matches exact key name (no wildcards)', () => {
    expect(matchesPattern('SECRET_KEY', 'SECRET_KEY')).toBe(true);
    expect(matchesPattern('OTHER_KEY', 'SECRET_KEY')).toBe(false);
  });
});

describe('isAutoShared', () => {
  it('returns true for exact key in sharedKeys', () => {
    const cfg = { defaultFile: '.env', sharedKeys: ['DATABASE_URL'], sharedPatterns: [], ignoredKeys: [] };
    expect(isAutoShared('DATABASE_URL', cfg)).toBe(true);
  });

  it('returns true when key matches a sharedPattern', () => {
    const cfg = { defaultFile: '.env', sharedKeys: [], sharedPatterns: ['*_URL'], ignoredKeys: [] };
    expect(isAutoShared('REDIS_URL', cfg)).toBe(true);
  });

  it('returns false when key is not in sharedKeys or sharedPatterns', () => {
    const cfg = { defaultFile: '.env', sharedKeys: ['DB_URL'], sharedPatterns: ['*_TOKEN'], ignoredKeys: [] };
    expect(isAutoShared('MY_SECRET', cfg)).toBe(false);
  });
});

describe('isIgnored', () => {
  it('returns true when key matches an ignored pattern', () => {
    const cfg = { defaultFile: '.env', sharedKeys: [], sharedPatterns: [], ignoredKeys: ['LOCAL_*'] };
    expect(isIgnored('LOCAL_DEBUG', cfg)).toBe(true);
  });

  it('returns false when key does not match any ignored pattern', () => {
    const cfg = { defaultFile: '.env', sharedKeys: [], sharedPatterns: [], ignoredKeys: ['LOCAL_*'] };
    expect(isIgnored('DATABASE_URL', cfg)).toBe(false);
  });
});
