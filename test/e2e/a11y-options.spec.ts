import { test, expect, chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.resolve(__dirname, '../../dist');

test('options page has no axe-core WCAG 2.1 AA violations', async () => {
  const ctx = await chromium.launchPersistentContext('', {
    headless: false,
    args: [`--disable-extensions-except=${DIST}`, `--load-extension=${DIST}`],
  });
  try {
    let sw = ctx.serviceWorkers()[0];
    if (!sw) sw = await ctx.waitForEvent('serviceworker');
    const extId = sw.url().split('/')[2]!;

    const page = await ctx.newPage();
    await page.goto(`chrome-extension://${extId}/src/options/options.html`);
    await expect(page.locator('.pj-app')).toBeVisible();

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      // CodeMirror sets aria-owns on editor regions that axe's schema finds
      // orphaned in the offscreen announcer setup. Ignored for now; revisit
      // if we find genuinely missing accessible names elsewhere.
      .disableRules(['aria-valid-attr-value'])
      .analyze();

    const violations = results.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      description: v.description,
      nodes: v.nodes.map((n) => ({ html: n.html, target: n.target, failure: n.failureSummary })),
    }));

    expect(violations, `axe violations: ${JSON.stringify(violations, null, 2)}`).toEqual([]);
  } finally {
    await ctx.close();
  }
});
