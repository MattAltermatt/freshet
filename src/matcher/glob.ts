export interface CompileOptions {
  caseInsensitive: boolean;
}

const REGEX_ESCAPE = /[.*+?^${}()|[\]\\]/g;

function escapeForRegex(literal: string): string {
  return literal.replace(REGEX_ESCAPE, '\\$&');
}

function globToRegexBody(pattern: string): string {
  let out = '';
  let i = 0;
  while (i < pattern.length) {
    if (pattern[i] === '*' && pattern[i + 1] === '*') {
      out += '.*';
      i += 2;
      continue;
    }
    if (pattern[i] === '*') {
      out += '[^/]*';
      i += 1;
      continue;
    }
    out += escapeForRegex(pattern[i]!);
    i += 1;
  }
  return out;
}

export function compileGlob(pattern: string, opts: CompileOptions): RegExp {
  const flags = opts.caseInsensitive ? 'i' : '';
  if (pattern.startsWith('/') && pattern.endsWith('/') && pattern.length > 2) {
    return new RegExp(pattern.slice(1, -1), flags);
  }
  return new RegExp(`^${globToRegexBody(pattern)}$`, flags);
}

/** UI validator: host pattern can be empty (matches anything) or any compilable glob/regex. */
export function isValidHostPattern(pattern: string): boolean {
  if (pattern === '') return true;
  try {
    compileGlob(pattern, { caseInsensitive: true });
    return true;
  } catch {
    return false;
  }
}

/** UI validator: path pattern must be non-empty and compile as a glob or regex. */
export function isValidPathPattern(pattern: string): boolean {
  if (pattern === '') return false;
  try {
    compileGlob(pattern, { caseInsensitive: false });
    return true;
  } catch {
    return false;
  }
}
