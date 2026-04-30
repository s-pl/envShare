import Conf from 'conf';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

interface CliConfig {
  apiUrl: string;
  refreshToken: string;
  userId: string;
  email: string;
  /** ISO timestamp of the GitHub asset.updated_at from the last install/update */
  installedAssetDate: string;
}

export interface ProjectLink {
  projectId: string;
  projectName: string;
}

export const config = new Conf<CliConfig>({
  projectName: 'envshare',
  defaults: { apiUrl: 'http://localhost:3001', refreshToken: '', userId: '', email: '', installedAssetDate: '' },
});

let _accessToken: string | null = null;
export function setAccessToken(token: string): void { _accessToken = token; }
export function getAccessToken(): string | null { return _accessToken; }
export function getApiUrl(): string { return process.env.ENVSHARE_API_URL || config.get('apiUrl'); }
export function isAuthenticated(): boolean { return !!config.get('refreshToken'); }
export function clearAuth(): void {
  config.set('refreshToken', '');
  config.set('userId', '');
  config.set('email', '');
  _accessToken = null;
}

let _projectLinkCache: ProjectLink | null | undefined;
let _pushConfigCache: PushConfig | undefined;

export function clearConfigCache(): void {
  _projectLinkCache = undefined;
  _pushConfigCache = undefined;
}

export function readProjectLink(): ProjectLink | null {
  if (_projectLinkCache !== undefined) return _projectLinkCache;
  const path = join(process.cwd(), '.envshare.json');
  if (!existsSync(path)) { _projectLinkCache = null; return null; }
  try {
    _projectLinkCache = JSON.parse(readFileSync(path, 'utf-8')) as ProjectLink;
    return _projectLinkCache;
  } catch {
    _projectLinkCache = null;
    return null;
  }
}

export function writeProjectLink(link: ProjectLink): void {
  writeFileSync(join(process.cwd(), '.envshare.json'), JSON.stringify(link, null, 2));
}

// ─── Push config (.envshare.config.json) ─────────────────────────────────────────

export interface PushConfig {
  defaultFile: string;
  sharedKeys: string[];       // exact key names always treated as shared
  sharedPatterns: string[];   // glob-style patterns: *_URL, DB_*, etc.
  ignoredKeys: string[];      // keys never pushed (matches by pattern too)
  ignoredPaths?: string[];    // file path globs to skip: docker/**, **/.env.docker
  ignoredDirs?: string[];     // extra directory names to skip during scan
}

/**
 * Built-in directory names skipped during recursive scans (always present).
 * `ignoredDirs` from user config is added on top.
 */
export const DEFAULT_SKIP_DIRS: readonly string[] = [
  'node_modules', '.git', 'dist', 'build', '.cache', 'coverage',
  'tmp', '.next', 'out', '.venv', 'venv', '__pycache__', '.idea',
  '.vscode', 'vendor', '.terraform', '.docker', '.turbo', '.nuxt',
  '.output', '.svelte-kit', 'target', 'bin', 'obj', 'docker',
];

const DEFAULT_PUSH_CONFIG: PushConfig = {
  defaultFile: '.env',
  sharedKeys: [],
  sharedPatterns: [],
  ignoredKeys: [],
  ignoredPaths: [],
  ignoredDirs: [],
};

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every(item => typeof item === 'string');
}

function validatePushConfig(v: unknown): v is Partial<PushConfig> {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return false;
  const c = v as Record<string, unknown>;
  if ('defaultFile' in c && typeof c.defaultFile !== 'string') return false;
  if ('sharedKeys' in c && !isStringArray(c.sharedKeys)) return false;
  if ('sharedPatterns' in c && !isStringArray(c.sharedPatterns)) return false;
  if ('ignoredKeys' in c && !isStringArray(c.ignoredKeys)) return false;
  if ('ignoredPaths' in c && !isStringArray(c.ignoredPaths)) return false;
  if ('ignoredDirs' in c && !isStringArray(c.ignoredDirs)) return false;
  return true;
}

export function readPushConfig(): PushConfig {
  if (_pushConfigCache) return _pushConfigCache;
  const path = join(process.cwd(), '.envshare.config.json');
  if (!existsSync(path)) { _pushConfigCache = { ...DEFAULT_PUSH_CONFIG }; return _pushConfigCache; }
  try {
    const raw: unknown = JSON.parse(readFileSync(path, 'utf-8'));
    if (!validatePushConfig(raw)) {
      process.stderr.write('Warning: .envshare.config.json has invalid fields — falling back to defaults\n');
      _pushConfigCache = { ...DEFAULT_PUSH_CONFIG };
      return _pushConfigCache;
    }
    _pushConfigCache = { ...DEFAULT_PUSH_CONFIG, ...raw };
    return _pushConfigCache;
  } catch {
    _pushConfigCache = { ...DEFAULT_PUSH_CONFIG };
    return _pushConfigCache;
  }
}

export function writePushConfig(cfg: PushConfig): void {
  writeFileSync(join(process.cwd(), '.envshare.config.json'), JSON.stringify(cfg, null, 2));
}

/** Returns true if key matches a pattern like *_URL, DB_*, *HOST* */
export function matchesPattern(key: string, pattern: string): boolean {
  const re = new RegExp('^' + pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$', 'i');
  return re.test(key);
}

/**
 * Glob match for relative file paths.
 * Supports `**` (any number of segments, incl. zero), `*` (any chars except `/`),
 * `?` (single char). Always anchored start-to-end. Forward slashes only.
 */
export function matchesPathGlob(relPath: string, pattern: string): boolean {
  const normalized = relPath.replace(/\\/g, '/').replace(/^\.?\//, '');
  const pat = pattern.replace(/\\/g, '/').replace(/^\.?\//, '');

  // Build regex: tokenize **, *, ? then escape the rest.
  let re = '';
  for (let i = 0; i < pat.length; i++) {
    const c = pat[i];
    if (c === '*' && pat[i + 1] === '*') {
      // ** → match anything (including / and empty); collapse a trailing /
      re += '.*';
      i++;
      if (pat[i + 1] === '/') i++;
    } else if (c === '*') {
      re += '[^/]*';
    } else if (c === '?') {
      re += '[^/]';
    } else if ('.+^${}()|[]\\'.includes(c)) {
      re += '\\' + c;
    } else {
      re += c;
    }
  }
  return new RegExp('^' + re + '$').test(normalized);
}

export function isAutoShared(key: string, cfg: PushConfig): boolean {
  return cfg.sharedKeys.includes(key) || cfg.sharedPatterns.some(p => matchesPattern(key, p));
}

export function isIgnored(key: string, cfg: PushConfig): boolean {
  return cfg.ignoredKeys.some(p => matchesPattern(key, p));
}

/** Returns true if a relative file path matches any `ignoredPaths` glob. */
export function isPathIgnored(relPath: string, cfg: PushConfig): boolean {
  return (cfg.ignoredPaths ?? []).some(p => matchesPathGlob(relPath, p));
}

/** Combined set of directory names to skip during recursive scans. */
export function skipDirSet(cfg: PushConfig): Set<string> {
  return new Set([...DEFAULT_SKIP_DIRS, ...(cfg.ignoredDirs ?? [])]);
}
