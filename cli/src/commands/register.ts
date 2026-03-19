import { Command } from 'commander';
import prompts from 'prompts';
import chalk from 'chalk';
import { api, ApiError } from '../api.js';
import { config } from '../config.js';

export const registerCommand = new Command('register')
  .description('Create a new account on the envShare server')
  .option('--api-url <url>', 'API server URL')
  .action(async (opts) => {
    if (opts.apiUrl) config.set('apiUrl', opts.apiUrl);
    console.log(chalk.bold('\n  Create account\n'));

    const answers = await prompts([
      { type: 'text',     name: 'name',     message: 'Full name' },
      { type: 'text',     name: 'email',    message: 'Email' },
      { type: 'password', name: 'password', message: 'Password (min 12 chars)' },
    ]);

    if (!answers.name || !answers.email || !answers.password) {
      console.log(chalk.yellow('  Aborted.'));
      process.exit(0);
    }

    try {
      const { user } = await api.post<{ user: any }>('/auth/register', {
        name: answers.name,
        email: answers.email,
        password: answers.password,
      });
      console.log(chalk.green(`\n  Account created: ${user.email}`));
      console.log(chalk.dim('  Run `envshare login` to authenticate.\n'));
    } catch (err) {
      if (err instanceof ApiError) {
        console.error(chalk.red(`\n  Error: ${err.message}`));
        process.exit(1);
      }
      throw err;
    }
  });
