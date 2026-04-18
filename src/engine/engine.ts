import { htmlEscape } from './escape';
import { lookup } from './lookup';
import type { Variables } from '../shared/types';

const INLINE_RE = /\{\{\{([^}]+)\}\}\}|\{\{([^}]+)\}\}/g;

export function render(templateText: string, json: unknown, vars: Variables): string {
  const afterBlocks = renderBlocks(templateText, json, vars);
  return renderInline(afterBlocks, json, vars);
}

function renderInline(text: string, json: unknown, vars: Variables): string {
  return text.replace(INLINE_RE, (_full, rawPath?: string, escPath?: string) => {
    if (rawPath !== undefined) {
      const v = lookup(rawPath.trim(), json, vars);
      return v === undefined || v === null ? '' : String(v);
    }
    return htmlEscape(lookup(escPath!.trim(), json, vars));
  });
}

function renderBlocks(text: string, json: unknown, vars: Variables): string {
  while (true) {
    const loc = findInnermostWhen(text);
    if (!loc) return text;
    const lhsValue = lookup(loc.lhs, json, vars);
    const pick = String(lhsValue ?? '') === loc.rhsLiteral ? loc.trueBranch : loc.elseBranch;
    const recursed = renderBlocks(pick, json, vars);
    text = text.slice(0, loc.start) + recursed + text.slice(loc.end);
  }
}

const OPEN_WHEN_RE = /\{\{#when\s+(@?[\w.]+)\s+"([^"]*)"\s*\}\}/;
const CLOSE_WHEN = '{{/when}}';
const ELSE_TAG = '{{#else}}';

interface WhenLoc {
  start: number;
  end: number;
  lhs: string;
  rhsLiteral: string;
  trueBranch: string;
  elseBranch: string;
}

function findInnermostWhen(text: string): WhenLoc | null {
  const opens: Array<{ idx: number; len: number; m: RegExpMatchArray }> = [];
  let cursor = 0;
  while (cursor < text.length) {
    const s = text.slice(cursor);
    const m = s.match(OPEN_WHEN_RE);
    if (!m || m.index === undefined) break;
    const idx = cursor + m.index;
    opens.push({ idx, len: m[0].length, m });
    cursor = idx + m[0].length;
  }
  for (let k = opens.length - 1; k >= 0; k--) {
    const open = opens[k]!;
    const bodyStart = open.idx + open.len;
    const close = text.indexOf(CLOSE_WHEN, bodyStart);
    if (close === -1) continue;
    if (opens.slice(k + 1).some((o) => o.idx < close)) continue;
    const body = text.slice(bodyStart, close);
    const elseIdx = body.indexOf(ELSE_TAG);
    return {
      start: open.idx,
      end: close + CLOSE_WHEN.length,
      lhs: open.m[1]!,
      rhsLiteral: open.m[2]!,
      trueBranch: elseIdx === -1 ? body : body.slice(0, elseIdx),
      elseBranch: elseIdx === -1 ? '' : body.slice(elseIdx + ELSE_TAG.length),
    };
  }
  return null;
}
