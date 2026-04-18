export type OptionsDirective =
  | { kind: 'test-url'; url: string }
  | { kind: 'new-rule'; host: string }
  | { kind: 'edit-rule'; ruleId: string };

function safeDecode(s: string): string | null {
  try {
    return decodeURIComponent(s);
  } catch {
    return null;
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

  if (raw.startsWith('new-rule:host=')) {
    const host = safeDecode(raw.slice('new-rule:host='.length));
    if (!host) return null;
    return { kind: 'new-rule', host };
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
  newRule: (host: string): string => `#new-rule:host=${encodeURIComponent(host)}`,
  editRule: (ruleId: string): string => `#edit-rule=${encodeURIComponent(ruleId)}`,
};
