import { Command } from 'commander';
import chalk from 'chalk';
import { input, password, confirm, restoreTerminal } from '../utils/prompt.js';
import { api, ApiError } from '../api.js';
import { config } from '../config.js';
import { sectionHeader, successLine, failLine } from '../utils/brand.js';

export const registerCommand = new Command('register')
  .description('Create a new account on the envShare server')
  .option('--api-url <url>', 'API server URL')
  .action(async (opts) => {
    if (opts.apiUrl) config.set('apiUrl', opts.apiUrl);

    sectionHeader('Create account');
    console.log();

    const name    = await input({ message: 'Full name' });
    const email   = await input({ message: 'Email' });
    const pass    = await password({ message: 'Password (min 12 chars)', mask: '*' });
    const consent = await confirm({
      message: `Accept the Privacy Policy? ${chalk.dim('(https://envshare.dev/privacy)')}`,
      default: false,
    });

    // All prompts done — restore terminal before any process.exit or I/O
    restoreTerminal();

    if (!name || !email || !pass) {
      console.log(chalk.yellow('  Aborted.'));
      process.exit(0);
    }

    if (!consent) {
      failLine('You must accept the Privacy Policy to create an account.');
      process.exit(1);
    }

    if (pass.length < 12) {
      failLine('Password must be at least 12 characters.');
      process.exit(1);
    }

    process.stdout.write(chalk.dim('  Creating account...\n'));

    try {
      const { user } = await api.post<{ user: any }>('/auth/register', {
        name,
        email,
        password: pass,
        consent,
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
