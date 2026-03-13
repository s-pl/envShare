/**
 * esai pull
 * Descarga los secretos del proyecto y escribe el .env.
 * Variables shared → valor del servidor (igual para todos).
 * Variables personales → tu valor personal (o vacío si no lo has seteado).
 */
import { Command } from 'commander';
import { writeFileSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';
import ora from 'ora';
import { api, ApiError } from '../api.js';
import { readProjectLink } from '../config.js';

export const pullCommand = new Command('pull')
  .description('Download secrets and write .env')
  .option('-o, --output <file>', 'Output file', '.env')
  .action(async (opts) => {
    const link = readProjectLink();
    if (!link) {
      console.error(chalk.red('  No project linked. Run `esai init` first.'));
      process.exit(1);
    }

    const spinner = ora(`Pulling secrets for ${link.projectName}...`).start();

    try {
      const { secrets } = await api.get<{ secrets: any[] }>(`/sync/${link.projectId}/pull`);
      spinner.stop();

      const pending = secrets.filter(s => !s.isShared && !s.hasPersonalValue);
      const lines: string[] = [
        `# envShare — ${link.projectName}`,
        `# Generated: ${new Date().toISOString()}`,
        `# Variables: ${secrets.length} (${secrets.filter((s: any) => s.isShared).length} shared, ${secrets.filter((s: any) => !s.isShared).length} personal)`,
        `# 🌐 @shared = same value for all team members`,
        `# ⚠  pending = you need to set your own value`,
        '',
      ];

      for (const s of secrets) {
        const version = s.version ? `  # v${s.version}` : '';
        const tag     = s.isShared ? `  # @shared${version}` : version;
        const warn    = !s.isShared && !s.hasPersonalValue ? '  # ⚠ pending — run: esai set ' + s.key + ' "your-value"' : '';
        const value   = s.value || '';
        lines.push(`${s.key}=${value}${tag}${warn}`);
      }

      const outputPath = join(process.cwd(), opts.output);
      writeFileSync(outputPath, lines.join('\n') + '\n', { mode: 0o600 });

      console.log(chalk.green(`  ✔ Wrote ${secrets.length} variables to ${opts.output}`));
      if (pending.length) {
        console.log(chalk.yellow(`  ⚠  ${pending.length} variable(s) need your value:`));
        pending.forEach(s => console.log(chalk.dim(`     esai set ${s.key} "your-value"`)));
      }
      console.log();
    } catch (err) {
      spinner.fail();
      if (err instanceof ApiError) { console.error(chalk.red(`  Error: ${err.message}`)); }
      else throw err;
      process.exit(1);
    }
  });
