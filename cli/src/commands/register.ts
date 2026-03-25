import { Command } from 'commander';
import prompts from 'prompts';
import chalk from 'chalk';
import ora from 'ora';
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

    const answers = await prompts([
      { type: 'text',     name: 'name',     message: 'Full name' },
      { type: 'text',     name: 'email',    message: 'Email' },
      { type: 'password', name: 'password', message: 'Password (min 12 chars)' },
    ]);

    if (!answers.name || !answers.email || !answers.password) {
      console.log(chalk.yellow('  Aborted.'));
      process.exit(0);
    }

    if (answers.password.length < 12) {
      failLine('Password must be at least 12 characters.');
      process.exit(1);
    }

    const spinner = ora({ text: 'Creating account...', indent: 2 }).start();

    try {
      const { user } = await api.post<{ user: any }>('/auth/register', {
        name: answers.name,
        email: answers.email,
        password: answers.password,
      });
      spinner.stop();
      successLine(`Account created: ${chalk.bold(user.email)}`);
      console.log(chalk.dim('  Run `envshare login` to authenticate.\n'));
    } catch (err) {
      spinner.stop();
      if (err instanceof ApiError) {
        failLine(err.message);
        process.exit(1);
      }
      throw err;
    }
  });
