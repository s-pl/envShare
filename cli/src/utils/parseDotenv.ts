export interface DotenvEntry {
  key: string;
  value: string;
  isShared: boolean;
}

/**
 * Parses a .env file into an array of entries.
 *
 * Supported syntax:
 * - KEY=value
 * - KEY="quoted value"
 * - KEY='single quoted'
 * - KEY="multiline\nvalue"  (double-quoted, spans multiple lines)
 * - # comment lines
 * - KEY=value  # @shared  (marks as shared)
 * - # inside quoted values is not treated as a comment
 */
export function parseDotenv(content: string): DotenvEntry[] {
  const entries: DotenvEntry[] = [];
  const lines = content.split('\n');
  let i = 0;

  while (i < lines.length) {
    const raw = lines[i];
    i++;

    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;

    const eqIdx = line.indexOf('=');
    if (eqIdx === -1) continue;

    const key = line.slice(0, eqIdx).trim();
    if (!key) continue;

    const rest = line.slice(eqIdx + 1);

    let value: string;
    let isShared: boolean;

    if (rest.startsWith('"')) {
      // Double-quoted — may span multiple lines
      let raw = rest.slice(1);
      // Collect continuation lines if quote is not closed
      while (!isClosingQuote(raw, '"') && i < lines.length) {
        raw += '\n' + lines[i];
        i++;
      }
      // Strip trailing closing quote and anything after it
      const closeIdx = findClosingDoubleQuote(raw);
      const inner = closeIdx !== -1 ? raw.slice(0, closeIdx) : raw;
      const tail = closeIdx !== -1 ? raw.slice(closeIdx + 1) : '';
      value = unescapeDoubleQuoted(inner);
      isShared = /#\s*@shared/i.test(tail);
    } else if (rest.startsWith("'")) {
      // Single-quoted — no escape processing, no multiline
      const closeIdx = rest.indexOf("'", 1);
      const inner = closeIdx !== -1 ? rest.slice(1, closeIdx) : rest.slice(1);
      const tail = closeIdx !== -1 ? rest.slice(closeIdx + 1) : '';
      value = inner;
      isShared = /#\s*@shared/i.test(tail);
    } else {
      // Unquoted — strip inline comment, detect @shared
      const sharedMatch = rest.match(/#\s*@shared/i);
      isShared = sharedMatch !== null;
      const commentIdx = sharedMatch ? rest.indexOf('#') : rest.indexOf('#');
      // For unquoted, everything before the first # is the value
      value = (commentIdx !== -1 ? rest.slice(0, commentIdx) : rest).trim();
    }

    entries.push({ key, value, isShared });
  }

  return entries;
}

/** Returns true if the string has a closing double-quote that is not escaped. */
function isClosingQuote(s: string, q: string): boolean {
  return findClosingDoubleQuote(s) !== -1;
}

/** Finds the index of the first unescaped closing double-quote. */
function findClosingDoubleQuote(s: string): number {
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '\\') { i++; continue; }
    if (s[i] === '"') return i;
  }
  return -1;
}

function unescapeDoubleQuoted(s: string): string {
  return s
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\');
}
