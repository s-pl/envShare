import Conf from 'conf';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

interface CliConfig {
  apiUrl: string;
  refreshToken: string;
  userId: string;
  email: string;
}

export interface ProjectLink {
  projectId: string;
  projectName: string;
}

export const config = new Conf<CliConfig>({
  projectName: 'envshare',
  defaults: { apiUrl: 'http://localhost:3000', refreshToken: '', userId: '', email: '' },
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

export function readProjectLink(): ProjectLink | null {
  const path = join(process.cwd(), '.envshare.json');
  if (!existsSync(path)) return null;
  try { return JSON.parse(readFileSync(path, 'utf-8')) as ProjectLink; }
  catch { return null; }
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

export function readPushConfig(): PushConfig {
  const path = join(process.cwd(), '.envshare.config.json');
  if (!existsSync(path)) return { ...DEFAULT_PUSH_CONFIG };
  try { return { ...DEFAULT_PUSH_CONFIG, ...JSON.parse(readFileSync(path, 'utf-8')) }; }
  catch { return { ...DEFAULT_PUSH_CONFIG }; }
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
