import { htmlEscape } from './escape';
import { lookup } from './lookup';
import type { Variables } from '../shared/types';

const INLINE_RE = /\{\{\{([^}]+)\}\}\}|\{\{([^}]+)\}\}/g;

export function render(templateText: string, json: unknown, vars: Variables): string {
  return templateText.replace(INLINE_RE, (_full, rawPath?: string, escPath?: string) => {
    if (rawPath !== undefined) {
      const v = lookup(rawPath.trim(), json, vars);
      return v === undefined || v === null ? '' : String(v);
    }
    return htmlEscape(lookup(escPath!.trim(), json, vars));
  });
}
