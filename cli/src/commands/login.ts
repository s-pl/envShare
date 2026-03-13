import { Command } from 'commander';
import prompts from 'prompts';
import chalk from 'chalk';
import { config, setAccessToken, clearAuth, getApiUrl } from '../config.js';
import { api, ApiError } from '../api.js';

export const loginCommand = new Command('login')
  .description('Authenticate with the envShare server')
  .option('--api-url <url>', 'API server URL (overrides config)')
  .action(async (opts) => {
    if (opts.apiUrl) config.set('apiUrl', opts.apiUrl);

    console.log(chalk.bold('\n  envShare Login'));
    console.log(chalk.dim(`  Server: ${getApiUrl()}\n`));

    const answers = await prompts([
      { type: 'text', name: 'email', message: 'Email' },
      { type: 'password', name: 'password', message: 'Password' },
    ]);

    if (!answers.email || !answers.password) {
      console.log(chalk.yellow('Aborted.'));
      process.exit(0);
    }

    // Clear any stale token so the 401 from wrong credentials doesn't trigger a refresh attempt
    clearAuth();

    try {
      const result = await api.post<{ accessToken: string; refreshToken: string; user: any }>(
        '/auth/login',
        { email: answers.email, password: answers.password },
      );

      setAccessToken(result.accessToken);
      config.set('refreshToken', result.refreshToken);
      config.set('userId', result.user.id);
      config.set('email', result.user.email);

      console.log(chalk.green(`\n  Logged in as ${result.user.email}`));
    } catch (err) {
      if (err instanceof ApiError) {
        console.error(chalk.red(`\n  Error: ${err.message}`));
        process.exit(1);
      }
      throw err;
    }
  });
