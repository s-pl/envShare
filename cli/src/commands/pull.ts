/**
 * esai pull
 * Downloads secrets and writes each environment to its correct file path.
 * Secrets with no environment default to .env (or the --output file).
 */
import { Command } from 'commander';
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import chalk from 'chalk';
import ora from 'ora';
import { api, ApiError } from '../api.js';
import { readProjectLink } from '../config.js';

interface PulledSecret {
  key: string;
  value: string;
  isShared: boolean;
  hasPersonalValue: boolean;
  version?: number;
  filePath: string;
  environmentName: string;
}

function buildEnvFile(secrets: PulledSecret[], projectName: string): string {
  const lines: string[] = [
    `# envShare — ${projectName}`,
    `# Generated: ${new Date().toISOString()}`,
    `# Variables: ${secrets.length} (${secrets.filter(s => s.isShared).length} shared, ${secrets.filter(s => !s.isShared).length} personal)`,
    '',
  ];

  for (const s of secrets) {
    const version = s.version ? `  # v${s.version}` : '';
    const tag     = s.isShared ? `  # @shared${version}` : version;
    const warn    = !s.isShared && !s.hasPersonalValue
      ? `  # ⚠ pending — run: esai set ${s.key} "your-value"`
      : '';
    lines.push(`${s.key}=${s.value || ''}${tag}${warn}`);
  }

  return lines.join('\n') + '\n';
}

export const pullCommand = new Command('pull')
  .description('Download secrets and write .env files to their correct paths')
  .option('-o, --output <file>', 'Write all secrets to a single file (ignores environment paths)')
  .option('--all', 'Write each environment to its own file path (default when no --output)')
  .action(async (opts) => {
    const link = readProjectLink();
    if (!link) {
      console.error(chalk.red('  No project linked. Run `esai init` first.'));
      process.exit(1);
    }

    const spinner = ora(`Pulling secrets for ${link.projectName}...`).start();

    try {
      const { secrets } = await api.get<{ secrets: PulledSecret[] }>(`/sync/${link.projectId}/pull`);
      spinner.stop();

      if (opts.output) {
        // Legacy / single-file mode: write everything to --output
        const content = buildEnvFile(secrets, link.projectName);
        const outputPath = join(process.cwd(), opts.output);
        writeFileSync(outputPath, content, { mode: 0o600 });
        console.log(chalk.green(`  ✔ Wrote ${secrets.length} variables to ${opts.output}`));
      } else {
        // Multi-env mode: group by filePath and write each to the correct location
        const groups = new Map<string, PulledSecret[]>();
        for (const s of secrets) {
          const fp = s.filePath || '.env';
          if (!groups.has(fp)) groups.set(fp, []);
          groups.get(fp)!.push(s);
        }

        let totalWritten = 0;
        for (const [filePath, group] of groups) {
          const content = buildEnvFile(group, link.projectName);
          const absPath = join(process.cwd(), filePath);
          mkdirSync(dirname(absPath), { recursive: true });
          writeFileSync(absPath, content, { mode: 0o600 });
          console.log(chalk.green(`  ✔ ${filePath}`) + chalk.dim(` (${group.length} variables)`));
          totalWritten += group.length;
        }
        console.log(chalk.dim(`\n  Total: ${totalWritten} variables across ${groups.size} file${groups.size !== 1 ? 's' : ''}`));
      }

      const pending = secrets.filter(s => !s.isShared && !s.hasPersonalValue);
      if (pending.length) {
        console.log(chalk.yellow(`\n  ⚠  ${pending.length} variable(s) need your personal value:`));
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
