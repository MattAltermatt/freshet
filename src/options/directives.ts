import { suggestPathPattern } from '../shared/suggestPathPattern';

export type OptionsDirective =
  | { kind: 'test-url'; url: string }
  | { kind: 'new-rule'; host: string; path: string }
  | { kind: 'edit-rule'; ruleId: string };

function safeDecode(s: string): string | null {
  try {
    return decodeURIComponent(s);
  } catch {
    return null;
  }
}

function parseNewRuleUrl(raw: string): { host: string; path: string } | null {
  const decoded = safeDecode(raw);
  if (!decoded) return null;
  try {
    const u = new URL(decoded);
    return { host: u.hostname, path: suggestPathPattern(u.pathname) };
  } catch {
    // Not a full URL — treat as a bare host for robustness against callers
    // that still pass just a hostname. Path defaults to the root pattern.
    return { host: decoded, path: '/' };
  }
}

export function parseDirective(hash: string): OptionsDirective | null {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash;
  if (!raw) return null;

  if (raw.startsWith('test-url=')) {
    const url = safeDecode(raw.slice('test-url='.length));
    if (!url) return null;
    return { kind: 'test-url', url };
  }

  if (raw.startsWith('new-rule=')) {
    const parsed = parseNewRuleUrl(raw.slice('new-rule='.length));
    if (!parsed) return null;
    return { kind: 'new-rule', ...parsed };
  }

  if (raw.startsWith('edit-rule=')) {
    const ruleId = safeDecode(raw.slice('edit-rule='.length));
    if (!ruleId) return null;
    return { kind: 'edit-rule', ruleId };
  }

  return null;
}

export const directiveHash = {
  testUrl: (url: string): string => `#test-url=${encodeURIComponent(url)}`,
  newRule: (url: string): string => `#new-rule=${encodeURIComponent(url)}`,
  editRule: (ruleId: string): string => `#edit-rule=${encodeURIComponent(ruleId)}`,
};
