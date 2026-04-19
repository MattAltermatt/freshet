import { compileGlob } from './glob';
import type { Rule } from '../shared/types';

/** True when `host` matches `pattern` under the host (case-insensitive) rules. */
export function matchesHost(host: string, pattern: string): boolean {
  try {
    return compileGlob(pattern, { caseInsensitive: true }).test(host);
  } catch {
    return false;
  }
}

/** True when `path` matches `pattern` under the path (case-sensitive) rules. */
export function matchesPath(path: string, pattern: string): boolean {
  try {
    return compileGlob(pattern, { caseInsensitive: false }).test(path);
  } catch {
    return false;
  }
}

/** First active rule whose host+path patterns both match the URL's host/path. */
export function findMatchingRule(host: string, path: string, rules: Rule[]): Rule | null {
  for (const rule of rules) {
    if (!rule.active) continue;
    if (matchesHost(host, rule.hostPattern) && matchesPath(path, rule.pathPattern)) {
      return rule;
    }
  }
  return null;
}

export function match(url: string, rules: Rule[]): Rule | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  return findMatchingRule(parsed.hostname, parsed.pathname, rules);
}
