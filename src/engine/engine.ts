import { Liquid } from 'liquidjs';
import { sanitize } from './sanitize';
import type { Variables } from '../shared/types';

const engine = new Liquid({ outputEscape: 'escape' });

export function render(templateText: string, json: unknown, vars: Variables): string {
  const context = typeof json === 'object' && json !== null
    ? { ...(json as Record<string, unknown>), vars }
    : { vars };
  const output = engine.parseAndRenderSync(templateText, context);
  return sanitize(output);
}
