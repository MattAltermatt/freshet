#!/usr/bin/env node
// One-off helper: renders each starter template against its bundled sample JSON
// and writes a self-contained HTML file to /tmp/freshet-renders/{name}.html.
// Used by Phase 3.6.5 to produce screenshots for the docs /try/ page.
//
// Mirrors the context-shape logic from src/engine/engine.ts (array-root → items).
// Reimplements the date + num filters inline to avoid a TS build dep here.
//
// Run: node scripts/render-starters-for-screenshots.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Liquid } from 'liquidjs';

process.env.TZ = 'UTC';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const STARTER_DIR = path.resolve(HERE, '../src/starter');
const OUT_DIR = '/tmp/freshet-renders';

// --- filters mirrored from src/engine/helpers.ts ---
const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function formatDate(input, fmt) {
  if (input == null) return '';
  const d = new Date(String(input));
  if (Number.isNaN(d.getTime())) return '';
  if (!fmt) {
    const mo = MONTHS_SHORT[d.getMonth()];
    const day = d.getDate();
    const year = d.getFullYear();
    const hh24 = d.getHours();
    const hh12 = ((hh24 + 11) % 12) + 1;
    const mm = String(d.getMinutes()).padStart(2, '0');
    const ampm = hh24 < 12 ? 'AM' : 'PM';
    return `${mo} ${day}, ${year} ${hh12}:${mm} ${ampm}`;
  }
  const pad2 = (n) => String(n).padStart(2, '0');
  return fmt
    .replace(/yyyy/g, String(d.getFullYear()))
    .replace(/MM/g, pad2(d.getMonth() + 1))
    .replace(/dd/g, pad2(d.getDate()))
    .replace(/HH/g, pad2(d.getHours()))
    .replace(/mm/g, pad2(d.getMinutes()))
    .replace(/ss/g, pad2(d.getSeconds()));
}
function formatNumber(input) {
  if (input == null) return '';
  const n = typeof input === 'number' ? input : Number(input);
  if (!Number.isFinite(n)) return '';
  if (Math.abs(n) < 1000) return String(Math.round(n));
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  for (const [mag, suffix] of [[1e9,'B'],[1e6,'M'],[1e3,'k']]) {
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

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const engine = new Liquid({
  outputEscape: (v) => v == null ? '' : escapeHtml(v),
});
engine.registerFilter('date', (v, fmt) => formatDate(v, typeof fmt === 'string' ? fmt : undefined));
engine.registerFilter('num', (v) => formatNumber(v));

const STARTERS = ['service-health', 'incident-detail', 'github-repo', 'pokemon', 'country'];

// vars passed for the env-chip demo on service-health (mirrors the bundled rule)
const VARS_BY_NAME = {
  'service-health': { env: 'production' },
};

// Static visual replica of the Freshet top-strip (src/content/TopStrip.tsx).
// The real strip is shadow-DOM and content-script-mounted, so it can't render
// from a file:// URL. For marketing screenshots, this hand-rolled inline copy
// gives the same visual identity at the top of each rendered page.
function topStripHtml({ templateName, env }) {
  const envChip = env
    ? `<span style="background:#c2410c;color:#fff;padding:2px 8px;border-radius:3px;font-family:ui-monospace,Menlo,monospace;font-size:10px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;">${env}</span>`
    : '';
  return `
<div style="position:fixed;top:0;left:0;right:0;height:36px;background:#fef7ed;color:#111827;border-bottom:1px solid #fed7aa;display:flex;align-items:center;gap:12px;padding:6px 12px;font:12px -apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;z-index:2147483647;box-sizing:border-box;">
  <span style="font-family:ui-monospace,Menlo,monospace;font-size:14px;line-height:1;">
    <span style="color:#111827;">{</span><span style="color:#ea580c;margin-left:1px;">&gt;</span>
  </span>
  ${envChip}
  <span style="font-family:ui-monospace,Menlo,monospace;color:#44403c;font-size:11px;display:inline-flex;align-items:baseline;gap:4px;flex:1 1 auto;min-width:0;">${templateName} <span style="font-size:10px;opacity:.7;">↗</span></span>
  <div style="display:inline-flex;border:1px solid #fed7aa;border-radius:4px;overflow:hidden;background:#fff;">
    <button type="button" style="border:0;background:#c2410c;color:#fff;padding:3px 10px;font:inherit;font-size:11px;cursor:pointer;">Rendered</button>
    <button type="button" style="border:0;background:transparent;color:#44403c;padding:3px 10px;font:inherit;font-size:11px;cursor:pointer;">Raw <span style="font-size:10px;margin-left:6px;">⌘⇧J</span></button>
  </div>
  <button type="button" style="border:1px solid #fed7aa;background:#fff;color:#111827;padding:3px 8px;border-radius:4px;font-size:14px;line-height:1;cursor:pointer;">⋯</button>
</div>
<div style="height:36px;"></div>
`;
}

fs.mkdirSync(OUT_DIR, { recursive: true });

for (const name of STARTERS) {
  const tmpl = fs.readFileSync(path.join(STARTER_DIR, `${name}.html`), 'utf8');
  const sample = JSON.parse(fs.readFileSync(path.join(STARTER_DIR, `${name}.sample.json`), 'utf8'));
  const vars = VARS_BY_NAME[name] ?? {};
  const ctx = Array.isArray(sample)
    ? { items: sample, vars }
    : { ...sample, vars };
  const body = engine.parseAndRenderSync(tmpl, ctx);
  const strip = topStripHtml({ templateName: name, env: vars.env });
  const doc = `<!doctype html><html data-theme="light" lang="en"><head><meta charset="utf-8"><title>${name}</title></head><body style="margin:0;">${strip}${body}</body></html>`;
  const out = path.join(OUT_DIR, `${name}.html`);
  fs.writeFileSync(out, doc, 'utf8');
  console.log(`wrote ${out}`);
}
