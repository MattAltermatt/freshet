import { Liquid } from 'liquidjs';
import { registerFilters } from './helpers';
import { sanitize } from './sanitize';
import type { Variables } from '../shared/types';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function makeEngine(): Liquid {
  const engine = new Liquid({
    outputEscape: (value: unknown) => {
      if (value && typeof value === 'object' && (value as { __pjRaw?: true }).__pjRaw) {
        return String(value);
      }
      const s = value === undefined || value === null ? '' : String(value);
      return escapeHtml(s);
    },
  });
  registerFilters(engine);
  return engine;
}

export function render(templateText: string, json: unknown, vars: Variables): string {
  const engine = makeEngine();
  // When the root is an array (e.g. `restcountries.com/v3.1/name/{name}` returns
  // `[{...}]`), expose it as `items` so templates have a stable, identifier-safe
  // handle. Object roots continue to spread directly as before.
  const context = Array.isArray(json)
    ? { items: json, vars }
    : typeof json === 'object' && json !== null
      ? { ...(json as Record<string, unknown>), vars }
      : { vars };
  const output = engine.parseAndRenderSync(templateText, context);
  return sanitize(output);
}
