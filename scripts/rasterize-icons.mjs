#!/usr/bin/env node
// Rasterize design/icon-{16,48,128}.svg -> public/icon-{size}.png via Playwright.
// Run: pnpm icons
import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const sizes = [16, 48, 128];
// Rasterize `icon-128.svg` scaled up for site-level use (GH Pages header,
// README). Open Graph / Twitter cards get their own landscape 1200x630
// canvas with the mark centered on the brand wash (see below).
const docsBrandOutputs = [
  { name: 'logo.png', size: 256 },
];

const browser = await chromium.launch();
try {
  for (const size of sizes) {
    const svg = readFileSync(resolve(root, `design/icon-${size}.svg`), 'utf8');
    const ctx = await browser.newContext({
      viewport: { width: size, height: size },
      deviceScaleFactor: 1,
    });
    const page = await ctx.newPage();
    await page.setContent(
      `<!doctype html><html><head><style>
        html,body{margin:0;padding:0;background:transparent}
        svg{display:block}
      </style></head><body>${svg}</body></html>`,
      { waitUntil: 'load' },
    );
    const buf = await page.screenshot({ omitBackground: true, type: 'png' });
    const out = resolve(root, `public/icon-${size}.png`);
    writeFileSync(out, buf);
    console.log(`wrote ${out} (${buf.length} bytes)`);
    await ctx.close();
  }

  const bigSvg = readFileSync(resolve(root, 'design/icon-128.svg'), 'utf8');
  for (const { name, size } of docsBrandOutputs) {
    const ctx = await browser.newContext({
      viewport: { width: size, height: size },
      deviceScaleFactor: 1,
    });
    const page = await ctx.newPage();
    await page.setContent(
      `<!doctype html><html><head><style>
        html,body{margin:0;padding:0;background:transparent}
        svg{display:block;width:${size}px;height:${size}px}
      </style></head><body>${bigSvg}</body></html>`,
      { waitUntil: 'load' },
    );
    const buf = await page.screenshot({ omitBackground: true, type: 'png' });
    const out = resolve(root, `docs/assets/${name}`);
    writeFileSync(out, buf);
    console.log(`wrote ${out} (${buf.length} bytes)`);
    await ctx.close();
  }

  // Open Graph / Twitter `summary_large_image` expect a ~1.91:1 landscape
  // (1200x630). Put the mark on a brand-cream canvas with the wordmark to
  // the right so it reads well when platforms crop vertically.
  {
    const width = 1200;
    const height = 630;
    const ctx = await browser.newContext({
      viewport: { width, height },
      deviceScaleFactor: 1,
    });
    const page = await ctx.newPage();
    await page.setContent(
      `<!doctype html><html><head><style>
        html,body{margin:0;padding:0}
        body{
          width:${width}px; height:${height}px;
          background:#fef7ed;
          display:flex; align-items:center; justify-content:center;
          font-family: ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
          color:#111827;
        }
        .mark{ width:260px; height:260px; margin-right:56px; }
        .mark svg{ width:100%; height:100%; display:block }
        .words{ display:flex; flex-direction:column; gap:18px; }
        h1{ margin:0; font-size:88px; line-height:1; font-weight:700; letter-spacing:-1px; }
        p{ margin:0; font-size:34px; line-height:1.25; color:#44403c; max-width:620px; }
      </style></head><body>
        <div class="mark">${bigSvg}</div>
        <div class="words">
          <h1>Freshet</h1>
          <p>Thaw any JSON URL into a more useful page.</p>
        </div>
      </body></html>`,
      { waitUntil: 'load' },
    );
    const buf = await page.screenshot({ type: 'png' });
    const out = resolve(root, 'docs/assets/og-image.png');
    writeFileSync(out, buf);
    console.log(`wrote ${out} (${buf.length} bytes)`);
    await ctx.close();
  }
} finally {
  await browser.close();
}
