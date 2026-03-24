import { Command } from 'commander';
import chalk from 'chalk';
import { api, ApiError } from '../api.js';
import { readProjectLink } from '../config.js';
import { padEnd } from '../utils/ansiPad.js';

interface AuditItem {
  id: string;
  action: string;
  actor: string;
  resourceType: string;
  resourceId: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export const auditCommand = new Command('audit')
  .description('Show project audit log (ADMIN only)')
  .option('-n, --limit <n>', 'Number of entries to show', '50')
  .option('--from <date>', 'Show entries after this date (ISO or readable)')
  .option('--to <date>', 'Show entries before this date (ISO or readable)')
  .option('--action <action>', 'Filter by action type (e.g. SECRETS_PUSHED)')
  .option('--json', 'Output as JSON')
  .action(async (opts) => {
    const link = readProjectLink();
    if (!link) {
      console.error(chalk.red('  No project linked. Run `envshare init` first.'));
      process.exit(1);
    }

    const params = new URLSearchParams({
      resourceId: link.projectId,
      limit: opts.limit,
    });
    if (opts.from) {
      const d = new Date(opts.from);
      if (isNaN(d.getTime())) {
        console.error(chalk.red(`  Invalid --from date: "${opts.from}"`));
        process.exit(1);
      }
      params.set('from', d.toISOString());
    }
    if (opts.to) {
      const d = new Date(opts.to);
      if (isNaN(d.getTime())) {
        console.error(chalk.red(`  Invalid --to date: "${opts.to}"`));
        process.exit(1);
      }
      params.set('to', d.toISOString());
    }
    if (opts.action) params.set('action', opts.action);

    try {
      const result = await api.get<{ items: AuditItem[]; total: number }>(
        `/audit?${params.toString()}`,
      );

      if (opts.json) {
        console.log(JSON.stringify(result, null, 2));
        return;
      }

      const { items, total } = result;

      if (!items.length) {
        console.log(chalk.dim('\n  No audit entries found.\n'));
        return;
      }

      console.log(chalk.bold(`\n  Audit log — ${link.projectName}  (${items.length} of ${total})\n`));
      console.log(chalk.dim('  ' + 'WHEN'.padEnd(22) + 'ACTION'.padEnd(32) + 'ACTOR'));
      console.log(chalk.dim('  ' + '─'.repeat(72)));

      for (const e of items) {
        const when = new Date(e.createdAt).toLocaleString();
        console.log(
          `  ${padEnd(chalk.dim(when), 22)}${padEnd(chalk.cyan(e.action), 32)}${chalk.dim(e.actor)}`
        );
      }

      if (total > items.length) {
        console.log(chalk.dim(`\n  Showing ${items.length} of ${total}. Use --limit or --from/--to to narrow results.`));
      }
      console.log();
    } catch (err) {
      if (err instanceof ApiError) { console.error(chalk.red(`  Error: ${err.message}`)); process.exit(1); }
      throw err;
    }
  });
