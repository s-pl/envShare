/**
 * envshare set KEY value  — set your personal value for a secret
 * envshare set KEY value --shared — update the shared value (syncs to all)
 */
import { Command } from 'commander';
import chalk from 'chalk';
import { api, ApiError } from '../api.js';
import { readProjectLink } from '../config.js';
import { successLine } from '../utils/brand.js';

export const setCommand = new Command('set')
  .description('Set your personal value for a secret key')
  .argument('<key>', 'Variable name (e.g. DATABASE_URL)')
  .argument('<value>', 'Value to set')
  .option('--shared', 'Update the shared value (syncs to everyone)')
  .action(async (key: string, value: string, opts) => {
    const link = readProjectLink();
    if (!link) {
      console.error(chalk.red('  No project linked. Run `envshare init` first.'));
      process.exit(1);
    }

    try {
      const { secrets } = await api.get<{ secrets: any[] }>(`/secrets/${link.projectId}`);
      const secret = secrets.find((s: any) => s.key === key);

      if (!secret) {
        console.error(chalk.red(`  Key "${key}" not found. Push your .env first to register new keys.`));
        process.exit(1);
      }

      if (opts.shared) {
        process.stdout.write(chalk.dim('  Updating shared value...\n'));
        await api.patch(`/secrets/${secret.id}/shared`, { value });
        successLine(`Shared value updated for ${chalk.bold(key)} ${chalk.dim('(all team members will see this)')}`);
      } else {
        process.stdout.write(chalk.dim('  Setting personal value...\n'));
        await api.patch(`/secrets/${secret.id}/value`, { value });
        successLine(`Personal value set for ${chalk.bold(key)}`);
      }
    } catch (err) {
      if (err instanceof ApiError) { console.error(chalk.red(`  Error: ${err.message}`)); process.exit(1); }
      throw err;
    }
  });
