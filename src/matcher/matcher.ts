import { compileGlob } from './glob';
import type { Rule } from '../shared/types';

export function match(url: string, rules: Rule[]): Rule | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  const host = parsed.hostname;
  const path = parsed.pathname;

  for (const rule of rules) {
    if (!rule.enabled) continue;
    const hostRe = compileGlob(rule.hostPattern, { caseInsensitive: true });
    const pathRe = compileGlob(rule.pathPattern, { caseInsensitive: false });
    if (hostRe.test(host) && pathRe.test(path)) return rule;
  }
  return null;
}
