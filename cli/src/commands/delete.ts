import { Command } from 'commander';
import chalk from 'chalk';
import { confirm, restoreTerminal } from '../utils/prompt.js';
import { api, ApiError } from '../api.js';
import { readProjectLink } from '../config.js';
import { successLine, failLine, errorLine, dimLine } from '../utils/brand.js';

export const deleteCommand = new Command('delete')
  .alias('rm')
  .description('Delete a secret key and all its values (shared + personal) for every team member')
  .argument('<key>', 'Secret key name to delete (e.g. OLD_API_KEY)')
  .option('-f, --force', 'Skip the confirmation prompt')
  .addHelpText('after', `
Examples:
  $ envshare delete OLD_API_KEY        Delete with confirmation
  $ envshare rm OLD_API_KEY -f         Delete without asking (CI-friendly)`)
  .action(async (key: string, opts) => {
    const link = readProjectLink();
    if (!link) {
      errorLine('No project linked. Run `envshare init` first.');
      process.exit(1);
    }

    try {
      const { secrets } = await api.get<{ secrets: { id: string; key: string; isShared: boolean }[] }>(
        `/secrets/${link.projectId}`,
      );

      const secret = secrets.find(s => s.key === key);
      if (!secret) {
        failLine(`Secret not found: ${key}`);
        process.exit(1);
      }

      if (!opts.force) {
        const confirmed = await confirm({
          message: `Delete "${key}" from ${link.projectName}? This removes all values for all team members.`,
          default: false,
        });
        restoreTerminal();
        if (!confirmed) { dimLine('Aborted.'); process.exit(0); }
      }

      process.stdout.write(chalk.dim(`  Deleting ${key}...\n`));
      await api.delete(`/secrets/${secret.id}`);
      successLine(`Deleted ${chalk.bold(key)}`);
    } catch (err) {
      if (err instanceof ApiError) { errorLine(err.message); process.exit(1); }
      throw err;
    }
  });
