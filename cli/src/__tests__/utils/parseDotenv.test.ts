import { describe, it, expect } from 'vitest';
import { parseDotenv } from '../../utils/parseDotenv';

describe('parseDotenv', () => {
  it('parses basic KEY=value', () => {
    const result = parseDotenv('KEY=value');
    expect(result).toEqual([{ key: 'KEY', value: 'value', isShared: false }]);
  });

  it('parses double-quoted value', () => {
    const result = parseDotenv('KEY="hello world"');
    expect(result).toEqual([{ key: 'KEY', value: 'hello world', isShared: false }]);
  });

  it('parses single-quoted value', () => {
    const result = parseDotenv("KEY='hello world'");
    expect(result).toEqual([{ key: 'KEY', value: 'hello world', isShared: false }]);
  });

  it('skips comment lines', () => {
    const result = parseDotenv('# this is a comment\nKEY=value');
    expect(result).toHaveLength(1);
    expect(result[0].key).toBe('KEY');
  });

  it('skips empty lines', () => {
    const result = parseDotenv('\n\nKEY=value\n\n');
    expect(result).toHaveLength(1);
  });

  it('skips lines without =', () => {
    const result = parseDotenv('NOTANENVVAR\nKEY=value');
    expect(result).toHaveLength(1);
  });

  it('parses empty value', () => {
    const result = parseDotenv('KEY=');
    expect(result).toEqual([{ key: 'KEY', value: '', isShared: false }]);
  });

  it('detects @shared annotation on unquoted value', () => {
    const result = parseDotenv('KEY=value # @shared');
    expect(result[0].isShared).toBe(true);
    expect(result[0].value).toBe('value');
  });

  it('detects @shared annotation when value has no space', () => {
    const result = parseDotenv('KEY=value #@shared');
    expect(result[0].isShared).toBe(true);
  });

  it('strips inline comment from unquoted value', () => {
    const result = parseDotenv('KEY=value # just a comment');
    expect(result[0].value).toBe('value');
    expect(result[0].isShared).toBe(false);
  });

  it('does NOT treat # inside double quotes as a comment', () => {
    const result = parseDotenv('KEY="value with # hash"');
    expect(result[0].value).toBe('value with # hash');
    expect(result[0].isShared).toBe(false);
  });

  it('detects @shared after closing double-quote', () => {
    const result = parseDotenv('KEY="shared value" # @shared');
    expect(result[0].value).toBe('shared value');
    expect(result[0].isShared).toBe(true);
  });

  it('handles escaped characters in double-quoted values', () => {
    const result = parseDotenv('KEY="line1\\nline2"');
    expect(result[0].value).toBe('line1\nline2');
  });

  it('handles escaped double-quote inside double-quoted value', () => {
    const result = parseDotenv('KEY="say \\"hello\\""');
    expect(result[0].value).toBe('say "hello"');
  });

  it('handles multiline double-quoted value', () => {
    const content = 'KEY="line1\nline2\nline3"';
    const result = parseDotenv(content);
    expect(result[0].value).toBe('line1\nline2\nline3');
  });

  it('parses multiple entries', () => {
    const content = 'A=1\nB=2\nC=3';
    const result = parseDotenv(content);
    expect(result).toHaveLength(3);
    expect(result.map(e => e.key)).toEqual(['A', 'B', 'C']);
  });

  it('trims key whitespace', () => {
    const result = parseDotenv('  KEY  =value');
    expect(result[0].key).toBe('KEY');
  });

  it('skips entry with empty key after trim', () => {
    const result = parseDotenv('=nokey');
    expect(result).toHaveLength(0);
  });

  it('handles Windows-style line endings', () => {
    const result = parseDotenv('KEY=value\r\nOTHER=x');
    expect(result).toHaveLength(2);
  });
});
