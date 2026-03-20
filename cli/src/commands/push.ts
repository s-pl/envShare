import { Command } from 'commander';
import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';
import chalk from 'chalk';
import prompts from 'prompts';
import { paginatedCheckbox } from '../utils/paginatedCheckbox.js';
import { api, ApiError } from '../api.js';
import { readProjectLink, readPushConfig, isAutoShared, isIgnored } from '../config.js';

export function parseDotenv(content: string): { key: string; value: string; isShared: boolean }[] {
  const entries: { key: string; value: string; isShared: boolean }[] = [];
  for (const raw of content.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eqIdx = line.indexOf('=');
    if (eqIdx === -1) continue;
    const key = line.slice(0, eqIdx).trim();
    const rest = line.slice(eqIdx + 1);
    const sharedMatch = rest.match(/#\s*@shared/i);
    const isShared = sharedMatch !== null;
    let value = isShared ? rest.slice(0, sharedMatch!.index).trim() : rest.trim();
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (key) entries.push({ key, value, isShared });
  }
  return entries;
}

function findEnvFiles(dir: string, root: string, depth = 0): string[] {
  if (depth > 6) return [];
  const results: string[] = [];
  let entries: string[];
  try { entries = readdirSync(dir); } catch { return []; }
  for (const name of entries) {
    if (name === 'node_modules' || name === '.git' || name === 'dist' || name === 'build') continue;
    const abs = join(dir, name);
    let stat;
    try { stat = statSync(abs); } catch { continue; }
    if (stat.isDirectory()) results.push(...findEnvFiles(abs, root, depth + 1));
    else if (name === '.env') results.push(relative(root, abs));
  }
  return results;
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
      return { title: `${fp}  ${chalk.dim(`(${count} vars)`)}`, value: fp };
    });
  if (!choices.length) return null;
  const { file } = await prompts({ type: 'select', name: 'file', message: 'Which .env file?', choices });
  return file ?? null;
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

  process.stdout.write('\r\x1b[K'); // clear progress line
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
      filePaths = findEnvFiles(root, root);
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
          const parts = [`+${t.created} new`, `${t.updated} updated`].filter(Boolean);
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
