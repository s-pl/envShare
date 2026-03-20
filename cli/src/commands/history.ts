import { Command } from 'commander';
import chalk from 'chalk';
import { api, ApiError } from '../api.js';
import { readProjectLink } from '../config.js';

interface VersionView {
  version: number;
  action: string;
  isShared: boolean;
  actor: { email: string; name: string } | null;
  createdAt: string;
  value: string | null;
}

export const historyCommand = new Command('history')
  .description('Show version history for a secret key')
  .argument('<key>', 'Secret key name')
  .action(async (key: string) => {
    const link = readProjectLink();
    if (!link) {
      console.error(chalk.red('  No project linked. Run `envshare init` first.'));
      process.exit(1);
    }

    try {
      const { secrets } = await api.get<{ secrets: { id: string; key: string }[] }>(
        `/secrets/${link.projectId}`,
      );

      const secret = secrets.find(s => s.key === key);
      if (!secret) {
        console.error(chalk.red(`  Secret not found: ${key}`));
        process.exit(1);
      }

      const { history } = await api.get<{ history: VersionView[] }>(
        `/secrets/${secret.id}/history`,
      );

      if (!history.length) {
        console.log(chalk.dim(`\n  No history for ${key}\n`));
        return;
      }

      console.log(chalk.bold(`\n  History of ${key}  (${history.length} version${history.length !== 1 ? 's' : ''})\n`));
      console.log(chalk.dim('  ' + 'VER'.padEnd(6) + 'ACTION'.padEnd(12) + 'TYPE'.padEnd(12) + 'BY'.padEnd(32) + 'WHEN'));
      console.log(chalk.dim('  ' + '─'.repeat(74)));

      for (const v of history) {
        const actor = v.actor ? v.actor.email : 'system';
        const when = new Date(v.createdAt).toLocaleString();
        const actionColor = v.action === 'created' ? chalk.green : v.action === 'deleted' ? chalk.red : chalk.yellow;
        const type = v.isShared ? chalk.blue('shared') : chalk.dim('personal');
        console.log(
          `  v${String(v.version).padEnd(5)}${actionColor(v.action).padEnd(20)}${type.padEnd(20)}${chalk.dim(actor.padEnd(32))}${chalk.dim(when)}`
        );
      }
      console.log();
    } catch (err) {
      if (err instanceof ApiError) { console.error(chalk.red(`  Error: ${err.message}`)); process.exit(1); }
      throw err;
    }
  });
