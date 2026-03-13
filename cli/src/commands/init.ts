import { Command } from 'commander';
import prompts from 'prompts';
import chalk from 'chalk';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { api, ApiError } from '../api.js';

export const initCommand = new Command('init')
  .description('Link current directory to a project')
  .action(async () => {
    console.log(chalk.bold('\n  Link project to current directory\n'));

    try {
      const { projects } = await api.get<{ projects: any[] }>('/projects');

      if (!projects.length) {
        console.log(chalk.yellow('  No projects found. Run `esai project create` first.'));
        process.exit(1);
      }

      const { projectId } = await prompts({
        type: 'select',
        name: 'projectId',
        message: 'Select project',
        choices: projects.map(p => ({ title: `${p.name}`, value: p.id })),
      });

      if (!projectId) { process.exit(0); }

      const project = projects.find(p => p.id === projectId);
      writeFileSync(
        join(process.cwd(), '.esai.json'),
        JSON.stringify({ projectId, projectName: project.name }, null, 2),
      );

      console.log(chalk.green(`\n  Linked to ${project.name}`));
      console.log(chalk.dim('  Run `esai push` to upload your .env\n'));
    } catch (err) {
      if (err instanceof ApiError) { console.error(chalk.red(`  Error: ${err.message}`)); process.exit(1); }
      throw err;
    }
  });
