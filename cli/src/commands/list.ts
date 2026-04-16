import { Command } from 'commander';
import chalk from 'chalk';
import { api, ApiError } from '../api.js';
import { readProjectLink } from '../config.js';

interface SecretMeta {
  id: string;
  key: string;
  isShared: boolean;
  hasPersonalValue: boolean;
  comment?: string | null;
  version: number;
  updatedAt: string;
}

export const listCommand = new Command('list')
  .alias('ls')
  .description('List all secret keys in the linked project (values are never shown)')
  .option('--json', 'Output as machine-readable JSON')
  .addHelpText('after', `
Examples:
  $ envshare list               Table view with key, type, version, status
  $ envshare ls                 Same (alias)
  $ envshare list --json        JSON output for scripting / CI pipelines`)
  .action(async (opts) => {
    const link = readProjectLink();
    if (!link) {
      console.error(chalk.red('  No project linked. Run `envshare init` first.'));
      process.exit(1);
    }

    try {
      const { secrets } = await api.get<{ secrets: SecretMeta[] }>(`/secrets/${link.projectId}`);

      if (opts.json) {
        console.log(JSON.stringify(secrets.map(s => ({
          key: s.key,
          type: s.isShared ? 'shared' : 'personal',
          version: s.version,
          hasValue: s.isShared || s.hasPersonalValue,
          updatedAt: s.updatedAt,
        })), null, 2));
        return;
      }

      if (!secrets.length) {
        console.log(chalk.dim(`\n  No secrets in ${link.projectName}\n`));
        return;
      }

      console.log(chalk.bold(`\n  ${link.projectName}  —  ${secrets.length} secret${secrets.length !== 1 ? 's' : ''}\n`));
      console.log(chalk.dim('  ' + 'KEY'.padEnd(35) + 'TYPE'.padEnd(12) + 'VER   STATUS'));
      console.log(chalk.dim('  ' + '─'.repeat(64)));

      for (const s of secrets) {
        const type = s.isShared ? chalk.blue('shared') : chalk.dim('personal');
        const hasVal = s.isShared || s.hasPersonalValue;
        const status = hasVal ? chalk.green('set') : chalk.yellow('⚠ missing');
        console.log(`  ${s.key.padEnd(35)}${String(s.isShared ? 'shared' : 'personal').padEnd(12)}v${s.version}    ${status}`);
      }

      const pending = secrets.filter(s => !s.isShared && !s.hasPersonalValue);
      if (pending.length) {
        console.log(chalk.yellow(`\n  ${pending.length} secret(s) need your personal value:`));
        pending.forEach(s => console.log(chalk.dim(`    envshare set ${s.key} "your-value"`)));
      }
      console.log();
    } catch (err) {
      if (err instanceof ApiError) { console.error(chalk.red(`  Error: ${err.message}`)); process.exit(1); }
      throw err;
    }
  });
