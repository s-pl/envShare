import { describe, it, expect } from 'vitest';
import { padEnd, padStart } from '../../utils/ansiPad';

describe('padEnd', () => {
  it('pads a plain string to the right', () => {
    expect(padEnd('hi', 5)).toBe('hi   ');
  });

  it('does not truncate strings longer than width', () => {
    expect(padEnd('hello world', 5)).toBe('hello world');
  });

  it('handles empty string', () => {
    expect(padEnd('', 4)).toBe('    ');
  });

  it('returns string unchanged when width matches', () => {
    expect(padEnd('abc', 3)).toBe('abc');
  });

  it('pads ANSI-colored string by visible width, not raw length', () => {
    const colored = '\x1b[32mcreated\x1b[39m'; // chalk.green('created')
    const result = padEnd(colored, 12);
    // Visible chars = "created" = 7, so 5 spaces added
    const visibleResult = result.replace(/\x1b\[[0-9;]*[mGKHFABCDJsu]/g, '');
    expect(visibleResult).toBe('created     ');
  });

  it('handles multiple ANSI sequences in one string', () => {
    const s = '\x1b[1m\x1b[36mword\x1b[0m'; // bold+cyan "word"
    const result = padEnd(s, 8);
    const visible = result.replace(/\x1b\[[0-9;]*[mGKHFABCDJsu]/g, '');
    expect(visible).toBe('word    ');
  });

  it('returns string unchanged when width is 0', () => {
    expect(padEnd('abc', 0)).toBe('abc');
  });
});

describe('padStart', () => {
  it('pads a plain string to the left', () => {
    expect(padStart('hi', 5)).toBe('   hi');
  });

  it('pads ANSI-colored string by visible width', () => {
    const colored = '\x1b[32mhi\x1b[39m';
    const result = padStart(colored, 5);
    const visible = result.replace(/\x1b\[[0-9;]*[mGKHFABCDJsu]/g, '');
    expect(visible).toBe('   hi');
  });
});
