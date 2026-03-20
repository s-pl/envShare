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
      console.log(chalk.dim('  Run `envshare init` in your project folder to link it.\n'));
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
      console.error(chalk.red('  No project linked. Run `envshare init` first.'));
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
      console.error(chalk.red('  No project linked. Run `envshare init` first.'));
      process.exit(1);
    }

    try {
      const { members } = await api.get<{ members: any[] }>(`/projects/${link.projectId}/members`);
      console.log(chalk.bold(`\n  Members of ${link.projectName}\n`));
      members.forEach((m) => {
        const roleColor = m.role === 'ADMIN' ? chalk.yellow : m.role === 'DEVELOPER' ? chalk.cyan : chalk.dim;
        console.log(`  ${m.user.email.padEnd(35)} ${m.user.name.padEnd(20)} ${roleColor(m.role)}`);
      });
      console.log();
    } catch (err) {
      if (err instanceof ApiError) { console.error(chalk.red(`  Error: ${err.message}`)); process.exit(1); }
      throw err;
    }
  });

projectsCommand
  .command('set-role <email> <role>')
  .description('Change a member\'s role (ADMIN, DEVELOPER, VIEWER)')
  .action(async (email: string, role: string) => {
    const link = readProjectLink();
    if (!link) {
      console.error(chalk.red('  No project linked. Run `envshare init` first.'));
      process.exit(1);
    }

    const normalized = role.toUpperCase();
    if (!['ADMIN', 'DEVELOPER', 'VIEWER'].includes(normalized)) {
      console.error(chalk.red('  Invalid role. Use: ADMIN, DEVELOPER, VIEWER'));
      process.exit(1);
    }

    try {
      const { members } = await api.get<{ members: any[] }>(`/projects/${link.projectId}/members`);
      const target = members.find((m: any) => m.user.email === email);
      if (!target) {
        console.error(chalk.red(`  No member with email: ${email}`));
        process.exit(1);
      }

      await api.patch(`/projects/${link.projectId}/members/${target.user.id}`, { role: normalized });
      console.log(chalk.green(`  ${email} is now ${normalized} in ${link.projectName}`));
    } catch (err) {
      if (err instanceof ApiError) { console.error(chalk.red(`  Error: ${err.message}`)); process.exit(1); }
      throw err;
    }
  });

projectsCommand
  .command('remove <email>')
  .description('Remove a member from the project')
  .action(async (email: string) => {
    const link = readProjectLink();
    if (!link) {
      console.error(chalk.red('  No project linked. Run `envshare init` first.'));
      process.exit(1);
    }

    try {
      // Get members to find userId by email
      const { members } = await api.get<{ members: any[] }>(`/projects/${link.projectId}/members`);
      const target = members.find((m: any) => m.user.email === email);
      if (!target) {
        console.error(chalk.red(`  No member with email: ${email}`));
        process.exit(1);
      }

      const { confirmed } = await prompts({
        type: 'confirm',
        name: 'confirmed',
        message: `Remove ${email} (${target.role}) from ${link.projectName}?`,
        initial: false,
      });
      if (!confirmed) { console.log(chalk.dim('  Aborted.')); process.exit(0); }

      await api.delete(`/projects/${link.projectId}/members/${target.user.id}`);
      console.log(chalk.green(`  Removed ${email} from ${link.projectName}`));
    } catch (err) {
      if (err instanceof ApiError) { console.error(chalk.red(`  Error: ${err.message}`)); process.exit(1); }
      throw err;
    }
  });
