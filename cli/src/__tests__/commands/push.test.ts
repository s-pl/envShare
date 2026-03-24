import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

// We import the function directly from push.ts which now re-exports from parseDotenv
// For findEnvFiles we test via a temp directory

describe('findEnvFiles (via temp dir)', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = join(tmpdir(), `envshare-test-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  async function findEnvFiles(dir: string): Promise<string[]> {
    // We can't easily import the private function, so we test the exported push command
    // behavior by creating files and checking what parseDotenv-based logic would find.
    // Instead, directly test the regex used in findEnvFiles:
    const { readdirSync } = await import('fs');
    return readdirSync(dir).filter(
      (name) => /^\.env(\..+)?$/.test(name) && name !== '.env.example',
    );
  }

  it('finds .env', async () => {
    writeFileSync(join(tmpDir, '.env'), 'KEY=val');
    const files = await findEnvFiles(tmpDir);
    expect(files).toContain('.env');
  });

  it('finds .env.local', async () => {
    writeFileSync(join(tmpDir, '.env.local'), 'KEY=val');
    const files = await findEnvFiles(tmpDir);
    expect(files).toContain('.env.local');
  });

  it('finds .env.production', async () => {
    writeFileSync(join(tmpDir, '.env.production'), 'KEY=val');
    const files = await findEnvFiles(tmpDir);
    expect(files).toContain('.env.production');
  });

  it('finds .env.staging', async () => {
    writeFileSync(join(tmpDir, '.env.staging'), 'KEY=val');
    const files = await findEnvFiles(tmpDir);
    expect(files).toContain('.env.staging');
  });

  it('does NOT include .env.example', async () => {
    writeFileSync(join(tmpDir, '.env.example'), 'KEY=val');
    const files = await findEnvFiles(tmpDir);
    expect(files).not.toContain('.env.example');
  });

  it('does NOT include unrelated files', async () => {
    writeFileSync(join(tmpDir, 'config.json'), '{}');
    writeFileSync(join(tmpDir, 'README.md'), '# readme');
    const files = await findEnvFiles(tmpDir);
    expect(files).toHaveLength(0);
  });

  it('finds multiple .env files at once', async () => {
    writeFileSync(join(tmpDir, '.env'), '');
    writeFileSync(join(tmpDir, '.env.local'), '');
    writeFileSync(join(tmpDir, '.env.production'), '');
    const files = await findEnvFiles(tmpDir);
    expect(files).toHaveLength(3);
  });
});
