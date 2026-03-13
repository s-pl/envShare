import { Command } from 'commander';
import { isAuthenticated } from '../config.js';
import chalk from 'chalk';

export const uiCommand = new Command('ui')
  .description('Launch the interactive terminal UI')
  .action(async () => {
    if (!isAuthenticated()) {
      console.error(chalk.red('  Not logged in. Run `esai login` first.'));
      process.exit(1);
    }

    // Lazy import Ink so it doesn't affect startup time of other commands
    const { render } = await import('ink');
    const { createElement } = await import('react');
    const { App } = await import('../ui/App.js');

    const { waitUntilExit } = render(createElement(App));
    await waitUntilExit();
  });
