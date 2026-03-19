import { Command } from 'commander';
import chalk from 'chalk';
import { config } from '../config.js';
import { ApiError, probeEnvShareServer } from '../api.js';

export const urlCommand = new Command('url')
  .description('Get or set the API server URL')
  .argument('[url]', 'New API server URL to set')
  .action(async (url?: string) => {
    if (url) {
      try {
        const probe = await probeEnvShareServer(url);
        config.set('apiUrl', probe.normalizedUrl);
        console.log(chalk.green(`  API URL set to: ${probe.normalizedUrl}`));
        console.log(chalk.dim(`  envShare backend detected (version ${probe.version})`));
      } catch (err) {
        if (err instanceof ApiError) {
          console.error(chalk.red(`  Error: ${err.message}`));
          process.exit(1);
        }
        throw err;
      }
    } else {
      console.log(`  ${config.get('apiUrl')}`);
    }
  });
