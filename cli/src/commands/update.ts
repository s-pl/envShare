import { Command } from 'commander';
import { writeFileSync, renameSync, chmodSync, existsSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { platform, arch } from 'os';
import { spawn } from 'child_process';
import chalk from 'chalk';

const IS_WINDOWS = platform() === 'win32';

function getAssetName(): string {
  const p = platform();
  const a = arch();
  if (p === 'win32') return 'envshare-windows-x64.exe';
  if (p === 'darwin') return a === 'arm64' ? 'envshare-macos-arm64' : 'envshare-macos-x64';
  return 'envshare-linux-x64';
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'envshare-cli', 'Accept': 'application/vnd.github.v3+json' },
  });
  if (!res.ok) throw new Error(`GitHub API error: ${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}

async function downloadBinary(url: string, dest: string): Promise<void> {
  const res = await fetch(url, { headers: { 'User-Agent': 'envshare-cli' } });
  if (!res.ok) throw new Error(`Download failed: ${res.status} ${res.statusText}`);
  const buf = await res.arrayBuffer();
  writeFileSync(dest, Buffer.from(buf));
}

export const updateCommand = new Command('update')
  .description('Download and install the latest envshare release from GitHub')
  .option('--check', 'Only check if a newer version is available, do not install')
  .action(async (opts) => {
    const GITHUB_REPO =
      typeof __GITHUB_REPO__ !== 'undefined' && __GITHUB_REPO__
        ? __GITHUB_REPO__
        : 'OWNER/envShare';

    // Build date injected at compile time — used to detect re-published releases
    // that share the same version number (e.g. hotfix pushed to the same tag).
    const buildDate =
      typeof __BUILD_DATE__ !== 'undefined' && __BUILD_DATE__
        ? new Date(__BUILD_DATE__)
        : null;

    // ── 1. Fetch latest release from GitHub ───────────────────────────────────
    process.stdout.write('  Checking for updates…  ');
    let release: any;
    try {
      release = await fetchJson(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`);
    } catch (err: any) {
      console.log(chalk.red('failed'));
      console.error(chalk.red(`  ${err.message}`));
      process.exit(1);
    }

    // ── 2. Pick the right asset for this platform ─────────────────────────────
    const assetName = getAssetName();
    const asset = (release.assets as any[])?.find((a: any) => a.name === assetName);
    if (!asset) {
      console.log('');
      console.error(chalk.red(`  No binary found for your platform (expected: ${assetName})`));
      console.error(chalk.dim(`  Visit: https://github.com/${GITHUB_REPO}/releases`));
      process.exit(1);
    }

    // Compare by asset publication date vs binary build date.
    // This handles the case where the release tag stays the same (v1.0.0)
    // but the CI re-publishes a newer binary to it.
    const assetDate = new Date(asset.updated_at as string);
    const latestTag = release.tag_name as string;

    const isOutdated = buildDate === null || assetDate > buildDate;

    console.log(chalk.dim(`${latestTag}  (published ${assetDate.toLocaleDateString()})`));

    if (!isOutdated) {
      console.log(chalk.green('  ✔ Already up to date.\n'));
      return;
    }

    if (buildDate) {
      console.log(chalk.dim(`  Your build: ${buildDate.toLocaleDateString()}  →  Released: ${assetDate.toLocaleDateString()}`));
    }

    if (opts.check) {
      console.log(chalk.yellow(`  Update available: ${latestTag}`));
      console.log(chalk.dim(`  Run ${chalk.bold('envshare update')} to install.\n`));
      return;
    }

    // ── 3. Download to a temp file ────────────────────────────────────────────
    const isCompiledBinary = !!(process as any).pkg;
    const currentExe = isCompiledBinary ? process.execPath : process.argv[1];
    const installDir  = dirname(currentExe);
    const tmpPath     = join(installDir, 'envshare-update.tmp');

    process.stdout.write(`  Downloading ${assetName}…  `);
    try {
      await downloadBinary(asset.browser_download_url, tmpPath);
      console.log(chalk.green('done'));
    } catch (err: any) {
      console.log(chalk.red('failed'));
      console.error(chalk.red(`  ${err.message}`));
      if (existsSync(tmpPath)) unlinkSync(tmpPath);
      process.exit(1);
    }

    // ── 4. Replace current binary ─────────────────────────────────────────────
    if (IS_WINDOWS) {
      // On Windows you cannot overwrite a running .exe, so we write a tiny
      // batch script that waits for this process to exit, swaps the files,
      // then deletes itself.
      const batchPath = join(installDir, '_envshare_update.bat');
      writeFileSync(
        batchPath,
        [
          '@echo off',
          'ping 127.0.0.1 -n 3 >nul',
          `move /y "${tmpPath}" "${currentExe}"`,
          `del "${batchPath}"`,
        ].join('\r\n'),
      );
      spawn('cmd.exe', ['/c', batchPath], { detached: true, stdio: 'ignore' }).unref();
      console.log(chalk.green(`  ✔ Update to ${latestTag} will complete when you open a new terminal.\n`));
    } else {
      try {
        renameSync(tmpPath, currentExe);
        chmodSync(currentExe, 0o755);
        console.log(chalk.green(`  ✔ Updated to ${latestTag}. Restart your terminal to use it.\n`));
      } catch (err: any) {
        if (existsSync(tmpPath)) unlinkSync(tmpPath);
        console.error(chalk.red(`  Failed to replace binary: ${err.message}`));
        if (err.code === 'EACCES') {
          console.error(chalk.dim(`  Try running with sudo or install to a user-writable path.`));
        }
        process.exit(1);
      }
    }
  });
