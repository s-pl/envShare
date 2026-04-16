import { Command } from 'commander';
import { copyFileSync, chmodSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir, platform } from 'os';
import { execSync } from 'child_process';
import chalk from 'chalk';

const IS_WINDOWS = platform() === 'win32';
const IS_MAC     = platform() === 'darwin';

function getDefaultInstallDir(): string {
  if (IS_WINDOWS) {
    // %LOCALAPPDATA%\Programs\envshare  — no admin needed
    const localAppData = process.env.LOCALAPPDATA || join(homedir(), 'AppData', 'Local');
    return join(localAppData, 'Programs', 'envshare');
  }
  // Linux & macOS: ~/.local/bin  — no sudo needed
  return join(homedir(), '.local', 'bin');
}

function getBinaryName(): string {
  return IS_WINDOWS ? 'envshare.exe' : 'envshare';
}

function isInPath(dir: string): boolean {
  const sep = IS_WINDOWS ? ';' : ':';
  const pathVar = process.env.PATH || process.env.Path || '';
  return pathVar.split(sep).some(p => p.toLowerCase() === dir.toLowerCase());
}

/** Permanently adds dir to the current user's PATH on Windows via PowerShell. */
function addToWindowsPath(dir: string): boolean {
  try {
    const escaped = dir.replace(/'/g, "''");
    execSync(
      `powershell -NoProfile -Command "[Environment]::SetEnvironmentVariable('Path', [Environment]::GetEnvironmentVariable('Path','User') + ';${escaped}', 'User')"`,
      { stdio: 'ignore' },
    );
    return true;
  } catch {
    return false;
  }
}

export const installCommand = new Command('install')
  .description('Copy the envshare binary to a permanent location and configure PATH')
  .option('--dir <path>', 'Custom install directory (default: ~/.local/bin or %LOCALAPPDATA%)')
  .addHelpText('after', `
Examples:
  $ envshare install                     Install to ~/.local/bin (Linux/macOS)
  $ envshare install --dir /usr/local/bin`)
  .action((opts) => {
    const installDir: string = opts.dir || getDefaultInstallDir();
    const binaryName = getBinaryName();
    const dest = join(installDir, binaryName);

    // Locate source binary
    const isCompiledBinary = !!(process as any).pkg;
    const binarySrc = isCompiledBinary ? process.execPath : process.argv[1];

    if (!binarySrc || !existsSync(binarySrc)) {
      console.error(chalk.red(`  Cannot locate the envshare binary at: ${binarySrc}`));
      process.exit(1);
    }

    // Create install dir if needed
    if (!existsSync(installDir)) {
      mkdirSync(installDir, { recursive: true });
    }

    // Copy binary
    try {
      copyFileSync(binarySrc, dest);
      if (!IS_WINDOWS) chmodSync(dest, 0o755);
    } catch (err: any) {
      if (err.code === 'EACCES') {
        console.error(chalk.red(`  Permission denied writing to ${installDir}`));
        if (!IS_WINDOWS) {
          console.error(chalk.dim(`  Try: sudo envshare install --dir /usr/local/bin`));
        }
      } else {
        console.error(chalk.red(`  Failed to install: ${err.message}`));
      }
      process.exit(1);
    }

    console.log(chalk.green(`  ✔ Installed envshare → ${dest}`));

    // PATH handling
    if (!isInPath(installDir)) {
      if (IS_WINDOWS) {
        process.stdout.write('  Adding to your user PATH…  ');
        if (addToWindowsPath(installDir)) {
          console.log(chalk.green('done'));
          console.log(chalk.dim('  Open a new terminal and run envshare --help to get started.\n'));
        } else {
          console.log(chalk.yellow('\n  ⚠  Could not update PATH automatically.'));
          console.log(chalk.dim('  Add this directory to your user PATH manually:'));
          console.log(chalk.cyan(`    ${installDir}`));
          console.log(chalk.dim('  Or run this in PowerShell:'));
          console.log(chalk.cyan(`    [Environment]::SetEnvironmentVariable('Path', $env:Path + ';${installDir}', 'User')\n`));
        }
      } else {
        // Linux / macOS
        console.log(chalk.yellow(`\n  ⚠  ${installDir} is not in your PATH.`));
        console.log(chalk.dim('  Add it by appending the following to your shell profile:\n'));
        if (IS_MAC) {
          console.log(chalk.dim('  ~/.zshrc  (macOS default since Catalina):'));
        } else {
          console.log(chalk.dim('  ~/.bashrc or ~/.zshrc:'));
        }
        console.log(chalk.cyan(`    export PATH="$HOME/.local/bin:$PATH"\n`));
        console.log(chalk.dim('  Then reload your shell:'));
        console.log(chalk.cyan(`    source ~/.zshrc   # or ~/.bashrc\n`));
      }
    } else {
      console.log(chalk.dim(`  Run ${chalk.bold('envshare --help')} to get started.\n`));
    }
  });
