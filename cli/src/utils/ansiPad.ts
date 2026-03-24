/** Strips ANSI escape codes to measure visible string width. */
function visibleLength(str: string): number {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1b\[[0-9;]*[mGKHFABCDJsu]/g, '').length;
}

/** Like String.padEnd but measures visible width, ignoring ANSI escape codes. */
export function padEnd(str: string, width: number): string {
  const visible = visibleLength(str);
  return str + ' '.repeat(Math.max(0, width - visible));
}

/** Like String.padStart but measures visible width, ignoring ANSI escape codes. */
export function padStart(str: string, width: number): string {
  const visible = visibleLength(str);
  return ' '.repeat(Math.max(0, width - visible)) + str;
}
