/**
 * Raw stdin prompt utilities hardened for pkg-compiled binaries.
 *
 * Does NOT use @inquirer/prompts, @inquirer/core, readline, or signal-exit.
 * signal-exit v4 (used internally by @inquirer/core) wraps process.emit and
 * corrupts memory in pkg's patched Node.js runtime, causing segfaults after
 * the last interactive prompt completes.
 *
 * Follows the same raw-mode pattern as paginatedSelect / paginatedCheckbox.
 */

import chalk from 'chalk';

// Track whether we've put stdin into raw mode so we can restore it later.
let _rawActive = false;

/**
 * Restore terminal to normal (cooked) mode.
 * Call this explicitly after all interactive prompts are done and before
 * any process.exit() or final output. Must NOT be called before ora.start()
 * in pkg binaries — only after all terminal I/O is complete.
 */
export function restoreTerminal(): void {
  if (_rawActive) {
    try { process.stdin.setRawMode(false); } catch { /* ignore */ }
    try { process.stdin.pause(); } catch { /* ignore */ }
    _rawActive = false;
  }
}

const CTRL_C  = '\x03';
const ENTER   = '\r';
const NEWLINE = '\n';
const BS      = '\x7f'; // DEL / backspace on most terminals
const BS2     = '\x08'; // ^H / legacy backspace
const CTRL_U  = '\x15'; // kill line

function doAbort(): never {
  try { process.stdin.setRawMode(false); } catch { /* ignore */ }
  process.stdin.pause();
  process.stdout.write('\n');
  console.log(chalk.yellow('  Aborted.'));
  process.exit(0);
}

async function rawRead(opts: {
  prefix: string;
  mask?: string;
  isConfirm?: boolean;
  defaultBool?: boolean;
}): Promise<string | boolean> {
  const { stdin, stdout } = process;

  if (!stdin.isTTY) {
    if (opts.isConfirm) return opts.defaultBool ?? false;
    return '';
  }

  stdout.write(opts.prefix);

  try {
    stdin.setRawMode(true);
    _rawActive = true;
  } catch {
    if (opts.isConfirm) return opts.defaultBool ?? false;
    return '';
  }
  stdin.resume();

  return new Promise<string | boolean>((resolve) => {
    let buf = '';
    let settled = false;

    function cleanup(result: string | boolean): void {
      if (settled) return;
      settled = true;
      stdin.removeListener('data', onData);
      // Do NOT call setRawMode(false) or pause() here.
      // In pkg-compiled binaries, calling setRawMode(false) after raw-mode
      // stdin sessions corrupts the terminal state and causes ora / stdout TTY
      // methods to segfault. The OS restores terminal state on process exit.
      resolve(result);
    }

    function onData(chunk: Buffer | string): void {
      const str = typeof chunk === 'string' ? chunk : chunk.toString('utf8');

      for (const ch of str) {
        if (ch === CTRL_C) {
          cleanup('');
          doAbort();
          return;
        }

        if (opts.isConfirm) {
          const lower = ch.toLowerCase();
          if (lower === 'y') { stdout.write('Yes\n'); cleanup(true); return; }
          if (lower === 'n') { stdout.write('No\n'); cleanup(false); return; }
          if (ch === ENTER || ch === NEWLINE) {
            const result = opts.defaultBool ?? false;
            stdout.write(result ? 'Yes\n' : 'No\n');
            cleanup(result);
            return;
          }
          continue; // ignore other chars in confirm mode
        }

        if (ch === ENTER || ch === NEWLINE) { stdout.write('\n'); cleanup(buf); return; }
        if (ch === BS || ch === BS2) {
          if (buf.length > 0) { buf = buf.slice(0, -1); stdout.write('\b \b'); }
          continue;
        }
        if (ch === CTRL_U) { stdout.write('\b \b'.repeat(buf.length)); buf = ''; continue; }
        if (ch < ' ') continue; // ignore other control chars

        buf += ch;
        stdout.write(opts.mask !== undefined ? opts.mask : ch);
      }
    }

    stdin.on('data', onData);
  });
}

export async function input(opts: { message: string; default?: string }): Promise<string> {
  const defaultHint = opts.default ? chalk.dim(` (${opts.default})`) : '';
  const prefix = `  ${chalk.green('?')} ${opts.message}${defaultHint} `;
  const result = await rawRead({ prefix }) as string;
  return result || opts.default || '';
}

export async function password(opts: { message: string; mask?: string }): Promise<string> {
  const prefix = `  ${chalk.green('?')} ${opts.message} `;
  return rawRead({ prefix, mask: opts.mask ?? '*' }) as Promise<string>;
}

export async function confirm(opts: { message: string; default?: boolean }): Promise<boolean> {
  const hint = opts.default === true ? 'Y/n' : 'y/N';
  const prefix = `  ${chalk.green('?')} ${opts.message} ${chalk.dim(`(${hint})`)} `;
  return rawRead({ prefix, isConfirm: true, defaultBool: opts.default }) as Promise<boolean>;
}
