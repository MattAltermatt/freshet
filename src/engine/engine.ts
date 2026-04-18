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
  const context = typeof json === 'object' && json !== null
    ? { ...(json as Record<string, unknown>), vars }
    : { vars };
  const output = engine.parseAndRenderSync(templateText, context);
  return sanitize(output);
}
