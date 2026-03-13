/**
 * esai run -- <command>
 * Fetches secrets, injects them as environment variables, and runs a subprocess.
 * Secrets are NEVER written to disk — injected only into the child process env.
 *
 * Example: esai run -- node server.js
 *          esai run -- docker-compose up
 */
import { Command } from 'commander';
import { spawn } from 'child_process';
import chalk from 'chalk';
import ora from 'ora';
import { api, ApiError } from '../api.js';
import { readProjectLink } from '../config.js';

export const runCommand = new Command('run')
  .description('Inject secrets into a subprocess (nothing written to disk)')
  .allowUnknownOption()
  .argument('[command...]', 'Command to run')
  .action(async (args: string[]) => {
    const link = readProjectLink();
    if (!link) {
      console.error(chalk.red('  No project linked. Run `esai init` first.'));
      process.exit(1);
    }

    if (args.length === 0) {
      console.error(chalk.red('  No command specified. Usage: esai run -- <command>'));
      process.exit(1);
    }

    const spinner = ora(`Loading secrets for ${link.projectName}...`).start();

    try {
      const { secrets } = await api.get<{ secrets: { key: string; value: string }[] }>(
        `/sync/${link.projectId}/pull`,
      );
      spinner.stop();

      const injected = Object.fromEntries(secrets.map(({ key, value }) => [key, value]));

      console.log(chalk.dim(`  Injected ${secrets.length} secrets into: ${args.join(' ')}\n`));

      const [cmd, ...cmdArgs] = args;
      const child = spawn(cmd, cmdArgs, {
        env: { ...process.env, ...injected },
        stdio: 'inherit',
        shell: false,
      });

      child.on('exit', (code) => process.exit(code ?? 0));
      child.on('error', (err) => {
        console.error(chalk.red(`  Failed to start process: ${err.message}`));
        process.exit(1);
      });
    } catch (err) {
      spinner.fail();
      if (err instanceof ApiError) {
        console.error(chalk.red(`  Error: ${err.message}`));
      } else {
        throw err;
      }
      process.exit(1);
    }
  });
