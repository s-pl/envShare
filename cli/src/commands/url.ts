import { Command } from 'commander';
import chalk from 'chalk';
import { config } from '../config.js';

export const urlCommand = new Command('url')
  .description('Get or set the API server URL')
  .argument('[url]', 'New API server URL to set')
  .action((url?: string) => {
    if (url) {
      config.set('apiUrl', url);
      console.log(chalk.green(`  API URL set to: ${url}`));
    } else {
      console.log(`  ${config.get('apiUrl')}`);
    }
  });
