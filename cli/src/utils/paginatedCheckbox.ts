/**
 * Minimal paginated multiselect for compiled binaries.
 * Renders only pageSize lines at a time, writes no long summary line on confirm.
 * Handles: ↑↓ navigate, Space toggle, 'a' toggle all, Enter confirm, Ctrl+C abort.
 *
 * Hardened for pkg compiled binaries:
 * - TTY guard: returns all checked in non-TTY environments (CI/pipe mode)
 * - Buffers escape sequences that may arrive split across data events
 * - Wraps setRawMode in try/catch with fallback
 * - Fixed-height rendering prevents ghost lines when scrolling
 */

const HIDE_CURSOR = '\x1b[?25l';
const SHOW_CURSOR = '\x1b[?25h';
const CLEAR_LINE  = '\r\x1b[K';
const MOVE_UP     = (n: number) => `\x1b[${n}A`;

export interface CheckboxChoice {
  name: string;
  value: string;
  checked?: boolean;
  group?: string;
}

export async function paginatedCheckbox(
  message: string,
  choices: CheckboxChoice[],
  pageSize = 16,
): Promise<string[]> {
  if (!choices.length) return [];

  // TTY guard — in CI / pipe mode return all checked immediately
  if (!process.stdin.isTTY) {
    return choices.filter(c => c.checked !== false).map(c => c.value);
  }

  const checked = new Set(choices.filter(c => c.checked !== false).map(c => c.value));
  let cursor = 0;
  let offset = 0;

  const write = (s: string) => process.stdout.write(s);
  const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

  // Fixed number of lines: always pageSize + 1 (for hint/padding).
  const totalLines = Math.min(pageSize, choices.length) + 1;

  function renderPage(): string[] {
    const lines: string[] = [];
    const end = Math.min(offset + pageSize, choices.length);

    for (let i = offset; i < end; i++) {
      const c = choices[i];
      const isCursor  = i === cursor;
      const isChecked = checked.has(c.value);

      const pointer  = isCursor  ? '\x1b[36m❯\x1b[0m' : ' ';
      const checkbox = isChecked ? '\x1b[32m◉\x1b[0m' : '\x1b[90m◯\x1b[0m';
      const label    = isCursor
        ? `\x1b[1m${c.name}\x1b[0m`
        : isChecked
          ? c.name
          : `\x1b[90m${c.name}\x1b[0m`;
      const group = c.group ? `  \x1b[90m(${c.group})\x1b[0m` : '';

      lines.push(`${pointer} ${checkbox} ${label}${group}`);
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

  const header = () => `\x1b[1m?\x1b[0m ${message} \x1b[90m(↑↓ navigate · space toggle · a = all · enter confirm)\x1b[0m`;

  write(HIDE_CURSOR);
  write(header() + '\n');
  draw(true);

  return new Promise((resolve) => {
    const { stdin } = process;
    let inputBuf = '';
    let flushTimer: ReturnType<typeof setTimeout> | null = null;

    const sigHandler = () => cleanup(null);

    const cleanup = (result: string[] | null) => {
      if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
      try { stdin.setRawMode(false); } catch { /* ignore */ }
      stdin.pause();
      stdin.removeListener('data', onData);
      process.removeListener('SIGTERM', sigHandler);
      write(SHOW_CURSOR);

      // Clear header + content
      const clearCount = totalLines + 1;
      write('\n' + MOVE_UP(totalLines + 1));
      for (let i = 0; i < clearCount; i++) write(CLEAR_LINE + '\n');
      write(MOVE_UP(clearCount));

      if (result !== null) {
        write(`\x1b[32m✔\x1b[0m ${message} \x1b[90m(${result.length} selected)\x1b[0m\n`);
        resolve(result);
      } else {
        write(`\x1b[33m✖\x1b[0m ${message} \x1b[90m(aborted)\x1b[0m\n`);
        resolve([]);
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
      if (key === '\r' || key === '\n') { cleanup([...checked]); return; }

      if (key === ' ') {
        const val = choices[cursor].value;
        if (checked.has(val)) checked.delete(val);
        else checked.add(val);
        draw();
        return;
      }

      if (key === 'a' || key === 'A') {
        if (checked.size === choices.length) checked.clear();
        else choices.forEach(c => checked.add(c.value));
        draw();
        return;
      }

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
            // Timeout — flush whatever we have
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
      // Cannot set raw mode (e.g. not a real TTY) — return all checked
      resolve(choices.filter(c => c.checked !== false).map(c => c.value));
      return;
    }
    stdin.resume();
    stdin.on('data', onData);
    process.once('SIGTERM', sigHandler);
  });
}
