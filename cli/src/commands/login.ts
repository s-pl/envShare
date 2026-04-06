import { Command } from 'commander';
import { input, password } from '@inquirer/prompts';
import { ExitPromptError } from '@inquirer/core';
import chalk from 'chalk';
import ora from 'ora';
import { config, setAccessToken, clearAuth, getApiUrl } from '../config.js';
import { api, ApiError } from '../api.js';
import { sectionHeader, successLine, failLine } from '../utils/brand.js';

export const loginCommand = new Command('login')
  .description('Authenticate with the envShare server')
  .option('--api-url <url>', 'API server URL (overrides config)')
  .action(async (opts) => {
    if (opts.apiUrl) config.set('apiUrl', opts.apiUrl);

    sectionHeader('Login');
    console.log(chalk.dim(`  Server: ${getApiUrl()}\n`));

    let email: string, pass: string;
    try {
      email = await input({ message: 'Email' });
      pass  = await password({ message: 'Password', mask: '*' });
    } catch (err) {
      if (err instanceof ExitPromptError) {
        console.log(chalk.yellow('\n  Aborted.'));
        process.exit(0);
      }
      throw err;
    }

    if (!email || !pass) {
      console.log(chalk.yellow('  Aborted.'));
      process.exit(0);
    }

    // Clear any stale token so the 401 from wrong credentials doesn't trigger a refresh attempt
    clearAuth();

    const spinner = ora({ text: 'Authenticating...', indent: 2 }).start();

    try {
      const result = await api.post<{ accessToken: string; refreshToken: string; user: any }>(
        '/auth/login',
        { email, password: pass },
      );

      setAccessToken(result.accessToken);
      config.set('refreshToken', result.refreshToken);
      config.set('userId', result.user.id);
      config.set('email', result.user.email);

      spinner.stop();
      successLine(`Logged in as ${chalk.bold(result.user.email)}`);
      console.log();
    } catch (err) {
      spinner.stop();
      if (err instanceof ApiError) {
        failLine(err.message);
        process.exit(1);
      }
      throw err;
    }
  });
