// Capture the CWS listing screenshots at 1280x800 against a freshly-loaded
// extension. Output → docs/assets/cws-screenshots/. Re-run after any UI change.
import { chromium } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdir, readFile, unlink } from 'node:fs/promises';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.resolve(__dirname, '../dist');
const OUT = path.resolve(__dirname, '../docs/assets/cws-screenshots');
const VIEWPORT = { width: 1280, height: 800 };
const INCIDENT_URL =
  'https://mattaltermatt.github.io/freshet/examples/incidents/INC-2026-001.json';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function launch() {
  const ctx = await chromium.launchPersistentContext('', {
    headless: false,
    viewport: VIEWPORT,
    args: [
      `--disable-extensions-except=${DIST}`,
      `--load-extension=${DIST}`,
      `--window-size=${VIEWPORT.width},${VIEWPORT.height + 120}`,
    ],
  });
  let sw = ctx.serviceWorkers()[0];
  if (!sw) sw = await ctx.waitForEvent('serviceworker');
  const extId = sw.url().split('/')[2];
  return { ctx, extId, sw };
}

async function shoot(page, file) {
  await page.setViewportSize(VIEWPORT);
  await page.screenshot({ path: path.join(OUT, file) });
  console.log('✓', file);
}

async function setRuleActive(sw, templateName, active) {
  await sw.evaluate(
    async ([name, act]) => {
      const rec = await chrome.storage.local.get('rules');
      const rules = rec.rules || [];
      for (const r of rules) if (r.templateName === name) r.active = act;
      await chrome.storage.local.set({ rules });
    },
    [templateName, active],
  );
}

async function pngToDataUrl(file) {
  const buf = await readFile(file);
  return `data:image/png;base64,${buf.toString('base64')}`;
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const { ctx, extId, sw } = await launch();
  await sleep(1500); // starter seed + migration settle

  // Enable GitHub starter so later shots render.
  await setRuleActive(sw, 'github-repo', true);

  const optionsUrl = `chrome-extension://${extId}/src/options/options.html`;

  // ── Shot 1 (HERO): Two-browser before/after mockup ────────────────────
  // Inner browser content area: 596 wide × 664 tall (see CSS below).
  const INNER = { width: 596, height: 664 };
  const displayUrl = 'mattaltermatt.github.io/freshet/examples/incidents/INC-2026-001.json';

  // Raw JSON side — deactivate the incident rule so Chrome shows its native text view.
  await setRuleActive(sw, 'incident-detail', false);
  {
    const p = await ctx.newPage();
    await p.setViewportSize(INNER);
    await p.goto(INCIDENT_URL);
    await sleep(1500);
    await p.screenshot({ path: path.join(OUT, '_raw.png') });
    await p.close();
  }

  // Rendered side — re-activate, same inner dimensions.
  await setRuleActive(sw, 'incident-detail', true);
  {
    const p = await ctx.newPage();
    await p.setViewportSize(INNER);
    await p.goto(INCIDENT_URL);
    await sleep(2500);
    await p.screenshot({ path: path.join(OUT, '_rendered-narrow.png') });
    await p.close();
  }

  // Composite into two Chrome-style browser frames at 1280×800.
  {
    const rawDataUrl = await pngToDataUrl(path.join(OUT, '_raw.png'));
    const rendDataUrl = await pngToDataUrl(path.join(OUT, '_rendered-narrow.png'));
    const p = await ctx.newPage();
    await p.setViewportSize(VIEWPORT);
    await p.setContent(`<!doctype html><html><head><style>
      * { box-sizing: border-box; }
      html, body { margin: 0; padding: 0; }
      body {
        width: 1280px; height: 800px;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        background: #fef7ed;
        position: relative;
        overflow: hidden;
      }
      .title {
        position: absolute; top: 0; left: 0; right: 0;
        height: 56px;
        display: flex; align-items: center; justify-content: center;
        color: #1c1917;
        font-size: 20px; font-weight: 700; letter-spacing: 0.2px;
        gap: 14px;
      }
      .title .arrow { color: #ea580c; font-weight: 800; font-size: 24px; }
      .frames {
        position: absolute; top: 68px; left: 20px; right: 20px; bottom: 20px;
        display: flex; gap: 28px;
      }
      .browser {
        flex: 1;
        background: #ffffff;
        border-radius: 10px;
        overflow: hidden;
        box-shadow: 0 18px 48px -8px rgba(28,25,23,0.30),
                    0 4px 14px -2px rgba(28,25,23,0.18);
        display: flex; flex-direction: column;
      }
      .chrome {
        height: 44px; flex-shrink: 0;
        background: #e9e7e4;
        border-bottom: 1px solid #d6d3d1;
        display: flex; align-items: center;
        padding: 0 14px;
        gap: 12px;
      }
      .lights { display: flex; gap: 7px; flex-shrink: 0; }
      .light { width: 12px; height: 12px; border-radius: 50%; }
      .light.r { background: #ff5f57; }
      .light.y { background: #febc2e; }
      .light.g { background: #28c840; }
      .urlbar {
        flex: 1;
        height: 26px;
        background: #ffffff;
        border-radius: 13px;
        display: flex; align-items: center;
        padding: 0 12px;
        font-size: 12px;
        color: #57534e;
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
      }
      .urlbar .lock { color: #78716c; margin-right: 6px; }
      .urlbar .host { color: #1c1917; font-weight: 500; }
      .urlbar.active .host { color: #9a3412; }
      .content {
        flex: 1;
        overflow: hidden;
        position: relative;
        background: #ffffff;
      }
      .content img {
        width: 100%; height: 100%;
        display: block;
        object-fit: cover;
        object-position: top left;
      }
    </style></head><body>
      <div class="title">Raw JSON <span class="arrow">→</span> Rendered with Freshet</div>
      <div class="frames">
        <div class="browser">
          <div class="chrome">
            <div class="lights"><span class="light r"></span><span class="light y"></span><span class="light g"></span></div>
            <div class="urlbar"><span class="lock">🔒</span><span class="host">${displayUrl}</span></div>
          </div>
          <div class="content"><img src="${rawDataUrl}" alt=""></div>
        </div>
        <div class="browser">
          <div class="chrome">
            <div class="lights"><span class="light r"></span><span class="light y"></span><span class="light g"></span></div>
            <div class="urlbar active"><span class="lock">🔒</span><span class="host">${displayUrl}</span></div>
          </div>
          <div class="content"><img src="${rendDataUrl}" alt=""></div>
        </div>
      </div>
    </body></html>`);
    await sleep(400);
    await shoot(p, '01-before-after.png');
    await p.close();
  }

  // Clean up intermediate PNGs
  await unlink(path.join(OUT, '_raw.png')).catch(() => {});
  await unlink(path.join(OUT, '_rendered-narrow.png')).catch(() => {});

  // ── Shot 2: Options → Rules tab with URL tester green match ──────────
  {
    const p = await ctx.newPage();
    await p.setViewportSize(VIEWPORT);
    await p.goto(optionsUrl);
    await p.waitForSelector('.pj-app');
    await sleep(400);
    await p.fill(
      'input[placeholder="Paste any URL to test"]',
      'https://api.github.com/repos/facebook/react',
    );
    await sleep(600);
    await shoot(p, '02-options-rules.png');
    await p.close();
  }

  // ── Shot 3: Options → Templates tab with editor + preview ────────────
  {
    const p = await ctx.newPage();
    await p.setViewportSize(VIEWPORT);
    await p.goto(optionsUrl);
    await p.waitForSelector('.pj-app');
    await p.click('button.pj-tab:has-text("Templates")');
    await sleep(400);
    await p.selectOption('.pj-templates-select select', 'incident-detail');
    await sleep(1100);
    await shoot(p, '03-options-templates.png');
    await p.close();
  }

  // ── Shot 4: Rendered incident page (self-hosted, full-width) ─────────
  {
    const p = await ctx.newPage();
    await p.setViewportSize(VIEWPORT);
    await p.goto(INCIDENT_URL);
    await sleep(2500);
    await shoot(p, '04-rendered-incident.png');
    await p.close();
  }

  // ── Shot 5: Template debugging — `json-debug` starter showing __root tree dump ──
  {
    const p = await ctx.newPage();
    await p.setViewportSize(VIEWPORT);
    await p.goto(optionsUrl);
    await p.waitForSelector('.pj-app');
    await p.click('button.pj-tab:has-text("Templates")');
    await sleep(400);
    await p.selectOption('.pj-templates-select select', 'json-debug');
    await sleep(1100);
    await shoot(p, '05-template-debug.png');
    await p.close();
  }

  await ctx.close();
  console.log('\nDone →', OUT);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
