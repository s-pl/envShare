/**
 * Minimal paginated multiselect for compiled binaries.
 * Renders only pageSize lines at a time, writes no long summary line on confirm.
 * Handles: ↑↓ navigate, Space toggle, 'a' toggle all, Enter confirm, Ctrl+C abort.
 */

const ESC  = '\x1b[';
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

  const checked = new Set(choices.filter(c => c.checked !== false).map(c => c.value));
  let cursor = 0;
  let offset = 0; // first visible index

  const write = (s: string) => process.stdout.write(s);

  const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

  const visibleCount = () => Math.min(pageSize, choices.length);

  function renderPage() {
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

    return lines;
  }

  let renderedLines = 0;

  function draw(firstDraw = false) {
    if (!firstDraw && renderedLines > 0) {
      // Move cursor back up and clear previous render
      write(MOVE_UP(renderedLines));
      for (let i = 0; i < renderedLines; i++) write(CLEAR_LINE + (i < renderedLines - 1 ? '\n' : ''));
      write(MOVE_UP(renderedLines - 1));
    }

    const lines = renderPage();
    renderedLines = lines.length;
    write(lines.join('\n'));
  }

  // Print prompt header once
  const checkedCount = () => checked.size;
  const header = () => `\x1b[1m?\x1b[0m ${message} \x1b[90m(↑↓ navigate · space toggle · a = all · enter confirm)\x1b[0m`;

  write(HIDE_CURSOR);
  write(header() + '\n');
  draw(true);
  write('\n');
  renderedLines += 1; // account for extra newline

  return new Promise((resolve, reject) => {
    const { stdin } = process;
    const wasRaw = stdin.isRaw ?? false;

    const cleanup = (result: string[] | null) => {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.removeListener('data', onData);
      write(SHOW_CURSOR);

      // Clear everything and write a clean one-line summary
      write(MOVE_UP(renderedLines + 1)); // +1 for the header line
      for (let i = 0; i < renderedLines + 1; i++) write(CLEAR_LINE + '\n');
      write(MOVE_UP(renderedLines + 1));

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
      // Scroll window if needed
      if (cursor < offset) offset = cursor;
      if (cursor >= offset + pageSize) offset = cursor - pageSize + 1;
      draw();
    }

    function onData(buf: Buffer) {
      const key = buf.toString();

      if (key === '\x03') { cleanup(null); return; }      // Ctrl+C
      if (key === '\r' || key === '\n') { cleanup([...checked]); return; } // Enter

      if (key === ' ') {                                   // Space: toggle
        const val = choices[cursor].value;
        if (checked.has(val)) checked.delete(val);
        else checked.add(val);
        draw();
        return;
      }

      if (key === 'a' || key === 'A') {                    // 'a': toggle all
        if (checked.size === choices.length) checked.clear();
        else choices.forEach(c => checked.add(c.value));
        draw();
        return;
      }

      if (key === '\x1b[A') { moveCursor(-1); return; }   // ↑
      if (key === '\x1b[B') { moveCursor(+1); return; }   // ↓
      if (key === '\x1b[5~') { moveCursor(-pageSize); return; } // Page Up
      if (key === '\x1b[6~') { moveCursor(+pageSize); return; } // Page Down
    }

    stdin.setRawMode(true);
    stdin.resume();
    stdin.on('data', onData);
  });
}
