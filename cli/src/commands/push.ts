import { Command } from 'commander';
import { readFileSync, existsSync, readdirSync, lstatSync, realpathSync } from 'fs';
import { join, relative } from 'path';
import chalk from 'chalk';
import { paginatedCheckbox } from '../utils/paginatedCheckbox.js';
import { paginatedSelect } from '../utils/paginatedSelect.js';
import { api, ApiError } from '../api.js';
import { readProjectLink, readPushConfig, isAutoShared, isIgnored } from '../config.js';
import { parseDotenv } from '../utils/parseDotenv.js';

export { parseDotenv };

/**
 * Matches .env and .env.<environment> (single word: local, production, staging, etc.)
 * Does NOT match .env.template, .env.example, .env.test.bad, etc.
 */
const ENV_FILE_RE = /^\.env(\.[a-zA-Z0-9_-]+)?$/;
const ENV_EXCLUDE = new Set(['.env.example', '.env.template', '.env.sample', '.env.bak', '.env.backup']);

const SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', '.cache', 'coverage',
  'tmp', '.next', 'out', '.venv', 'venv', '__pycache__', '.idea',
  '.vscode', 'vendor', '.terraform', '.docker', '.turbo', '.nuxt',
  '.output', '.svelte-kit', 'target', 'bin', 'obj', 'docker',
]);

/**
 * Find .env files recursively throughout the project.
 * Skips common non-project directories, symlinks, and dot-directories.
 * Deduplicates by resolved real path to prevent the same file appearing twice.
 */
export function findEnvFiles(root: string): string[] {
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
        // Deduplicate by real path (handles hardlinks, bind mounts, etc.)
        const real = safeRealpath(abs);
        if (real && !seenRealPaths.has(real)) {
          seenRealPaths.add(real);
          results.push(relative(root, abs).replace(/\\/g, '/'));
        }
      } else if (lst.isDirectory() && !SKIP_DIRS.has(name) && !name.startsWith('.')) {
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

function loadEntries(absPath: string, pushCfg: ReturnType<typeof readPushConfig>) {
  let entries = parseDotenv(readFileSync(absPath, 'utf-8'));
  return entries
    .filter(e => !isIgnored(e.key, pushCfg))
    .map(e => ({ ...e, isShared: e.isShared || isAutoShared(e.key, pushCfg) }));
}

async function selectEnvFile(filePaths: string[], pushCfg: ReturnType<typeof readPushConfig>, root: string): Promise<string | null> {
  if (filePaths.length === 1) return filePaths[0];
  const choices = filePaths
    .filter(fp => existsSync(join(root, fp)))
    .map(fp => {
      const count = loadEntries(join(root, fp), pushCfg).length;
      return { title: `${fp}  (${count} vars)`, value: fp };
    });
  if (!choices.length) return null;
  return paginatedSelect('Which .env file?', choices);
}

const BATCH_SIZE = 10;

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function bar(done: number, total: number, width = 24): string {
  const filled = Math.round((done / total) * width);
  return chalk.green('█'.repeat(filled)) + chalk.dim('░'.repeat(width - filled));
}

async function pushWithProgress(
  filePath: string,
  projectId: string,
  entries: { key: string; value: string; isShared: boolean }[],
  environmentName?: string,
): Promise<{ created: number; updated: number; shared: number }> {
  const batches = chunk(entries, BATCH_SIZE);
  let done = 0;
  const totals = { created: 0, updated: 0, shared: 0 };

  try {
    for (const batch of batches) {
      const { result } = await api.post<{ result: { created: string[]; updated: string[]; sharedUpdated: string[] } }>(
        `/sync/${projectId}/push`,
        { secrets: batch, filePath, environmentName },
      );
      done += batch.length;
      totals.created += result.created.length;
      totals.updated += result.updated.length;
      totals.shared  += result.sharedUpdated.length;

      process.stdout.write(`\r  ${bar(done, entries.length)}  ${done}/${entries.length}`);
    }
  } finally {
    process.stdout.write('\r\x1b[K'); // clear progress line
  }

  return totals;
}

export const pushCommand = new Command('push')
  .description('Upload .env variables to the project')
  .argument('[file]', '.env file to push')
  .option('--all', 'Push all variables without confirmation prompt')
  .option('--yes', 'Alias for --all, useful in CI')
  .option('--env <name>', 'Tag secrets with this environment name (e.g. staging)')
  .option('--dry-run', 'Preview what would be pushed without sending')
  .action(async (file: string | undefined, opts) => {
    if (opts.yes) opts.all = true;

    const link = readProjectLink();
    if (!link) {
      console.error(chalk.red('  No project linked. Run `envshare init` first.'));
      process.exit(1);
    }

    const pushCfg = readPushConfig();
    const root = process.cwd();

    let filePaths: string[];
    if (file) {
      filePaths = [file];
    } else {
      filePaths = findEnvFiles(root);
      if (!filePaths.length) filePaths = [pushCfg.defaultFile];
    }

    console.log(chalk.bold(`\n  Push to ${link.projectName}\n`));

    // ── Dry run ───────────────────────────────────────────────────────────────
    if (opts.dryRun) {
      for (const fp of filePaths) {
        const absPath = join(root, fp);
        if (!existsSync(absPath)) { console.log(chalk.yellow(`  ⚠ skipped: ${fp} (not found)`)); continue; }
        const entries = loadEntries(absPath, pushCfg);
        if (!entries.length) { console.log(chalk.dim(`  ${fp}: no variables`)); continue; }
        const shared   = entries.filter(e => e.isShared);
        const personal = entries.filter(e => !e.isShared);
        console.log(chalk.bold(`  ${fp}`));
        if (shared.length)   console.log(chalk.dim(`    shared   (${shared.length}): ${shared.map(e => e.key).join(', ')}`));
        if (personal.length) console.log(chalk.dim(`    personal (${personal.length}): ${personal.map(e => e.key).join(', ')}`));
      }
      console.log();
      return;
    }

    // ── --all / --yes: push every file without prompts ────────────────────────
    if (opts.all) {
      let pushed = 0, failed = 0;
      for (const fp of filePaths) {
        const absPath = join(root, fp);
        if (!existsSync(absPath)) { console.log(chalk.yellow(`  ⚠ skipped: ${fp} (not found)`)); continue; }
        const entries = loadEntries(absPath, pushCfg);
        if (!entries.length) { console.log(chalk.dim(`  ${fp}: no variables`)); continue; }
        process.stdout.write(`  ${fp}  (${entries.length} vars)\n`);
        try {
          const t = await pushWithProgress(fp, link.projectId, entries, opts.env);
          const parts: string[] = [];
          if (t.created) parts.push(`+${t.created} new`);
          if (t.updated) parts.push(`${t.updated} updated`);
          if (t.shared)  parts.push(`${t.shared} shared`);
          console.log(chalk.green(`  ✔ ${fp}`) + chalk.dim(`  —  ${parts.join(', ')}`));
          pushed++;
        } catch (err) {
          if (err instanceof ApiError) console.error(chalk.red(`  ✗ ${fp}: ${err.message}`));
          else console.error(chalk.red(`  ✗ ${fp}: unexpected error`));
          failed++;
        }
      }
      console.log();
      if (failed) process.exit(1);
      return;
    }

    // ── Interactive flow ──────────────────────────────────────────────────────
    const chosenFile = await selectEnvFile(filePaths, pushCfg, root);
    if (!chosenFile) { console.log(chalk.yellow('  Aborted.')); process.exit(0); }

    const absPath = join(root, chosenFile);
    if (!existsSync(absPath)) {
      console.error(chalk.red(`  File not found: ${chosenFile}`));
      process.exit(1);
    }

    const entries = loadEntries(absPath, pushCfg);
    if (!entries.length) {
      console.log(chalk.dim(`  No variables to push in ${chosenFile}\n`));
      process.exit(0);
    }

    const shared   = entries.filter(e => e.isShared);
    const personal = entries.filter(e => !e.isShared);

    const choices = [
      ...shared.map(e => ({ name: e.key, value: e.key, checked: true, group: 'shared' })),
      ...personal.map(e => ({ name: e.key, value: e.key, checked: true, group: 'personal' })),
    ];

    const selectedKeys = await paginatedCheckbox('Select variables to push', choices, 18);
    if (!selectedKeys.length) { console.log(chalk.dim('  Aborted.')); process.exit(0); }

    const selectedSet = new Set(selectedKeys);
    const selected = entries.filter(e => selectedSet.has(e.key));

    console.log();
    try {
      const t = await pushWithProgress(chosenFile, link.projectId, selected, opts.env);
      const parts: string[] = [];
      if (t.created) parts.push(chalk.green(`+${t.created} new`));
      if (t.updated) parts.push(`${t.updated} updated`);
      if (t.shared)  parts.push(chalk.blue(`${t.shared} shared`));
      console.log(chalk.green(`  ✔ Pushed ${selected.length} variables`) + (parts.length ? chalk.dim(`  —  `) + parts.join(chalk.dim(', ')) : ''));
    } catch (err) {
      if (err instanceof ApiError) console.error(chalk.red(`  ✗ ${err.message}`));
      else console.error(chalk.red('  ✗ Unexpected error'));
      process.exit(1);
    }

    console.log();
  });
