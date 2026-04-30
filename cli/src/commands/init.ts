import { Command } from 'commander';
import chalk from 'chalk';
import { writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { api, ApiError } from '../api.js';
import { paginatedSelect } from '../utils/paginatedSelect.js';
import { sectionHeader, successLine, errorLine, warnLine, dimLine } from '../utils/brand.js';

/**
 * Default `.envshare.config.json` written by `init`.
 * The file is intentionally written with all keys present (even when empty)
 * so users can discover the available options without consulting the docs.
 */
const SAMPLE_PUSH_CONFIG = {
  defaultFile: '.env',
  sharedKeys: [],
  sharedPatterns: [],
  ignoredKeys: [],
  ignoredPaths: ['**/.env.docker', '**/.env.compose'],
  ignoredDirs: [],
};

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
        warnLine('No projects found. Run `envshare project create` first.');
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

      const configPath = join(process.cwd(), '.envshare.config.json');
      let wroteConfig = false;
      if (!existsSync(configPath)) {
        writeFileSync(configPath, JSON.stringify(SAMPLE_PUSH_CONFIG, null, 2) + '\n');
        wroteConfig = true;
      }

      console.log();
      successLine(`Linked to ${chalk.bold(project.name)}`);
      if (wroteConfig) dimLine('Wrote .envshare.config.json — edit `ignoredPaths` / `ignoredDirs` to skip extra .env files.');
      dimLine('Run `envshare push` to upload your .env');
      console.log();
    } catch (err) {
      if (err instanceof ApiError) { errorLine(err.message); process.exit(1); }
      throw err;
    }
  });
