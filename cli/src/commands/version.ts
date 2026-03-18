import { Command } from 'commander';
import chalk from 'chalk';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { config, getApiUrl, isAuthenticated, readProjectLink } from '../config.js';

/** In dev: reads package.json. In a pkg binary: uses the build-time constant injected by esbuild. */
function getCliVersion(): { version: string; description: string } {
  // Injected by esbuild via --define:__ESAI_VERSION__ at bundle time
  if (typeof __ESAI_VERSION__ !== 'undefined' && __ESAI_VERSION__) {
    return { version: __ESAI_VERSION__, description: 'envShare CLI — sync secrets to .env files' };
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
  .description('Show detailed version and environment information')
  .action(() => {
    const { version, description } = getCliVersion();
    const line = chalk.dim('─'.repeat(48));

    console.log();
    console.log(`  ${chalk.bold.blue('esai')}  ${chalk.bold(version)}`);
    console.log(`  ${chalk.dim(description)}`);
    console.log(`  ${line}`);

    // Runtime
    console.log(`  ${chalk.dim('node')}       ${process.version}`);
    console.log(`  ${chalk.dim('platform')}   ${process.platform}/${process.arch}`);

    // Config
    const apiUrl = getApiUrl();
    console.log(`  ${chalk.dim('api url')}    ${chalk.cyan(apiUrl)}`);

    // Auth state
    const loggedIn = isAuthenticated();
    const email    = config.get('email') as string | undefined;
    const userId   = config.get('userId') as string | undefined;

    if (loggedIn && email) {
      console.log(`  ${chalk.dim('logged in')}  ${chalk.green(email)}`);
      if (userId) console.log(`  ${chalk.dim('user id')}    ${chalk.dim(userId)}`);
    } else {
      console.log(`  ${chalk.dim('logged in')}  ${chalk.yellow('no')}`);
    }

    // Linked project
    const link = readProjectLink();
    if (link) {
      console.log(`  ${chalk.dim('project')}    ${chalk.magenta(link.projectName)} ${chalk.dim(`(${link.projectId})`)}`);
    } else {
      console.log(`  ${chalk.dim('project')}    ${chalk.dim('(not linked)')}`);
    }

    // Config file location
    const cfgPath = config.path as string;
    console.log(`  ${chalk.dim('config')}     ${chalk.dim(cfgPath)}`);

    console.log();
  });
