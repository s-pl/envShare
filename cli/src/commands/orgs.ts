import { Command } from 'commander';
import chalk from 'chalk';
import { input, restoreTerminal } from '../utils/prompt.js';
import { api, ApiError } from '../api.js';

export const orgsCommand = new Command('org').description('Manage organizations');

orgsCommand
  .command('create')
  .description('Create a new organization')
  .action(async () => {
    const name = await input({ message: 'Organization name' });
    const defaultSlug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const slug = await input({ message: 'Slug (lowercase, no spaces)', default: defaultSlug });
    restoreTerminal();

    if (!name || !slug) { process.exit(0); }

    try {
      const { organization } = await api.post<{ organization: any }>('/organizations', { name, slug });
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
