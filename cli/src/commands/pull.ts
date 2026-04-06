/**
 * envshare pull
 * Downloads secrets and writes each environment to its correct file path.
 * Secrets with no environment default to .env (or the --output file).
 */
import { Command } from 'commander';
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname, resolve, sep } from 'path';
import chalk from 'chalk';
import { api, ApiError } from '../api.js';
import { readProjectLink } from '../config.js';
import { sectionHeader, successLine } from '../utils/brand.js';

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
      ? `  # ⚠ pending — run: envshare set ${s.key} "your-value"`
      : '';
    lines.push(`${s.key}=${s.value || ''}${tag}${warn}`);
  }

  return lines.join('\n') + '\n';
}

export const pullCommand = new Command('pull')
  .description('Download secrets and write .env files to their correct paths')
  .option('-o, --output <file>', 'Write all secrets to a single file (ignores environment paths)')
  .option('--all', 'Write each environment to its own file path (default when no --output)')
  .option('--env <name>', 'Only pull secrets for this environment (e.g. staging)')
  .action(async (opts) => {
    const link = readProjectLink();
    if (!link) {
      console.error(chalk.red('  No project linked. Run `envshare init` first.'));
      process.exit(1);
    }

    sectionHeader(`Pull · ${link.projectName}`);

    process.stdout.write(chalk.dim('  Downloading secrets...\n'));

    try {
      const pullUrl = opts.env
        ? `/sync/${link.projectId}/pull?env=${encodeURIComponent(opts.env)}`
        : `/sync/${link.projectId}/pull`;
      let { secrets } = await api.get<{ secrets: PulledSecret[] }>(pullUrl);

      // Client-side filter if backend doesn't support ?env yet
      if (opts.env) {
        secrets = secrets.filter(s => s.environmentName === opts.env);
      }

      if (opts.output) {
        // Legacy / single-file mode: write everything to --output
        const content = buildEnvFile(secrets, link.projectName);
        const outputPath = resolve(process.cwd(), opts.output);
        const cwd = process.cwd();
        if (!outputPath.startsWith(cwd + sep) && outputPath !== cwd) {
          console.error(chalk.red(`  Refusing to write outside project directory: ${opts.output}`));
          process.exit(1);
        }
        writeFileSync(outputPath, content, { mode: 0o600 });
        successLine(`Wrote ${chalk.bold(String(secrets.length))} variables to ${chalk.cyan(opts.output)}`);
      } else {
        // Multi-env mode: group by filePath and write each to the correct location
        const groups = new Map<string, PulledSecret[]>();
        for (const s of secrets) {
          const fp = s.filePath || '.env';
          if (!groups.has(fp)) groups.set(fp, []);
          groups.get(fp)!.push(s);
        }

        const cwd = process.cwd();
        let totalWritten = 0;
        for (const [filePath, group] of groups) {
          const absPath = resolve(cwd, filePath);
          if (!absPath.startsWith(cwd + sep) && absPath !== cwd) {
            console.error(chalk.red(`  Refusing to write outside project directory: ${filePath}`));
            continue;
          }
          const content = buildEnvFile(group, link.projectName);
          mkdirSync(dirname(absPath), { recursive: true });
          writeFileSync(absPath, content, { mode: 0o600 });
          successLine(`${chalk.cyan(filePath)}` + chalk.dim(` (${group.length} variables)`));
          totalWritten += group.length;
        }
        console.log(chalk.dim(`\n  Total: ${totalWritten} variables across ${groups.size} file${groups.size !== 1 ? 's' : ''}`));
      }

      const pending = secrets.filter(s => !s.isShared && !s.hasPersonalValue);
      if (pending.length) {
        console.log(chalk.yellow(`\n  ⚠  ${pending.length} variable(s) need your personal value:`));
        pending.forEach(s => console.log(chalk.dim(`     envshare set ${s.key} "your-value"`)));
      }

      console.log();
    } catch (err) {
      if (err instanceof ApiError) { console.error(chalk.red(`  Error: ${err.message}`)); }
      else throw err;
      process.exit(1);
    }
  });
