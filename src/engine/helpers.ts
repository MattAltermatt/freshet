import type { Liquid } from 'liquidjs';
import { lookup } from './lookup';
import type { Variables } from '../shared/types';

const MONTHS_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const TOKEN_RE = /\{\{([^}]+)\}\}/g;

export function buildLink(template: string, json: unknown, vars: Variables): string {
  if (!template) return '';
  const qIdx = template.indexOf('?');
  const pathPart = qIdx === -1 ? template : template.slice(0, qIdx);
  const queryPart = qIdx === -1 ? '' : template.slice(qIdx);

  const interpolate = (part: string, encode: boolean): string =>
    part.replace(TOKEN_RE, (_m, p) => {
      const v = lookup(String(p).trim(), json, vars);
      const s = v === undefined || v === null ? '' : String(v);
      return encode ? encodeURIComponent(s) : s;
    });

  return interpolate(pathPart, false) + interpolate(queryPart, true);
}

export function formatNumber(input: unknown): string {
  if (input === undefined || input === null) return '';
  const n = typeof input === 'number' ? input : typeof input === 'string' ? Number(input) : NaN;
  if (!isFinite(n)) return '';
  if (Math.abs(n) < 1000) return String(Math.round(n));
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  const units: Array<[number, string]> = [
    [1e9, 'B'],
    [1e6, 'M'],
    [1e3, 'k'],
  ];
  for (const [mag, suffix] of units) {
    if (abs >= mag) {
      const scaled = abs / mag;
      const body = scaled >= 10
        ? String(Math.round(scaled))
        : (Math.round(scaled * 10) / 10).toFixed(1).replace(/\.0$/, '');
      return `${sign}${body}${suffix}`;
    }
  }
  return String(n);
}

export function formatDate(input: unknown, fmt: string | undefined): string {
  if (input === undefined || input === null) return '';
  const d = new Date(String(input));
  if (isNaN(d.getTime())) return '';
  if (!fmt) {
    const month = MONTHS_SHORT[d.getMonth()]!;
    const day = d.getDate();
    const year = d.getFullYear();
    const hh24 = d.getHours();
    const hh12 = ((hh24 + 11) % 12) + 1;
    const mm = String(d.getMinutes()).padStart(2, '0');
    const ampm = hh24 < 12 ? 'AM' : 'PM';
    return `${month} ${day}, ${year} ${hh12}:${mm} ${ampm}`;
  }
  const pad2 = (n: number) => String(n).padStart(2, '0');
  return fmt
    .replace(/yyyy/g, String(d.getFullYear()))
    .replace(/MM/g, pad2(d.getMonth() + 1))
    .replace(/dd/g, pad2(d.getDate()))
    .replace(/HH/g, pad2(d.getHours()))
    .replace(/mm/g, pad2(d.getMinutes()))
    .replace(/ss/g, pad2(d.getSeconds()));
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Light/dark are scoped via an attribute selector on the host page (`<html data-theme="dark">`),
// matching how the engine's other styled output works (see content-script + PreviewIframe).
const TREE_STYLE =
  '<style>' +
  '.pj-tree{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13px;line-height:1.55;color:#1f2937;}' +
  '.pj-tree details{margin-left:1em;}' +
  '.pj-tree>details{margin-left:0;}' +
  '.pj-tree summary{cursor:pointer;user-select:none;}' +
  '.pj-tree summary::marker{color:#6b7280;}' +
  '.pj-tree summary::-webkit-details-marker{color:#6b7280;}' +
  '.pj-tree-leaf{margin-left:1em;padding-left:1em;border-left:1px dashed transparent;}' +
  '.pj-tree .k{color:#c2410c;}' +
  '.pj-tree .v-str{color:#047857;}' +
  '.pj-tree .v-num{color:#1d4ed8;}' +
  '.pj-tree .v-bool{color:#7c3aed;font-weight:600;}' +
  '.pj-tree .v-null{color:#6b7280;font-style:italic;}' +
  '.pj-tree .t{color:#6b7280;font-size:11px;}' +
  '[data-theme="dark"] .pj-tree{color:#e5e7eb;}' +
  '[data-theme="dark"] .pj-tree .k{color:#fb923c;}' +
  '[data-theme="dark"] .pj-tree .v-str{color:#6ee7b7;}' +
  '[data-theme="dark"] .pj-tree .v-num{color:#93c5fd;}' +
  '[data-theme="dark"] .pj-tree .v-bool{color:#c4b5fd;}' +
  '[data-theme="dark"] .pj-tree .v-null{color:#9ca3af;}' +
  '[data-theme="dark"] .pj-tree .t{color:#9ca3af;}' +
  '</style>';

const DEFAULT_TREE_OPEN_DEPTH = 2;

function leafHtml(key: string | null, valueHtml: string): string {
  if (key === null) return `<div class="pj-tree-leaf">${valueHtml}</div>`;
  return `<div class="pj-tree-leaf"><span class="k">${escapeHtml(key)}</span>: ${valueHtml}</div>`;
}

function renderTreeNode(
  key: string | null,
  value: unknown,
  depth: number,
  maxDepth: number,
  seen: WeakSet<object>,
): string {
  if (value === null || value === undefined) {
    return leafHtml(key, '<span class="v-null">null</span>');
  }
  if (typeof value === 'boolean') {
    return leafHtml(key, `<span class="v-bool">${value}</span>`);
  }
  if (typeof value === 'number') {
    return leafHtml(key, `<span class="v-num">${Number.isFinite(value) ? value : 'null'}</span>`);
  }
  if (typeof value === 'string') {
    return leafHtml(key, `<span class="v-str">${escapeHtml(JSON.stringify(value))}</span>`);
  }
  if (typeof value !== 'object') {
    return leafHtml(key, `<span class="t">${escapeHtml(typeof value)}</span>`);
  }
  if (seen.has(value as object)) {
    return leafHtml(key, '<span class="t">⟳ cycle</span>');
  }
  if (depth >= maxDepth) {
    const label = Array.isArray(value) ? `[${(value as unknown[]).length}]` : `{${Object.keys(value as object).length}}`;
    return leafHtml(key, `<span class="t">${label} …</span>`);
  }
  seen.add(value as object);
  const isArr = Array.isArray(value);
  const entries: Array<[string, unknown]> = isArr
    ? (value as unknown[]).map((v, i) => [String(i), v])
    : Object.entries(value as Record<string, unknown>);
  const count = isArr ? `[${entries.length}]` : `{${entries.length}}`;
  const open = depth < DEFAULT_TREE_OPEN_DEPTH ? ' open' : '';
  const summaryKey = key === null ? '' : `<span class="k">${escapeHtml(key)}</span> `;
  const body = entries
    .map(([k, v]) => renderTreeNode(isArr ? `[${k}]` : k, v, depth + 1, maxDepth, seen))
    .join('');
  return `<details${open}><summary>${summaryKey}<span class="t">${count}</span></summary>${body}</details>`;
}

export function renderTree(value: unknown, maxDepth = 50): string {
  const cap = Number.isFinite(maxDepth) && maxDepth > 0 ? Math.floor(maxDepth) : 50;
  const seen = new WeakSet<object>();
  const inner = renderTreeNode(null, value, 0, cap, seen);
  return `${TREE_STYLE}<div class="pj-tree">${inner}</div>`;
}

export function registerFilters(engine: Liquid): void {
  engine.registerFilter('date', (value: unknown, fmt?: unknown) =>
    formatDate(value, typeof fmt === 'string' ? fmt : undefined),
  );
  engine.registerFilter('num', (value: unknown) => formatNumber(value));
  engine.registerFilter('link', function (this: unknown, tmpl: unknown) {
    const ctx = (this as { context?: { environments?: unknown } })?.context;
    const root = ((ctx?.environments as Record<string, unknown> | undefined) ?? {});
    const vars = (root['vars'] as Record<string, string>) ?? {};
    return buildLink(typeof tmpl === 'string' ? tmpl : '', root, vars);
  });
  engine.registerFilter('raw', (value: unknown) => {
    const s = value === undefined || value === null ? '' : String(value);
    // eslint-disable-next-line @typescript-eslint/ban-types
    const w = new String(s) as String & { __pjRaw?: true };
    w.__pjRaw = true;
    return w;
  });
  engine.registerFilter('tree', (value: unknown, maxDepth?: unknown) => {
    const md = typeof maxDepth === 'number' ? maxDepth : 50;
    const html = renderTree(value, md);
    // eslint-disable-next-line @typescript-eslint/ban-types
    const w = new String(html) as String & { __pjRaw?: true };
    w.__pjRaw = true;
    return w;
  });
}
