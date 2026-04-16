import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { logger } from './logger';

/**
 * server.config.json — Server-level configuration loaded at startup.
 *
 * Holds the whitelist of administrator emails. Any user registering with one
 * of these emails is automatically granted ADMIN role on every project, and
 * cannot be downgraded or removed by regular project admins.
 *
 * Path resolution order:
 *   1. $SERVER_CONFIG_PATH (absolute)
 *   2. ./server.config.json (relative to process.cwd())
 *
 * If the file is missing, the server still boots — there are simply no
 * pre-configured admins. This keeps dev/test environments frictionless.
 */

interface ServerConfig {
  admins: string[];
}

let cached: ServerConfig | null = null;

function resolveConfigPath(): string {
  return process.env.SERVER_CONFIG_PATH
    ? resolve(process.env.SERVER_CONFIG_PATH)
    : resolve(process.cwd(), 'server.config.json');
}

function load(): ServerConfig {
  const path = resolveConfigPath();

  if (!existsSync(path)) {
    logger.warn(`server.config.json not found at ${path} — no admins pre-configured.`);
    return { admins: [] };
  }

  try {
    const raw = readFileSync(path, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<ServerConfig>;
    const admins = Array.isArray(parsed.admins)
      ? parsed.admins.map(e => String(e).trim().toLowerCase()).filter(Boolean)
      : [];
    logger.info(`server.config.json loaded (${admins.length} admin email${admins.length === 1 ? '' : 's'})`);
    return { admins };
  } catch (err) {
    logger.error(`Failed to parse server.config.json at ${path}: ${(err as Error).message}`);
    return { admins: [] };
  }
}

export function getServerConfig(): ServerConfig {
  if (!cached) cached = load();
  return cached;
}

export function getAdminEmails(): string[] {
  return getServerConfig().admins;
}

export function isServerAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  return getAdminEmails().includes(email.toLowerCase());
}
