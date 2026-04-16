import { Command } from 'commander';
import chalk from 'chalk';
import { input, confirm, restoreTerminal } from '../utils/prompt.js';
import { api, ApiError } from '../api.js';
import { readProjectLink } from '../config.js';

export const projectsCommand = new Command('project')
  .alias('p')
  .description('Create, manage and collaborate on projects and team members')
  .addHelpText('after', `
Examples:
  $ envshare project create                       Create a new project interactively
  $ envshare project invite dev@company.io        Add teammate as DEVELOPER (default)
  $ envshare project invite admin@co.io --role ADMIN
  $ envshare project members                      List who has access
  $ envshare project set-role dev@co.io VIEWER    Change a member's role
  $ envshare project remove dev@co.io             Revoke access
  $ envshare project delete                       Delete project and all secrets (ADMIN)`);

projectsCommand
  .command('create')
  .description('Create a new project with a name and slug')
  .action(async () => {
    const name = await input({ message: 'Project name' });
    const defaultSlug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const slug = await input({ message: 'Slug (lowercase, no spaces)', default: defaultSlug });
    restoreTerminal();

    if (!name || !slug) { process.exit(0); }

    try {
      const { project } = await api.post<{ project: any }>('/projects', { name, slug });
      console.log(chalk.green(`\n  Project "${project.name}" created.\n`));
      console.log(chalk.dim('  Run `envshare init` in your project folder to link it.\n'));
    } catch (err) {
      if (err instanceof ApiError) { console.error(chalk.red(`\n  Error: ${err.message}`)); process.exit(1); }
      throw err;
    }
  });

projectsCommand
  .command('invite <email>')
  .description('Invite a registered user to the linked project by email')
  .option('--role <role>', 'Role: ADMIN, DEVELOPER, VIEWER (default: DEVELOPER)', 'DEVELOPER')
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
  .alias('team')
  .description('List all members and their roles in the linked project')
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
  .description('Change a member\'s role (ADMIN | DEVELOPER | VIEWER)')
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
  .alias('kick')
  .description('Remove a member from the linked project (with confirmation)')
  .action(async (email: string) => {
    const link = readProjectLink();
    if (!link) {
      console.error(chalk.red('  No project linked. Run `envshare init` first.'));
      process.exit(1);
    }

    try {
      const { members } = await api.get<{ members: any[] }>(`/projects/${link.projectId}/members`);
      const target = members.find((m: any) => m.user.email === email);
      if (!target) {
        console.error(chalk.red(`  No member with email: ${email}`));
        process.exit(1);
      }

      const confirmed = await confirm({
        message: `Remove ${email} (${target.role}) from ${link.projectName}?`,
        default: false,
      });
      restoreTerminal();
      if (!confirmed) { console.log(chalk.dim('  Aborted.')); process.exit(0); }

      await api.delete(`/projects/${link.projectId}/members/${target.user.id}`);
      console.log(chalk.green(`  Removed ${email} from ${link.projectName}`));
    } catch (err) {
      if (err instanceof ApiError) { console.error(chalk.red(`  Error: ${err.message}`)); process.exit(1); }
      throw err;
    }
  });

projectsCommand
  .command('delete')
  .description('Permanently delete the linked project, all secrets and members (ADMIN only)')
  .option('-f, --force', 'Skip the confirmation prompt (use with caution)')
  .action(async (opts) => {
    const link = readProjectLink();
    if (!link) {
      console.error(chalk.red('  No project linked. Run `envshare init` first.'));
      process.exit(1);
    }

    if (!opts.force) {
      const confirmed = await confirm({
        message: chalk.red(`Permanently delete project "${link.projectName}" and ALL its secrets? This cannot be undone.`),
        default: false,
      });
      restoreTerminal();
      if (!confirmed) { console.log(chalk.dim('  Aborted.')); process.exit(0); }
    }

    try {
      await api.delete(`/projects/${link.projectId}`);
      console.log(chalk.green(`  Project "${link.projectName}" deleted.`));
    } catch (err) {
      if (err instanceof ApiError) { console.error(chalk.red(`  Error: ${err.message}`)); process.exit(1); }
      throw err;
    }
  });
