import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import prompts from 'prompts';
import { api, ApiError } from '../api.js';
import { readProjectLink } from '../config.js';
import { successLine, failLine } from '../utils/brand.js';

export const deleteCommand = new Command('delete')
  .description('Delete a secret from the project (removes all personal values too)')
  .argument('<key>', 'Secret key name to delete')
  .option('-f, --force', 'Skip confirmation prompt')
  .action(async (key: string, opts) => {
    const link = readProjectLink();
    if (!link) {
      console.error(chalk.red('  No project linked. Run `envshare init` first.'));
      process.exit(1);
    }

    try {
      const { secrets } = await api.get<{ secrets: { id: string; key: string; isShared: boolean }[] }>(
        `/secrets/${link.projectId}`,
      );

      const secret = secrets.find(s => s.key === key);
      if (!secret) {
        console.error(chalk.red(`  Secret not found: ${key}`));
        process.exit(1);
      }

      if (!opts.force) {
        const { confirmed } = await prompts({
          type: 'confirm',
          name: 'confirmed',
          message: `Delete "${key}" from ${link.projectName}? This removes all values for all team members.`,
          initial: false,
        });
        if (!confirmed) { console.log(chalk.dim('  Aborted.')); process.exit(0); }
      }

      const spinner = ora({ text: `Deleting ${key}...`, indent: 2 }).start();
      await api.delete(`/secrets/${secret.id}`);
      spinner.stop();
      successLine(`Deleted ${chalk.bold(key)}`);
    } catch (err) {
      if (err instanceof ApiError) { console.error(chalk.red(`  Error: ${err.message}`)); process.exit(1); }
      throw err;
    }
  });
