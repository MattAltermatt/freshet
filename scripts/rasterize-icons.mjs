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
// README, Open Graph / Twitter card previews).
const docsBrandOutputs = [
  { name: 'logo.png', size: 256 },
  { name: 'og-image.png', size: 1200 },
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
} finally {
  await browser.close();
}
