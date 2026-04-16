import { Command } from 'commander';
import chalk from 'chalk';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { api, ApiError } from '../api.js';
import { paginatedSelect } from '../utils/paginatedSelect.js';
import { sectionHeader, successLine } from '../utils/brand.js';

export const initCommand = new Command('init')
  .alias('link')
  .description('Link the current directory to an envShare project (creates .envshare.json)')
  .addHelpText('after', `
Examples:
  $ cd my-app && envshare init   Select a project and link this folder

  This writes .envshare.json to the current directory. All push/pull/set/list
  commands use this file to determine which project to operate on.`)
  .action(async () => {
    sectionHeader('Link project');

    process.stdout.write(chalk.dim('  Loading projects...\n'));

    try {
      const { projects } = await api.get<{ projects: any[] }>('/projects');

      if (!projects.length) {
        console.log(chalk.yellow('  No projects found. Run `envshare project create` first.'));
        process.exit(1);
      }

      console.log();
      const projectId = await paginatedSelect(
        'Select project',
        projects.map(p => ({ title: p.name, value: p.id })),
      );

      if (!projectId) { process.exit(0); }

      const project = projects.find(p => p.id === projectId);
      writeFileSync(
        join(process.cwd(), '.envshare.json'),
        JSON.stringify({ projectId, projectName: project.name }, null, 2),
      );

      console.log();
      successLine(`Linked to ${chalk.bold(project.name)}`);
      console.log(chalk.dim('  Run `envshare push` to upload your .env\n'));
    } catch (err) {
      if (err instanceof ApiError) { console.error(chalk.red(`  Error: ${err.message}`)); process.exit(1); }
      throw err;
    }
  });
