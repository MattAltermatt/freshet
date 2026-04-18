import type { Variables } from '../shared/types';

export function lookup(path: string, json: unknown, vars: Variables): unknown {
  if (path.startsWith('@')) return vars[path.slice(1)];
  const parts = path.split('.');
  let current: unknown = json;
  if (parts[0] === 'this') parts.shift();
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    if (typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}
