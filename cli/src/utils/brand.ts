import chalk from 'chalk';

/**
 * Small ASCII banner for envShare.
 * Kept compact (5 lines) so it doesn't dominate the terminal.
 */
const LOGO_LINES = [
  '                 ____  _                    ',
  '  ___ _ ____   _/ ___|| |__   __ _ _ __ ___ ',
  ' / _ \\ \'_ \\ \\ / \\___ \\| \'_ \\ / _` | \'__/ _ \\',
  '|  __/ | | \\ V / ___) | | | | (_| | | |  __/',
  ' \\___|_| |_|\\_/ |____/|_| |_|\\__,_|_|  \\___|',
];

/** Gradient palette — cycles through these colors for each line of the logo. */
const GRADIENT = [
  chalk.hex('#818cf8'),  // indigo-400
  chalk.hex('#6366f1'),  // indigo-500
  chalk.hex('#4f46e5'),  // indigo-600
  chalk.hex('#4338ca'),  // indigo-700
  chalk.hex('#3730a3'),  // indigo-800
];

/** Print the envShare logo with a color gradient. */
export function printBanner(): void {
  console.log();
  for (let i = 0; i < LOGO_LINES.length; i++) {
    console.log('  ' + GRADIENT[i % GRADIENT.length](LOGO_LINES[i]));
  }
  console.log();
}

/** Unicode box characters. */
const BOX = {
  tl: '╭', tr: '╮', bl: '╰', br: '╯',
  h: '─', v: '│',
};

/**
 * Draws a Unicode box around rows of [label, value] pairs.
 * Looks like:
 *   ╭──────────────────────────────────╮
 *   │  version   1.0.7                 │
 *   │  node      v20.11.0              │
 *   ╰──────────────────────────────────╯
 */
export function printInfoBox(rows: [string, string][]): void {
  const labelWidth = 12;
  const maxValueLen = Math.max(...rows.map(([, v]) => stripAnsi(v).length));
  const innerWidth = labelWidth + maxValueLen + 2; // 2 = padding around content
  const width = Math.max(innerWidth, 36);

  const hLine = BOX.h.repeat(width);
  console.log(chalk.dim(`  ${BOX.tl}${hLine}${BOX.tr}`));

  for (const [label, value] of rows) {
    const visibleLen = stripAnsi(value).length;
    const padding = ' '.repeat(Math.max(0, width - labelWidth - visibleLen - 2));
    console.log(
      chalk.dim(`  ${BOX.v}`) +
      ` ${chalk.dim(label.padEnd(labelWidth))}${value}${padding} ` +
      chalk.dim(BOX.v),
    );
  }

  console.log(chalk.dim(`  ${BOX.bl}${hLine}${BOX.br}`));
}

/** Strip ANSI escape codes to measure visible width. */
function stripAnsi(s: string): string {
  // eslint-disable-next-line no-control-regex
  return s.replace(/\x1b\[[0-9;]*m/g, '');
}

/**
 * Animated "dots" for operations without a known progress.
 * Returns a frame string: ·  , ·· , ···
 */
const DOT_FRAMES = ['·  ', '·· ', '···', ' ··', '  ·', '   '];

export function dotFrame(tick: number): string {
  return chalk.dim(DOT_FRAMES[tick % DOT_FRAMES.length]);
}

/**
 * Display a success line with an animated checkmark reveal.
 * Shows ✔ with a brief green flash.
 */
export function successLine(msg: string): void {
  console.log(`  ${chalk.green('✔')} ${msg}`);
}

/**
 * Display a failure line.
 */
export function failLine(msg: string): void {
  console.log(`  ${chalk.red('✖')} ${msg}`);
}

/**
 * Section header with a subtle line decoration.
 *   ── Push to my-project ──────────────────
 */
export function sectionHeader(text: string, width = 48): void {
  const prefix = `── ${text} `;
  const remaining = Math.max(0, width - prefix.length);
  console.log(`\n  ${chalk.dim(prefix + '─'.repeat(remaining))}`);
}
