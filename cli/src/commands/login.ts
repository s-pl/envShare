import { Command } from 'commander';
import chalk from 'chalk';
import { input, password, restoreTerminal } from '../utils/prompt.js';
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

    const email = await input({ message: 'Email' });
    const pass  = await password({ message: 'Password', mask: '*' });

    // All prompts done — restore terminal before any process.exit or I/O
    restoreTerminal();

    if (!email || !pass) {
      console.log(chalk.yellow('  Aborted.'));
      process.exit(0);
    }

    clearAuth();

    process.stdout.write(chalk.dim('  Authenticating...\n'));

    try {
      const result = await api.post<{ accessToken: string; refreshToken: string; user: any }>(
        '/auth/login',
        { email, password: pass },
      );

      setAccessToken(result.accessToken);
      config.set('refreshToken', result.refreshToken);
      config.set('userId', result.user.id);
      config.set('email', result.user.email);

      successLine(`Logged in as ${chalk.bold(result.user.email)}`);
      console.log();
    } catch (err) {
      if (err instanceof ApiError) {
        failLine(err.message);
        process.exit(1);
      }
      throw err;
    }
  });
