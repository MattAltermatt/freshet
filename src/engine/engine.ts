import { htmlEscape } from './escape';
import { lookup } from './lookup';
import { formatDate, buildLink, formatNumber } from './helpers';
import { sanitize } from './sanitize';
import type { Variables } from '../shared/types';

const INLINE_RE = /\{\{\{([^}]+)\}\}\}|\{\{([^}]+)\}\}/g;
const LINK_RE = /\{\{link\s+"([^"]*)"\s*\}\}/g;
const DATE_RE = /\{\{date\s+(@?[\w.]+)(?:\s+"([^"]*)")?\s*\}\}/g;
const NUM_RE = /\{\{num\s+(@?[\w.]+)\s*\}\}/g;
const OPEN_WHEN_G = /\{\{#when\s+(@?[\w.]+)\s+"([^"]*)"\s*\}\}/g;
const OPEN_EACH_G = /\{\{#each\s+(@?[\w.]+)\s*\}\}/g;
const CLOSE_WHEN = '{{/when}}';
const CLOSE_EACH = '{{/each}}';
const ELSE_TAG = '{{#else}}';

export function render(templateText: string, json: unknown, vars: Variables): string {
  const afterBlocks = renderBlocks(templateText, json, vars);
  const afterHelpers = renderHelpers(afterBlocks, json, vars);
  return sanitize(renderInline(afterHelpers, json, vars));
}

function renderHelpers(text: string, json: unknown, vars: Variables): string {
  return text
    .replace(LINK_RE, (_m, tmpl: string) => htmlEscape(buildLink(tmpl, json, vars)))
    .replace(DATE_RE, (_m, path: string, fmt?: string) =>
      htmlEscape(formatDate(lookup(path, json, vars), fmt)),
    )
    .replace(NUM_RE, (_m, path: string) =>
      htmlEscape(formatNumber(lookup(path, json, vars))),
    );
}

function renderInline(text: string, json: unknown, vars: Variables): string {
  return text.replace(INLINE_RE, (_full, rawPath?: string, escExpr?: string) => {
    if (rawPath !== undefined) {
      const v = lookup(rawPath.trim(), json, vars);
      return v === undefined || v === null ? '' : String(v);
    }
    return htmlEscape(lookup(escExpr!.trim(), json, vars));
  });
}

type Open =
  | { type: 'when'; idx: number; len: number; lhs: string; rhs: string }
  | { type: 'each'; idx: number; len: number; path: string };

function findFirstOpen(text: string, from: number): Open | null {
  OPEN_WHEN_G.lastIndex = from;
  const wm = OPEN_WHEN_G.exec(text);
  OPEN_EACH_G.lastIndex = from;
  const em = OPEN_EACH_G.exec(text);
  const wi = wm ? wm.index : Infinity;
  const ei = em ? em.index : Infinity;
  if (wi === Infinity && ei === Infinity) return null;
  if (wi <= ei) return { type: 'when', idx: wi, len: wm![0].length, lhs: wm![1]!, rhs: wm![2]! };
  return { type: 'each', idx: ei, len: em![0].length, path: em![1]! };
}

function findMatchingClose(
  text: string,
  kind: 'when' | 'each',
  bodyStart: number,
): number | null {
  const openRe = kind === 'when' ? OPEN_WHEN_G : OPEN_EACH_G;
  const closeTag = kind === 'when' ? CLOSE_WHEN : CLOSE_EACH;
  let depth = 1;
  let i = bodyStart;
  while (i < text.length) {
    openRe.lastIndex = i;
    const om = openRe.exec(text);
    const ci = text.indexOf(closeTag, i);
    if (ci === -1) return null;
    const oi = om ? om.index : Infinity;
    if (oi < ci) {
      depth += 1;
      i = oi + om![0].length;
    } else {
      depth -= 1;
      if (depth === 0) return ci;
      i = ci + closeTag.length;
    }
  }
  return null;
}

function findElseAtDepth0(body: string): number {
  let depth = 0;
  let i = 0;
  while (i < body.length) {
    OPEN_WHEN_G.lastIndex = i;
    const om = OPEN_WHEN_G.exec(body);
    const ci = body.indexOf(CLOSE_WHEN, i);
    const ei = body.indexOf(ELSE_TAG, i);
    const oi = om ? om.index : Infinity;
    const actualCi = ci === -1 ? Infinity : ci;
    const actualEi = ei === -1 ? Infinity : ei;
    const next = Math.min(oi, actualCi, actualEi);
    if (next === Infinity) return -1;
    if (next === actualEi && depth === 0) return actualEi;
    if (next === oi) {
      depth += 1;
      i = oi + om![0].length;
    } else if (next === actualCi) {
      depth -= 1;
      i = actualCi + CLOSE_WHEN.length;
    } else {
      i = actualEi + ELSE_TAG.length;
    }
  }
  return -1;
}

function renderBlocks(text: string, json: unknown, vars: Variables): string {
  const open = findFirstOpen(text, 0);
  if (!open) return text;

  const bodyStart = open.idx + open.len;
  const close = findMatchingClose(text, open.type, bodyStart);
  if (close === null) return text;

  const body = text.slice(bodyStart, close);
  const closeLen = open.type === 'when' ? CLOSE_WHEN.length : CLOSE_EACH.length;
  const prefix = text.slice(0, open.idx);
  const suffix = text.slice(close + closeLen);

  let middle: string;
  if (open.type === 'each') {
    const arr = lookup(open.path, json, vars);
    middle = Array.isArray(arr) ? arr.map((item) => render(body, item, vars)).join('') : '';
  } else {
    const elseIdx = findElseAtDepth0(body);
    const trueBranch = elseIdx === -1 ? body : body.slice(0, elseIdx);
    const elseBranch = elseIdx === -1 ? '' : body.slice(elseIdx + ELSE_TAG.length);
    const picked = String(lookup(open.lhs, json, vars) ?? '') === open.rhs ? trueBranch : elseBranch;
    middle = renderBlocks(picked, json, vars);
  }

  return prefix + middle + renderBlocks(suffix, json, vars);
}
