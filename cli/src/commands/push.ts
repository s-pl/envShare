import { Command } from 'commander';
import { readFileSync, existsSync, readdirSync, lstatSync, realpathSync } from 'fs';
import { join, relative } from 'path';
import chalk from 'chalk';
import { paginatedCheckbox } from '../utils/paginatedCheckbox.js';
import { paginatedSelect } from '../utils/paginatedSelect.js';
import { api, ApiError } from '../api.js';
import {
  readProjectLink,
  readPushConfig,
  isAutoShared,
  isIgnored,
  isPathIgnored,
  skipDirSet,
  type PushConfig,
} from '../config.js';
import { parseDotenv } from '../utils/parseDotenv.js';
import { sectionHeader, successLine, warnLine, dimLine, errorLine } from '../utils/brand.js';
import { runBatched } from '../utils/batch.js';

export { parseDotenv };

/**
 * Matches .env and .env.<environment> (single word: local, production, staging, etc.)
 * Does NOT match .env.template, .env.example, .env.test.bad, etc.
 */
const ENV_FILE_RE = /^\.env(\.[a-zA-Z0-9_-]+)?$/;
const ENV_EXCLUDE = new Set(['.env.example', '.env.template', '.env.sample', '.env.bak', '.env.backup']);

/**
 * Find .env files recursively throughout the project.
 * Skips common non-project directories (built-in + user-configured), symlinks,
 * and dot-directories. Deduplicates by resolved real path.
 *
 * The `pushCfg` argument is optional: when omitted, only the built-in
 * `DEFAULT_SKIP_DIRS` apply (legacy behavior used by tests).
 */
export function findEnvFiles(root: string, pushCfg?: PushConfig): string[] {
  const cfg: PushConfig = pushCfg ?? {
    defaultFile: '.env',
    sharedKeys: [], sharedPatterns: [], ignoredKeys: [],
  };
  const skip = skipDirSet(cfg);

  const results: string[] = [];
  const seenRealPaths = new Set<string>();

  function walk(dir: string, depth: number) {
    if (depth > 10) return; // safety cap

    let entries: string[];
    try { entries = readdirSync(dir); } catch { return; }

    for (const name of entries) {
      const abs = join(dir, name);
      let lst;
      try { lst = lstatSync(abs); } catch { continue; }

      // Never follow symlinks — they caused duplication
      if (lst.isSymbolicLink()) continue;

      if (lst.isFile() && ENV_FILE_RE.test(name) && !ENV_EXCLUDE.has(name)) {
        const rel = relative(root, abs).replace(/\\/g, '/');
        if (isPathIgnored(rel, cfg)) continue;
        // Deduplicate by real path (handles hardlinks, bind mounts, etc.)
        const real = safeRealpath(abs);
        if (real && !seenRealPaths.has(real)) {
          seenRealPaths.add(real);
          results.push(rel);
        }
      } else if (lst.isDirectory() && !skip.has(name) && !name.startsWith('.')) {
        walk(abs, depth + 1);
      }
    }
  }

  walk(root, 0);
  return results.sort();
}

function safeRealpath(p: string): string | null {
  try { return realpathSync(p); } catch { return null; }
}

function loadEntries(absPath: string, pushCfg: PushConfig) {
  const entries = parseDotenv(readFileSync(absPath, 'utf-8'));
  return entries
    .filter(e => !isIgnored(e.key, pushCfg))
    .map(e => ({ ...e, isShared: e.isShared || isAutoShared(e.key, pushCfg) }));
}

type LoadedEntry = ReturnType<typeof loadEntries>[number];
type LoadedFile = { path: string; entries: LoadedEntry[] };

async function selectEnvFile(filePaths: string[], pushCfg: PushConfig, root: string): Promise<LoadedFile | null> {
  const loaded: LoadedFile[] = filePaths
    .filter(fp => existsSync(join(root, fp)))
    .map(fp => ({ path: fp, entries: loadEntries(join(root, fp), pushCfg) }));

  if (!loaded.length) return null;
  if (loaded.length === 1) return loaded[0];

  const choices = loaded.map(f => ({
    title: `${f.path}  (${f.entries.length} vars)`,
    value: f.path,
  }));
  const chosen = await paginatedSelect('Which .env file?', choices);
  return chosen ? (loaded.find(f => f.path === chosen) ?? null) : null;
}

const BATCH_SIZE = 10;
const CONCURRENCY = 3;

interface PushTotals { created: number; updated: number; shared: number }

interface PushResponse {
  result: { created: string[]; updated: string[]; sharedUpdated: string[] };
}

async function pushSecrets(
  projectId: string,
  filePath: string,
  entries: LoadedEntry[],
  environmentName: string | undefined,
  onProgress?: (done: number, total: number) => void,
): Promise<PushTotals> {
  const responses = await runBatched<LoadedEntry, PushResponse>(
    entries,
    batch => api.post<PushResponse>(
      `/sync/${projectId}/push`,
      { secrets: batch, filePath, environmentName },
    ),
    { batchSize: BATCH_SIZE, concurrency: CONCURRENCY, onProgress },
  );

  const totals: PushTotals = { created: 0, updated: 0, shared: 0 };
  for (const { result } of responses) {
    totals.created += result.created.length;
    totals.updated += result.updated.length;
    totals.shared  += result.sharedUpdated.length;
  }
  return totals;
}

function bar(done: number, total: number, width = 24): string {
  const filled = Math.round((done / total) * width);
  return chalk.green('█'.repeat(filled)) + chalk.dim('░'.repeat(width - filled));
}

function summaryParts(t: PushTotals): string[] {
  const parts: string[] = [];
  if (t.created) parts.push(chalk.green(`+${t.created} new`));
  if (t.updated) parts.push(`${t.updated} updated`);
  if (t.shared)  parts.push(chalk.blue(`${t.shared} shared`));
  return parts;
}

export const pushCommand = new Command('push')
  .alias('up')
  .description('Upload .env variables to the linked project (auto-detects .env files)')
  .argument('[file]', 'Specific .env file to push (auto-detected if omitted)')
  .option('--all', 'Push all variables from all detected .env files without prompts')
  .option('--yes', 'Alias for --all (useful in CI/CD pipelines)')
  .option('--env <name>', 'Tag secrets with an environment name (e.g. staging, production)')
  .option('--dry-run', 'Preview what would be pushed without actually sending anything')
  .addHelpText('after', `
Examples:
  $ envshare push                      Interactive: pick file, select variables
  $ envshare push .env.staging         Push a specific file
  $ envshare push --all                Push all .env files without prompts
  $ envshare push --env staging        Tag all pushed secrets as "staging"
  $ envshare push --dry-run            See what would be pushed (no changes made)

Shared variables:
  Mark a variable as shared (visible to all team members) by adding a comment:
    DATABASE_URL=postgres://... # @shared
  Or configure patterns in .envshare.config.json:
    { "sharedPatterns": ["*_URL", "DB_*"], "ignoredKeys": ["LOCAL_*"] }

Ignoring files:
  Skip .env files by path or directory in .envshare.config.json:
    { "ignoredPaths": ["docker/**", "**/.env.docker"], "ignoredDirs": ["infra"] }`)
  .action(async (file: string | undefined, opts) => {
    if (opts.yes) opts.all = true;

    const link = readProjectLink();
    if (!link) {
      errorLine('No project linked. Run `envshare init` first.');
      process.exit(1);
    }

    const pushCfg = readPushConfig();
    const root = process.cwd();

    let filePaths: string[];
    if (file) {
      filePaths = [file];
    } else {
      filePaths = findEnvFiles(root, pushCfg);
      if (!filePaths.length) filePaths = [pushCfg.defaultFile];
    }

    sectionHeader(`Push · ${link.projectName}`);

    // ── Dry run ───────────────────────────────────────────────────────────────
    if (opts.dryRun) {
      for (const fp of filePaths) {
        const absPath = join(root, fp);
        if (!existsSync(absPath)) { warnLine(`skipped: ${fp} (not found)`); continue; }
        const entries = loadEntries(absPath, pushCfg);
        if (!entries.length) { dimLine(`${fp}: no variables`); continue; }
        const shared   = entries.filter(e => e.isShared);
        const personal = entries.filter(e => !e.isShared);
        console.log(chalk.bold(`  ${fp}`));
        if (shared.length)   console.log(chalk.dim(`    shared   (${shared.length}): ${shared.map(e => e.key).join(', ')}`));
        if (personal.length) console.log(chalk.dim(`    personal (${personal.length}): ${personal.map(e => e.key).join(', ')}`));
      }
      console.log();
      return;
    }

    // ── --all / --yes: push every file in parallel without prompts ───────────
    if (opts.all) {
      const loaded = filePaths
        .map(fp => {
          const absPath = join(root, fp);
          if (!existsSync(absPath)) { warnLine(`skipped: ${fp} (not found)`); return null; }
          const entries = loadEntries(absPath, pushCfg);
          if (!entries.length) { dimLine(`${fp}: no variables`); return null; }
          return { fp, entries };
        })
        .filter((x): x is { fp: string; entries: LoadedEntry[] } => x !== null);

      const results = await Promise.allSettled(
        loaded.map(async ({ fp, entries }) => ({
          fp,
          totals: await pushSecrets(link.projectId, fp, entries, opts.env),
        })),
      );

      let failed = 0;
      for (const r of results) {
        if (r.status === 'fulfilled') {
          const { fp, totals } = r.value;
          const parts = summaryParts(totals);
          successLine(`${chalk.cyan(fp)}` + chalk.dim(parts.length ? `  —  ${parts.join(', ')}` : ''));
        } else {
          const err = r.reason instanceof ApiError ? r.reason.message : 'unexpected error';
          errorLine(err);
          failed++;
        }
      }
      console.log();
      if (failed) process.exit(1);
      return;
    }

    // ── Interactive flow ──────────────────────────────────────────────────────
    const chosen = await selectEnvFile(filePaths, pushCfg, root);
    if (!chosen) { warnLine('Aborted.'); process.exit(0); }

    const { path: chosenFile, entries } = chosen!;
    if (!entries.length) {
      dimLine(`No variables to push in ${chosenFile}`);
      console.log();
      process.exit(0);
    }

    const shared   = entries.filter(e => e.isShared);
    const personal = entries.filter(e => !e.isShared);

    const choices = [
      ...shared.map(e => ({ name: e.key, value: e.key, checked: true, group: 'shared' })),
      ...personal.map(e => ({ name: e.key, value: e.key, checked: true, group: 'personal' })),
    ];

    const selectedKeys = await paginatedCheckbox('Select variables to push', choices, 18);
    if (!selectedKeys.length) { warnLine('Aborted.'); process.exit(0); }

    const selectedSet = new Set(selectedKeys);
    const selected = entries.filter(e => selectedSet.has(e.key));

    console.log();
    try {
      const totals = await pushSecrets(
        link.projectId,
        chosenFile,
        selected,
        opts.env,
        (done, total) => process.stdout.write(`\r  ${bar(done, total)}  ${done}/${total}`),
      );
      process.stdout.write('\r\x1b[K'); // clear progress line
      const parts = summaryParts(totals);
      successLine(
        `Pushed ${chalk.bold(String(selected.length))} variables` +
        (parts.length ? chalk.dim('  —  ') + parts.join(chalk.dim(', ')) : ''),
      );
    } catch (err) {
      process.stdout.write('\r\x1b[K');
      if (err instanceof ApiError) errorLine(err.message);
      else errorLine('Unexpected error');
      process.exit(1);
    }

    console.log();
  });
