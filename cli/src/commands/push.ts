import { Command } from 'commander';
import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, relative, dirname } from 'path';
import chalk from 'chalk';
import ora from 'ora';
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

async function pushFile(
  filePath: string,
  absPath: string,
  projectId: string,
  projectName: string,
  pushCfg: ReturnType<typeof readPushConfig>,
  dryRun: boolean,
): Promise<boolean> {
  let entries = parseDotenv(readFileSync(absPath, 'utf-8'));
  const ignored = entries.filter(e => isIgnored(e.key, pushCfg));
  entries = entries
    .filter(e => !isIgnored(e.key, pushCfg))
    .map(e => ({ ...e, isShared: e.isShared || isAutoShared(e.key, pushCfg) }));

  if (!entries.length) {
    console.log(chalk.dim(`  ${filePath}: no variables to push`));
    return false;
  }

  const shared   = entries.filter(e => e.isShared);
  const personal = entries.filter(e => !e.isShared);

  if (dryRun) {
    console.log(chalk.bold(`  ${filePath}`));
    if (ignored.length)  console.log(chalk.dim(`    ignored  (${ignored.length}): ${ignored.map(e => e.key).join(', ')}`));
    if (shared.length)   console.log(chalk.dim(`    shared   (${shared.length}): ${shared.map(e => e.key).join(', ')}`));
    if (personal.length) console.log(chalk.dim(`    personal (${personal.length}): ${personal.map(e => e.key).join(', ')}`));
    return true;
  }

  const { result } = await api.post<{ result: { created: string[]; updated: string[]; sharedUpdated: string[] } }>(
    `/sync/${projectId}/push`,
    { secrets: entries, filePath },
  );

  const parts: string[] = [];
  if (result.created.length)      parts.push(`+${result.created.length} new`);
  if (result.sharedUpdated.length) parts.push(`${result.sharedUpdated.length} shared`);
  if (personal.length)             parts.push(`${personal.length} personal`);

  console.log(
    chalk.green(`  ✔ ${filePath}`) +
    chalk.dim(` — ${parts.join(', ') || `${entries.length} vars`}`),
  );
  return true;
}

export const pushCommand = new Command('push')
  .description('Upload .env file(s) to the project')
  .argument('[file]', '.env file to push. Omit with --all to push every .env in the project.')
  .option('--all', 'Discover and push every .env file found in the project tree')
  .option('--dry-run', 'Preview what would be pushed without sending')
  .action(async (file: string | undefined, opts) => {
    const link = readProjectLink();
    if (!link) {
      console.error(chalk.red('  No project linked. Run `esai init` first.'));
      process.exit(1);
    }

    const pushCfg = readPushConfig();
    const root = process.cwd();

    // ── Collect the list of files to push ────────────────────────────────────
    let filePaths: string[];

    if (opts.all || !file) {
      // Auto-discover all .env files in the project tree
      filePaths = findEnvFiles(root, root);

      if (!filePaths.length) {
        // Fall back to defaultFile if nothing found
        filePaths = [pushCfg.defaultFile];
      }
    } else {
      filePaths = [file];
    }

    // ── Dry run header ────────────────────────────────────────────────────────
    if (opts.dryRun) {
      console.log(chalk.bold(`\n  Dry run → ${link.projectName} (${filePaths.length} file${filePaths.length !== 1 ? 's' : ''})\n`));
    }

    // ── Push each file ────────────────────────────────────────────────────────
    let pushed = 0;
    let failed = 0;

    for (const fp of filePaths) {
      const absPath = join(root, fp);
      if (!existsSync(absPath)) {
        console.log(chalk.yellow(`  ⚠ skipped: ${fp} (not found)`));
        continue;
      }

      if (!opts.dryRun) {
        const spinner = ora({ text: `Pushing ${fp}…`, prefixText: '' }).start();
        try {
          await pushFile(fp, absPath, link.projectId, link.projectName, pushCfg, false);
          spinner.stop();
          pushed++;
        } catch (err) {
          spinner.stop();
          if (err instanceof ApiError) {
            console.error(chalk.red(`  ✗ ${fp}: ${err.message}`));
          } else {
            console.error(chalk.red(`  ✗ ${fp}: unexpected error`));
          }
          failed++;
        }
      } else {
        const ok = await pushFile(fp, absPath, link.projectId, link.projectName, pushCfg, true);
        if (ok) pushed++;
      }
    }

    // ── Summary ───────────────────────────────────────────────────────────────
    if (!opts.dryRun && filePaths.length > 1) {
      console.log();
      if (failed) {
        console.log(chalk.yellow(`  ${pushed} pushed, ${failed} failed`));
      } else {
        console.log(chalk.dim(`  ${pushed} file${pushed !== 1 ? 's' : ''} pushed to ${link.projectName}`));
      }
    }
    console.log();

    if (failed) process.exit(1);
  });
