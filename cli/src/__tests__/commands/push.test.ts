import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, symlinkSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { findEnvFiles } from '../../commands/push.js';

describe('findEnvFiles', () => {
  let root: string;

  beforeEach(() => {
    root = join(tmpdir(), `envshare-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(root, { recursive: true });
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  // ── Root-level files ──────────────────────────────────────────────────────

  it('finds .env in root', () => {
    writeFileSync(join(root, '.env'), 'KEY=val');
    expect(findEnvFiles(root)).toEqual(['.env']);
  });

  it('finds .env.local and .env.production in root', () => {
    writeFileSync(join(root, '.env.local'), '');
    writeFileSync(join(root, '.env.production'), '');
    const result = findEnvFiles(root);
    expect(result).toContain('.env.local');
    expect(result).toContain('.env.production');
    expect(result).toHaveLength(2);
  });

  // ── Excluded patterns ─────────────────────────────────────────────────────

  it('excludes .env.example', () => {
    writeFileSync(join(root, '.env'), '');
    writeFileSync(join(root, '.env.example'), '');
    expect(findEnvFiles(root)).toEqual(['.env']);
  });

  it('excludes .env.template', () => {
    writeFileSync(join(root, '.env'), '');
    writeFileSync(join(root, '.env.template'), '');
    expect(findEnvFiles(root)).toEqual(['.env']);
  });

  it('excludes .env.sample and .env.bak', () => {
    writeFileSync(join(root, '.env.sample'), '');
    writeFileSync(join(root, '.env.bak'), '');
    expect(findEnvFiles(root)).toEqual([]);
  });

  it('excludes multi-dot suffixes like .env.test.bad', () => {
    writeFileSync(join(root, '.env.test.bad'), '');
    expect(findEnvFiles(root)).toEqual([]);
  });

  it('ignores non-env files', () => {
    writeFileSync(join(root, 'config.json'), '{}');
    writeFileSync(join(root, 'README.md'), '');
    expect(findEnvFiles(root)).toEqual([]);
  });

  // ── Recursive search ──────────────────────────────────────────────────────

  it('finds .env in immediate subdirectories', () => {
    mkdirSync(join(root, 'backend'));
    writeFileSync(join(root, 'backend', '.env'), '');
    expect(findEnvFiles(root)).toEqual(['backend/.env']);
  });

  it('finds .env files deeply nested (services/auth/.env)', () => {
    mkdirSync(join(root, 'services', 'auth'), { recursive: true });
    mkdirSync(join(root, 'services', 'payment'), { recursive: true });
    writeFileSync(join(root, 'services', 'auth', '.env'), '');
    writeFileSync(join(root, 'services', 'payment', '.env.local'), '');
    const result = findEnvFiles(root);
    expect(result).toContain('services/auth/.env');
    expect(result).toContain('services/payment/.env.local');
    expect(result).toHaveLength(2);
  });

  it('finds env files at mixed depths', () => {
    mkdirSync(join(root, 'backend'));
    mkdirSync(join(root, 'services', 'api'), { recursive: true });
    writeFileSync(join(root, '.env'), '');
    writeFileSync(join(root, 'backend', '.env'), '');
    writeFileSync(join(root, 'services', 'api', '.env'), '');
    const result = findEnvFiles(root);
    expect(result).toEqual(['.env', 'backend/.env', 'services/api/.env']);
  });

  // ── Skipped directories ───────────────────────────────────────────────────

  it('skips node_modules', () => {
    mkdirSync(join(root, 'node_modules', 'some-pkg'), { recursive: true });
    writeFileSync(join(root, 'node_modules', 'some-pkg', '.env'), '');
    expect(findEnvFiles(root)).toEqual([]);
  });

  it('skips docker directories', () => {
    mkdirSync(join(root, 'docker'));
    writeFileSync(join(root, 'docker', '.env'), '');
    expect(findEnvFiles(root)).toEqual([]);
  });

  it('skips dot-directories (.git, .cache, .vscode, etc.)', () => {
    for (const dir of ['.git', '.cache', '.vscode', '.idea']) {
      mkdirSync(join(root, dir), { recursive: true });
      writeFileSync(join(root, dir, '.env'), '');
    }
    expect(findEnvFiles(root)).toEqual([]);
  });

  it('skips dist, build, coverage, vendor, __pycache__', () => {
    for (const dir of ['dist', 'build', 'coverage', 'vendor', '__pycache__']) {
      mkdirSync(join(root, dir), { recursive: true });
      writeFileSync(join(root, dir, '.env'), '');
    }
    expect(findEnvFiles(root)).toEqual([]);
  });

  it('does not recurse into skipped dirs even when nested', () => {
    mkdirSync(join(root, 'app', 'node_modules', 'pkg'), { recursive: true });
    writeFileSync(join(root, 'app', 'node_modules', 'pkg', '.env'), '');
    writeFileSync(join(root, 'app', '.env'), '');
    expect(findEnvFiles(root)).toEqual(['app/.env']);
  });

  it('skips docker subdirectories inside services', () => {
    mkdirSync(join(root, 'project_service', 'docker'), { recursive: true });
    writeFileSync(join(root, 'project_service', '.env'), '');
    writeFileSync(join(root, 'project_service', 'docker', '.env'), '');
    expect(findEnvFiles(root)).toEqual(['project_service/.env']);
  });

  // ── Symlinks are ignored ──────────────────────────────────────────────────

  it('ignores symlinked .env files', () => {
    writeFileSync(join(root, 'real.env'), 'KEY=val');
    try { symlinkSync(join(root, 'real.env'), join(root, '.env')); } catch { return; }
    expect(findEnvFiles(root)).toEqual([]);
  });

  it('ignores symlinked directories (prevents duplication)', () => {
    mkdirSync(join(root, 'real-service'));
    writeFileSync(join(root, 'real-service', '.env'), '');
    try { symlinkSync(join(root, 'real-service'), join(root, 'alias-service')); } catch { return; }
    const result = findEnvFiles(root);
    expect(result).toEqual(['real-service/.env']);
  });

  // ── Sorting & dedup ───────────────────────────────────────────────────────

  it('returns sorted results', () => {
    mkdirSync(join(root, 'z-service'));
    mkdirSync(join(root, 'a-service'));
    writeFileSync(join(root, '.env'), '');
    writeFileSync(join(root, 'z-service', '.env'), '');
    writeFileSync(join(root, 'a-service', '.env'), '');
    expect(findEnvFiles(root)).toEqual(['.env', 'a-service/.env', 'z-service/.env']);
  });

  // ── Edge cases ────────────────────────────────────────────────────────────

  it('returns empty array for non-existent directory', () => {
    expect(findEnvFiles('/tmp/does-not-exist-xyz')).toEqual([]);
  });

  it('returns empty array for empty directory', () => {
    expect(findEnvFiles(root)).toEqual([]);
  });
});
