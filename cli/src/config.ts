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
  ignoredKeys: string[];      // never pushed
}

const DEFAULT_PUSH_CONFIG: PushConfig = {
  defaultFile: '.env',
  sharedKeys: [],
  sharedPatterns: [],
  ignoredKeys: [],
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
  return true;
}

let _pushConfigCache: PushConfig | undefined;

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

export function isAutoShared(key: string, cfg: PushConfig): boolean {
  return cfg.sharedKeys.includes(key) || cfg.sharedPatterns.some(p => matchesPattern(key, p));
}

export function isIgnored(key: string, cfg: PushConfig): boolean {
  return cfg.ignoredKeys.some(p => matchesPattern(key, p));
}
