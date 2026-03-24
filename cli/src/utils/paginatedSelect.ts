/**
 * Minimal paginated single-select for compiled binaries.
 * Renders only pageSize lines at a time.
 * Handles: ↑↓ navigate, Enter confirm, Ctrl+C abort.
 *
 * Hardened for pkg compiled binaries:
 * - TTY guard: returns first choice in non-TTY environments (CI/pipe mode)
 * - Buffers escape sequences that may arrive split across data events
 * - Wraps setRawMode in try/catch with fallback
 * - Fixed-height rendering prevents ghost lines when scrolling
 */

const HIDE_CURSOR = '\x1b[?25l';
const SHOW_CURSOR = '\x1b[?25h';
const CLEAR_LINE  = '\r\x1b[K';
const MOVE_UP     = (n: number) => `\x1b[${n}A`;

export interface SelectChoice {
  title: string;
  value: string;
}

export async function paginatedSelect(
  message: string,
  choices: SelectChoice[],
  pageSize = 16,
): Promise<string | null> {
  if (!choices.length) return null;

  // TTY guard — in CI / pipe mode return first choice
  if (!process.stdin.isTTY) {
    return choices[0].value;
  }

  let cursor = 0;
  let offset = 0;

  const write = (s: string) => process.stdout.write(s);
  const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

  // Fixed number of lines: always pageSize + 1 (for hint/padding).
  // This prevents ghost lines when the page shrinks or grows by 1.
  const totalLines = Math.min(pageSize, choices.length) + 1;

  function renderPage(): string[] {
    const lines: string[] = [];
    const end = Math.min(offset + pageSize, choices.length);

    for (let i = offset; i < end; i++) {
      const c = choices[i];
      const isCursor = i === cursor;
      const pointer  = isCursor ? '\x1b[36m❯\x1b[0m' : ' ';
      const label    = isCursor ? `\x1b[1m\x1b[36m${c.title}\x1b[0m` : c.title;
      lines.push(`${pointer} ${label}`);
    }

    const hasAbove = offset > 0;
    const hasBelow = offset + pageSize < choices.length;
    const hint = [
      hasAbove ? '↑ more above' : '',
      hasBelow ? '↓ more below' : '',
    ].filter(Boolean).join('  ');

    if (hint) lines.push(`\x1b[90m  ${hint}\x1b[0m`);

    // Pad to fixed height so MOVE_UP distance is always the same
    while (lines.length < totalLines) lines.push('');

    return lines;
  }

  function draw(firstDraw = false) {
    if (!firstDraw) {
      write(MOVE_UP(totalLines));
    }
    const lines = renderPage();
    for (let i = 0; i < totalLines; i++) {
      write(CLEAR_LINE + lines[i]);
      if (i < totalLines - 1) write('\n');
    }
  }

  const header = `\x1b[1m?\x1b[0m ${message} \x1b[90m(↑↓ navigate · enter select)\x1b[0m`;

  write(HIDE_CURSOR);
  write(header + '\n');
  draw(true);

  return new Promise((resolve) => {
    const { stdin } = process;
    let inputBuf = '';
    let flushTimer: ReturnType<typeof setTimeout> | null = null;

    const sigHandler = () => cleanup(null);

    const cleanup = (value: string | null) => {
      if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
      try { stdin.setRawMode(false); } catch { /* ignore */ }
      stdin.pause();
      stdin.removeListener('data', onData);
      process.removeListener('SIGTERM', sigHandler);
      write(SHOW_CURSOR);

      // Clear header + content: move to header, clear all, reposition
      const clearCount = totalLines + 1; // +1 for header
      write('\n' + MOVE_UP(totalLines + 1));
      for (let i = 0; i < clearCount; i++) write(CLEAR_LINE + '\n');
      write(MOVE_UP(clearCount));

      if (value !== null) {
        const chosen = choices.find(c => c.value === value);
        write(`\x1b[32m✔\x1b[0m ${message} \x1b[90m${chosen?.title ?? value}\x1b[0m\n`);
        resolve(value);
      } else {
        write(`\x1b[33m✖\x1b[0m ${message} \x1b[90m(aborted)\x1b[0m\n`);
        resolve(null);
      }
    };

    function moveCursor(delta: number) {
      const next = clamp(cursor + delta, 0, choices.length - 1);
      if (next === cursor) return;
      cursor = next;
      if (cursor < offset) offset = cursor;
      if (cursor >= offset + pageSize) offset = cursor - pageSize + 1;
      draw();
    }

    function handleKey(key: string) {
      if (key === '\x03') { cleanup(null); return; }
      if (key === '\r' || key === '\n') { cleanup(choices[cursor].value); return; }
      if (key === '\x1b[A') { moveCursor(-1); return; }
      if (key === '\x1b[B') { moveCursor(+1); return; }
      if (key === '\x1b[5~') { moveCursor(-pageSize); return; }
      if (key === '\x1b[6~') { moveCursor(+pageSize); return; }
    }

    function processInputBuf(force = false) {
      while (inputBuf.length > 0) {
        const ch = inputBuf[0];
        if (ch === '\x1b') {
          // 4-byte CSI sequence: \x1b[5~ or \x1b[6~
          if (inputBuf.length >= 4 && inputBuf[1] === '[' && inputBuf[3] === '~') {
            handleKey(inputBuf.slice(0, 4));
            inputBuf = inputBuf.slice(4);
          // 3-byte CSI sequence: \x1b[A, \x1b[B, etc.
          } else if (inputBuf.length >= 3 && inputBuf[1] === '[') {
            handleKey(inputBuf.slice(0, 3));
            inputBuf = inputBuf.slice(3);
          } else if (force) {
            handleKey(inputBuf);
            inputBuf = '';
          } else {
            // Incomplete sequence — wait briefly for remaining bytes
            flushTimer = setTimeout(() => {
              flushTimer = null;
              processInputBuf(true);
            }, 50);
            return;
          }
        } else {
          handleKey(ch);
          inputBuf = inputBuf.slice(1);
        }
      }
    }

    function onData(buf: Buffer) {
      inputBuf += buf.toString();
      if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
      processInputBuf();
    }

    try {
      stdin.setRawMode(true);
    } catch {
      // Cannot set raw mode — return first choice
      resolve(choices[0]?.value ?? null);
      return;
    }
    stdin.resume();
    stdin.on('data', onData);
    process.once('SIGTERM', sigHandler);
  });
}
