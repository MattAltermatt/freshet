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
    const w = new String(s) as String & { __pjRaw?: true };
    w.__pjRaw = true;
    return w;
  });
}
