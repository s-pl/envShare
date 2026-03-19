import { Command } from 'commander';
import prompts from 'prompts';
import chalk from 'chalk';
import { api, ApiError } from '../api.js';

export const orgsCommand = new Command('org').description('Manage organizations');

orgsCommand
  .command('create')
  .description('Create a new organization')
  .action(async () => {
    const answers = await prompts([
      { type: 'text', name: 'name', message: 'Organization name' },
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
      const { organization } = await api.post<{ organization: any }>('/organizations', answers);
      console.log(chalk.green(`\n  Organization "${organization.name}" created (id: ${organization.id})\n`));
    } catch (err) {
      if (err instanceof ApiError) { console.error(chalk.red(`\n  Error: ${err.message}`)); process.exit(1); }
      throw err;
    }
  });

orgsCommand
  .command('list')
  .description('List your organizations')
  .action(async () => {
    try {
      const { organizations } = await api.get<{ organizations: any[] }>('/organizations');
      if (!organizations.length) { console.log(chalk.dim('  No organizations yet. Run `envshare org create`.')); return; }
      organizations.forEach((o) => console.log(`  ${chalk.cyan(o.name)}  ${chalk.dim(o.id)}`));
    } catch (err) {
      if (err instanceof ApiError) { console.error(chalk.red(`  Error: ${err.message}`)); process.exit(1); }
      throw err;
    }
  });
