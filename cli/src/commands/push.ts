import { Command } from 'commander';
import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';
import chalk from 'chalk';
import ora from 'ora';
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

/** Recursively find all .env files under a directory, skipping node_modules/.git */
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
    if (stat.isDirectory()) {
      results.push(...findEnvFiles(abs, root, depth + 1));
    } else if (name === '.env') {
      results.push(relative(root, abs));
    }
  }
  return results;
}

/** Parse and filter entries from a .env file, applying push config rules */
function loadEntries(absPath: string, pushCfg: ReturnType<typeof readPushConfig>) {
  let entries = parseDotenv(readFileSync(absPath, 'utf-8'));
  entries = entries
    .filter(e => !isIgnored(e.key, pushCfg))
    .map(e => ({ ...e, isShared: e.isShared || isAutoShared(e.key, pushCfg) }));
  return entries;
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

  const { file } = await prompts({
    type: 'select',
    name: 'file',
    message: 'Which .env file do you want to push?',
    choices,
  });
  return file ?? null;
}

async function selectVariables(
  entries: { key: string; value: string; isShared: boolean }[],
): Promise<{ key: string; value: string; isShared: boolean }[]> {
  if (!entries.length) return [];

  const shared   = entries.filter(e => e.isShared);
  const personal = entries.filter(e => !e.isShared);

  const choices = [
    ...shared.map(e => ({ name: e.key, value: e.key, checked: true, group: 'shared' })),
    ...personal.map(e => ({ name: e.key, value: e.key, checked: true, group: 'personal' })),
  ];

  const selected = await paginatedCheckbox(
    'Select variables to push',
    choices,
    18,
  );

  if (!selected.length) return [];
  const selectedSet = new Set<string>(selected);
  return entries.filter(e => selectedSet.has(e.key));
}

async function pushEntries(
  filePath: string,
  projectId: string,
  entries: { key: string; value: string; isShared: boolean }[],
  environmentName?: string,
): Promise<void> {
  const { result } = await api.post<{ result: { created: string[]; updated: string[]; sharedUpdated: string[] } }>(
    `/sync/${projectId}/push`,
    { secrets: entries, filePath, environmentName },
  );

  const personal = entries.filter(e => !e.isShared);
  const parts: string[] = [];
  if (result.created.length)       parts.push(`+${result.created.length} new`);
  if (result.sharedUpdated.length) parts.push(`${result.sharedUpdated.length} shared`);
  if (personal.length)             parts.push(`${personal.length} personal`);

  console.log(
    chalk.green(`  ✔ ${filePath}`) +
    chalk.dim(` — ${parts.join(', ') || `${entries.length} vars`}`),
  );
}

export const pushCommand = new Command('push')
  .description('Upload .env variables to the project (interactive selection)')
  .argument('[file]', '.env file to push')
  .option('--all', 'Push all variables without interactive selection')
  .option('--yes', 'Non-interactive: push all variables without prompts (alias for --all, useful in CI)')
  .option('--env <name>', 'Tag secrets with this environment name (e.g. staging, production)')
  .option('--dry-run', 'Preview what would be pushed without sending')
  .action(async (file: string | undefined, opts) => {
    // --yes is an alias for --all (CI-friendly flag name)
    if (opts.yes) opts.all = true;
    const link = readProjectLink();
    if (!link) {
      console.error(chalk.red('  No project linked. Run `envshare init` first.'));
      process.exit(1);
    }

    const pushCfg = readPushConfig();
    const root = process.cwd();

    // ── Collect candidate files ───────────────────────────────────────────────
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
        if (!entries.length) { console.log(chalk.dim(`  ${fp}: no variables to push`)); continue; }
        const shared   = entries.filter(e => e.isShared);
        const personal = entries.filter(e => !e.isShared);
        console.log(chalk.bold(`  ${fp}`));
        if (shared.length)   console.log(chalk.dim(`    shared   (${shared.length}): ${shared.map(e => e.key).join(', ')}`));
        if (personal.length) console.log(chalk.dim(`    personal (${personal.length}): ${personal.map(e => e.key).join(', ')}`));
      }
      console.log();
      return;
    }

    // ── Interactive: pick file if multiple ────────────────────────────────────
    let chosenFile: string | null;
    if (opts.all) {
      // Push all files non-interactively
      let pushed = 0, failed = 0;
      for (const fp of filePaths) {
        const absPath = join(root, fp);
        if (!existsSync(absPath)) { console.log(chalk.yellow(`  ⚠ skipped: ${fp} (not found)`)); continue; }
        const entries = loadEntries(absPath, pushCfg);
        if (!entries.length) { console.log(chalk.dim(`  ${fp}: no variables to push`)); continue; }
        const spinner = ora({ text: `Pushing ${fp}…` }).start();
        try {
          await pushEntries(fp, link.projectId, entries, opts.env);
          spinner.stop();
          pushed++;
        } catch (err) {
          spinner.stop();
          if (err instanceof ApiError) console.error(chalk.red(`  ✗ ${fp}: ${err.message}`));
          else console.error(chalk.red(`  ✗ ${fp}: unexpected error`));
          failed++;
        }
      }
      if (filePaths.length > 1) {
        console.log();
        if (failed) console.log(chalk.yellow(`  ${pushed} pushed, ${failed} failed`));
        else        console.log(chalk.dim(`  ${pushed} file${pushed !== 1 ? 's' : ''} pushed to ${link.projectName}`));
      }
      console.log();
      if (failed) process.exit(1);
      return;
    }

    // ── Interactive flow ──────────────────────────────────────────────────────
    chosenFile = await selectEnvFile(filePaths, pushCfg, root);
    if (!chosenFile) { console.log(chalk.yellow('  Aborted.')); process.exit(0); }

    const absPath = join(root, chosenFile);
    if (!existsSync(absPath)) {
      console.error(chalk.red(`  File not found: ${chosenFile}`));
      process.exit(1);
    }

    const allEntries = loadEntries(absPath, pushCfg);
    if (!allEntries.length) {
      console.log(chalk.dim(`  No variables to push in ${chosenFile}`));
      console.log();
      process.exit(0);
    }

    console.log(chalk.dim(`  Found ${allEntries.length} variable${allEntries.length !== 1 ? 's' : ''} in ${chosenFile}\n`));

    // Let user pick which variables to push
    const selected = await selectVariables(allEntries);
    if (!selected.length) { console.log(chalk.yellow('\n  Nothing selected. Aborted.')); process.exit(0); }

    console.log();
    const spinner = ora({ text: `Pushing ${selected.length} variable${selected.length !== 1 ? 's' : ''}…` }).start();
    try {
      await pushEntries(chosenFile, link.projectId, selected, opts.env);
      spinner.stop();
    } catch (err) {
      spinner.stop();
      if (err instanceof ApiError) console.error(chalk.red(`  ✗ ${err.message}`));
      else console.error(chalk.red('  ✗ Unexpected error'));
      process.exit(1);
    }

    console.log();
  });
