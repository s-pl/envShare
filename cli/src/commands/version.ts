import { Command } from 'commander';
import chalk from 'chalk';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { config, getApiUrl, isAuthenticated, readProjectLink } from '../config.js';
import { printBanner, printInfoBox } from '../utils/brand.js';

/** In dev: reads package.json. In a pkg binary: uses the build-time constant injected by esbuild. */
function getCliVersion(): { version: string; description: string } {
  // Injected by esbuild via --define:__ENVSHARE_VERSION__ at bundle time
  if (typeof __ENVSHARE_VERSION__ !== 'undefined' && __ENVSHARE_VERSION__) {
    return { version: __ENVSHARE_VERSION__, description: 'envShare CLI — sync secrets to .env files' };
  }
  // Dev fallback: read from package.json on disk
  try {
    const __dir = dirname(fileURLToPath(import.meta.url));
    const raw = readFileSync(join(__dir, '../../package.json'), 'utf-8');
    return JSON.parse(raw) as { version: string; description: string };
  } catch {
    return { version: '0.0.0', description: 'envShare CLI' };
  }
}

export const versionCommand = new Command('version')
  .alias('v')
  .description('Show CLI version, connection status, linked project and environment info')
  .action(() => {
    const { version } = getCliVersion();

    printBanner();

    const apiUrl = getApiUrl();
    const loggedIn = isAuthenticated();
    const email = config.get('email') as string | undefined;
    const link = readProjectLink();

    const rows: [string, string][] = [
      ['version', chalk.bold(version)],
      ['node', process.version],
      ['platform', `${process.platform}/${process.arch}`],
      ['api url', chalk.cyan(apiUrl)],
      ['logged in', loggedIn && email ? chalk.green(email) : chalk.yellow('no')],
      ['project', link ? chalk.magenta(link.projectName) : chalk.dim('(not linked)')],
      ['config', chalk.dim(config.path as string)],
    ];

    printInfoBox(rows);
    console.log();
  });
