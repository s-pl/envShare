#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import { urlCommand }      from './commands/url.js';
import { registerCommand } from './commands/register.js';
import { loginCommand }    from './commands/login.js';
import { orgsCommand }     from './commands/orgs.js';
import { projectsCommand } from './commands/projects.js';
import { initCommand }     from './commands/init.js';
import { pushCommand }     from './commands/push.js';
import { pullCommand }     from './commands/pull.js';
import { setCommand }      from './commands/set.js';
import { uiCommand }       from './commands/ui.js';
import { versionCommand }  from './commands/version.js';
import { installCommand }  from './commands/install.js';
import { updateCommand }   from './commands/update.js';
import { listCommand }     from './commands/list.js';
import { deleteCommand }   from './commands/delete.js';
import { historyCommand }  from './commands/history.js';
import { auditCommand }    from './commands/audit.js';
import { ApiError }        from './api.js';

const program = new Command();
program.name('envshare').description('envShare / Secrets management CLI').version('1.0.0');

program.addCommand(versionCommand);
program.addCommand(installCommand);
program.addCommand(updateCommand);
program.addCommand(urlCommand);
program.addCommand(registerCommand);
program.addCommand(loginCommand);
program.addCommand(orgsCommand);
program.addCommand(projectsCommand);
program.addCommand(initCommand);
program.addCommand(pushCommand);
program.addCommand(pullCommand);
program.addCommand(setCommand);
program.addCommand(listCommand);
program.addCommand(deleteCommand);
program.addCommand(historyCommand);
program.addCommand(auditCommand);
program.addCommand(uiCommand);

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
