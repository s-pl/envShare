import { Command } from 'commander';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
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

export const pushCommand = new Command('push')
  .description('Upload a .env file — shared variables sync to the whole team')
  .argument('[file]', '.env file to push (uses defaultFile from .esai.config.json if not set)')
  .option('--dry-run', 'Preview what would be pushed without sending')
  .action(async (file: string | undefined, opts) => {
    const link = readProjectLink();
    if (!link) {
      console.error(chalk.red('  No project linked. Run `esai init` first.'));
      process.exit(1);
    }

    const pushCfg = readPushConfig();
    const targetFile = file ?? pushCfg.defaultFile;
    const filePath = join(process.cwd(), targetFile);

    if (!existsSync(filePath)) {
      console.error(chalk.red(`  File not found: ${targetFile}`));
      process.exit(1);
    }

    let entries = parseDotenv(readFileSync(filePath, 'utf-8'));

    // Apply push config: ignore keys, auto-shared patterns
    const ignored = entries.filter(e => isIgnored(e.key, pushCfg));
    entries = entries.filter(e => !isIgnored(e.key, pushCfg));
    entries = entries.map(e => ({
      ...e,
      isShared: e.isShared || isAutoShared(e.key, pushCfg),
    }));

    if (!entries.length) {
      console.log(chalk.yellow(`  No variables to push in ${targetFile}`));
      process.exit(0);
    }

    const shared   = entries.filter(e => e.isShared);
    const personal = entries.filter(e => !e.isShared);

    if (opts.dryRun) {
      console.log(chalk.bold(`\n  Dry run — ${targetFile} → ${link.projectName}\n`));
      if (ignored.length)  console.log(chalk.dim(`  Ignored (${ignored.length}): ${ignored.map(e => e.key).join(', ')}`));
      if (shared.length)   console.log(chalk.blue(`  Shared  (${shared.length}): ${shared.map(e => e.key).join(', ')}`));
      if (personal.length) console.log(chalk.dim(`  Personal(${personal.length}): ${personal.map(e => e.key).join(', ')}`));
      console.log();
      process.exit(0);
    }

    const spinner = ora(`Pushing ${entries.length} variables to ${link.projectName}...`).start();

    try {
      const { result } = await api.post<{ result: any }>(
        `/sync/${link.projectId}/push`,
        { secrets: entries },
      );
      spinner.stop();

      if (ignored.length)        console.log(chalk.dim(`  Skipped: ${ignored.map(e => e.key).join(', ')}`));
      if (result.created.length) console.log(chalk.green(`  ✔ New keys: `) + result.created.join(', '));
      if (result.sharedUpdated.length) console.log(chalk.blue(`  🌐 Shared: `) + result.sharedUpdated.join(', '));
      if (personal.length)       console.log(chalk.dim(`  ↑ Personal: ${personal.length} value(s) updated`));
      console.log();
    } catch (err) {
      spinner.fail();
      if (err instanceof ApiError) { console.error(chalk.red(`  Error: ${err.message}`)); }
      else throw err;
      process.exit(1);
    }
  });
