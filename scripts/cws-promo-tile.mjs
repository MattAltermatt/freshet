// Render the 440×280 small promo tile used by CWS on category / search tiles.
// Brand-forward, minimal text — the listing copy does the heavy lifting
// elsewhere. Output → docs/assets/cws-promo/tile-440x280.png.
// Iterate freely: this is a marketing asset, not a test artifact.
import { chromium } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdir } from 'node:fs/promises';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, '../docs/assets/cws-promo');
const VIEWPORT = { width: 440, height: 280 };

async function main() {
  await mkdir(OUT, { recursive: true });
  const ctx = await chromium.launchPersistentContext('', {
    headless: true,
    viewport: VIEWPORT,
  });
  const p = await ctx.newPage();
  await p.setViewportSize(VIEWPORT);
  await p.setContent(`<!doctype html><html><head><style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { width: 100%; height: 100%; }
    body {
      width: 440px; height: 280px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #fef7ed;
      background-image:
        radial-gradient(ellipse 520px 360px at 100% 0%, rgba(234,88,12,0.14), transparent 70%),
        radial-gradient(ellipse 360px 260px at 0% 100%, rgba(234,88,12,0.08), transparent 70%);
      color: #1c1917;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 44px;
      padding: 0;
      position: relative;
      overflow: hidden;
    }
    .glyph {
      flex: 0 0 auto;
      display: flex;
      align-items: center;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 132px;
      font-weight: 800;
      line-height: 1;
      letter-spacing: -0.04em;
    }
    .glyph .brace { color: #1c1917; margin-right: -6px; }
    .glyph .bracket { color: #ea580c; }
    .text {
      flex: 0 1 auto;
      display: flex;
      flex-direction: column;
      gap: 10px;
      min-width: 0;
    }
    .wordmark {
      font-size: 42px;
      font-weight: 800;
      letter-spacing: -0.02em;
      color: #1c1917;
      line-height: 1;
    }
    .tagline {
      font-size: 17px;
      font-weight: 500;
      color: #44403c;
      line-height: 1.3;
    }
    .tagline strong { color: #1c1917; font-weight: 700; }
    .tagline .accent { color: #ea580c; font-weight: 700; }
    .bullets {
      margin-top: 4px;
      font-size: 12px;
      font-weight: 600;
      color: #44403c;
      letter-spacing: 0.02em;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .bullets span { white-space: nowrap; }
    .bullets span::before { content: "▸ "; color: #ea580c; }
    .corner-badge {
      position: absolute;
      right: 14px;
      bottom: 12px;
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #9a3412;
      opacity: 0.6;
    }
  </style></head><body>
    <div class="glyph">
      <span class="brace">{</span><span class="bracket">&gt;</span>
    </div>
    <div class="text">
      <div class="wordmark">Freshet</div>
      <div class="tagline"><strong>JSON in.</strong> <span class="accent">Page out.</span></div>
      <div class="bullets">
        <span>Per-URL templates</span>
        <span>Liquid syntax</span>
        <span>Local-only</span>
      </div>
    </div>
    <div class="corner-badge">Chrome · MV3</div>
  </body></html>`);
  await p.waitForTimeout(200);
  await p.screenshot({ path: path.join(OUT, 'tile-440x280.png'), omitBackground: false });
  console.log('✓ tile-440x280.png');
  await ctx.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
