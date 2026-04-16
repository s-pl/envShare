import { Command } from 'commander';
import chalk from 'chalk';
import { input, password, restoreTerminal } from '../utils/prompt.js';
import { api, ApiError } from '../api.js';
import { config } from '../config.js';
import { sectionHeader, successLine, failLine } from '../utils/brand.js';

export const registerCommand = new Command('register')
  .alias('signup')
  .description('Create a new account (email + password, min 12 chars)')
  .option('--api-url <url>', 'API server URL (overrides current config)')
  .addHelpText('after', `
Examples:
  $ envshare register                   Interactive account creation
  $ envshare register --api-url https://secrets.myco.io`)
  .action(async (opts) => {
    if (opts.apiUrl) config.set('apiUrl', opts.apiUrl);

    sectionHeader('Create account');
    console.log();

    const email = await input({ message: 'Email' });
    const pass  = await password({ message: 'Password (min 12 chars)', mask: '*' });

    restoreTerminal();

    if (!email || !pass) {
      console.log(chalk.yellow('  Aborted.'));
      process.exit(0);
    }

    if (pass.length < 12) {
      failLine('Password must be at least 12 characters.');
      process.exit(1);
    }

    process.stdout.write(chalk.dim('  Creating account...\n'));

    try {
      const { user } = await api.post<{ user: any }>('/auth/register', {
        email,
        password: pass,
      });
      successLine(`Account created: ${chalk.bold(user.email)}`);
      console.log(chalk.dim('  Run `envshare login` to authenticate.\n'));
    } catch (err) {
      if (err instanceof ApiError) {
        failLine(err.message);
        process.exit(1);
      }
      throw err;
    }
  });
