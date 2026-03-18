#!/usr/bin/env node
import { Command } from 'commander';
import { urlCommand }      from './commands/url.js';
import { registerCommand } from './commands/register.js';
import { loginCommand }    from './commands/login.js';
import { orgsCommand }     from './commands/orgs.js';
import { projectsCommand } from './commands/projects.js';
import { initCommand }     from './commands/init.js';
import { pushCommand }     from './commands/push.js';
import { pullCommand }     from './commands/pull.js';
import { setCommand }      from './commands/set.js';
import { runCommand }      from './commands/run.js';
import { uiCommand }       from './commands/ui.js';
import { versionCommand }  from './commands/version.js';

const program = new Command();
program.name('esai').description('envShare — Secrets management CLI').version('1.0.0');

program.addCommand(versionCommand);
program.addCommand(urlCommand);
program.addCommand(registerCommand);
program.addCommand(loginCommand);
program.addCommand(orgsCommand);
program.addCommand(projectsCommand);
program.addCommand(initCommand);
program.addCommand(pushCommand);
program.addCommand(pullCommand);
program.addCommand(setCommand);
program.addCommand(runCommand);
program.addCommand(uiCommand);

program.parse(process.argv);
