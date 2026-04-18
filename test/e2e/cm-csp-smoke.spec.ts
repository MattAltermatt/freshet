import { test, expect, chromium } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.resolve(__dirname, '../../dist');

/**
 * CSP smoke test — asserts that the MV3 options page loads without any
 * Content Security Policy violations. CodeMirror 6 is imported at the
 * module level (via the Preact app's Templates tab editor) so the page
 * load alone exercises the module under CSP.
 *
 * The bundled app has no `'unsafe-eval'` in its CSP. A regression (e.g.
 * swapping to a library that compiles code at runtime) surfaces here as
 * a console CSP violation.
 */
test('options page loads under MV3 CSP with CodeMirror bundled', async () => {
  const ctx = await chromium.launchPersistentContext('', {
    headless: false,
    args: [`--disable-extensions-except=${DIST}`, `--load-extension=${DIST}`],
  });
  try {
    const pageErrors: string[] = [];
    ctx.on('page', (p) => {
      p.on('pageerror', (err) => pageErrors.push(err.message));
    });

    let sw = ctx.serviceWorkers()[0];
    if (!sw) sw = await ctx.waitForEvent('serviceworker');
    const extId = sw.url().split('/')[2]!;

    const page = await ctx.newPage();
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await page.goto(`chrome-extension://${extId}/src/options/options.html`);
    await expect(page.locator('.pj-app')).toBeVisible({ timeout: 5000 });

    const cspErrors = pageErrors.filter(
      (m) =>
        m.toLowerCase().includes('content security policy') ||
        m.toLowerCase().includes('unsafe-eval'),
    );
    expect(cspErrors, `CSP violations: ${cspErrors.join('\n')}`).toEqual([]);
  } finally {
    await ctx.close();
  }
});
