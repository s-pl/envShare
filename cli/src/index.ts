#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import { urlCommand }      from './commands/url.js';
import { registerCommand } from './commands/register.js';
import { loginCommand }    from './commands/login.js';
import { projectsCommand } from './commands/projects.js';
import { initCommand }     from './commands/init.js';
import { pushCommand }     from './commands/push.js';
import { pullCommand }     from './commands/pull.js';
import { setCommand }      from './commands/set.js';
import { versionCommand }  from './commands/version.js';
import { installCommand }  from './commands/install.js';
import { updateCommand }   from './commands/update.js';
import { listCommand }     from './commands/list.js';
import { deleteCommand }   from './commands/delete.js';
import { historyCommand }  from './commands/history.js';
import { auditCommand }    from './commands/audit.js';
import { ApiError }        from './api.js';

const program = new Command();
declare const __ENVSHARE_VERSION__: string | undefined;
const cliVersion = typeof __ENVSHARE_VERSION__ !== 'undefined' ? __ENVSHARE_VERSION__ : '0.0.0-dev';
program
  .name('envshare')
  .description('Securely sync environment variables across your team')
  .version(cliVersion);

// ── Auth ──────────────────────────────────────────────────────────────────────
program.addCommand(registerCommand);
program.addCommand(loginCommand);

// ── Setup ─────────────────────────────────────────────────────────────────────
program.addCommand(urlCommand);
program.addCommand(projectsCommand);
program.addCommand(initCommand);

// ── Secrets ───────────────────────────────────────────────────────────────────
program.addCommand(pushCommand);
program.addCommand(pullCommand);
program.addCommand(setCommand);
program.addCommand(listCommand);
program.addCommand(deleteCommand);

// ── Audit & history ───────────────────────────────────────────────────────────
program.addCommand(historyCommand);
program.addCommand(auditCommand);

// ── System ────────────────────────────────────────────────────────────────────
program.addCommand(versionCommand);
program.addCommand(installCommand);
program.addCommand(updateCommand);

// ── Custom help ───────────────────────────────────────────────────────────────
program.addHelpText('after', `
Getting started:
  $ envshare url https://your-server.com    Connect to a server
  $ envshare register                       Create an account
  $ envshare login                          Log in
  $ envshare project create                 Create a project
  $ envshare init                           Link this directory to a project
  $ envshare push                           Upload your .env
  $ envshare pull                           Download secrets to .env files

Tip: Most commands have aliases — run "envshare <command> --help" for details.`);

void program.parseAsync(process.argv).catch((err: unknown) => {
  if (err instanceof ApiError) {
    console.error(chalk.red(`\n  Error: ${err.message}`));
    process.exit(1);
  }

  if (err instanceof Error) {
    console.error(chalk.red(`\n  Unexpected error: ${err.message}`));
    process.exit(1);
  }

  console.error(chalk.red('\n  Unexpected error occurred.'));
  process.exit(1);
});
