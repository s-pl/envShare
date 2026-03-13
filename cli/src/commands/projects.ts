import { Command } from 'commander';
import prompts from 'prompts';
import chalk from 'chalk';
import { api, ApiError } from '../api.js';
import { readProjectLink } from '../config.js';

export const projectsCommand = new Command('project').description('Manage projects');

projectsCommand
  .command('create')
  .description('Create a new project')
  .action(async () => {
    const answers = await prompts([
      { type: 'text', name: 'name', message: 'Project name' },
      {
        type: 'text',
        name: 'slug',
        message: 'Slug (lowercase, no spaces)',
        initial: (_prev: any, values: any) =>
          values.name?.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
      },
    ]);

    if (!answers.name || !answers.slug) { process.exit(0); }

    try {
      const { project } = await api.post<{ project: any }>('/projects', {
        name: answers.name,
        slug: answers.slug,
      });
      console.log(chalk.green(`\n  Project "${project.name}" created.\n`));
      console.log(chalk.dim('  Run `esai init` in your project folder to link it.\n'));
    } catch (err) {
      if (err instanceof ApiError) { console.error(chalk.red(`\n  Error: ${err.message}`)); process.exit(1); }
      throw err;
    }
  });

projectsCommand
  .command('invite <email>')
  .description('Add a teammate to a project')
  .option('--role <role>', 'Role: ADMIN, DEVELOPER, VIEWER', 'DEVELOPER')
  .action(async (email: string, opts) => {
    const link = readProjectLink();
    if (!link) {
      console.error(chalk.red('  No project linked. Run `esai init` first.'));
      process.exit(1);
    }

    try {
      const { member } = await api.post<{ member: any }>(
        `/projects/${link.projectId}/members`,
        { email, role: opts.role.toUpperCase() },
      );
      console.log(chalk.green(`  Added ${member.user.email} as ${member.role} to ${link.projectName}`));
    } catch (err) {
      if (err instanceof ApiError) { console.error(chalk.red(`  Error: ${err.message}`)); process.exit(1); }
      throw err;
    }
  });

projectsCommand
  .command('members')
  .description('List project members')
  .action(async () => {
    const link = readProjectLink();
    if (!link) {
      console.error(chalk.red('  No project linked. Run `esai init` first.'));
      process.exit(1);
    }

    try {
      const { members } = await api.get<{ members: any[] }>(`/projects/${link.projectId}/members`);
      console.log(chalk.bold(`\n  Members of ${link.projectName}\n`));
      members.forEach((m) =>
        console.log(`  ${chalk.cyan(m.user.email.padEnd(35))} ${chalk.dim(m.role)}`)
      );
      console.log();
    } catch (err) {
      if (err instanceof ApiError) { console.error(chalk.red(`  Error: ${err.message}`)); process.exit(1); }
      throw err;
    }
  });
