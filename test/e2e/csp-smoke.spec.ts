import { test, expect, chromium } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from '../fixtures-server/server';

const PORT = 4391;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.resolve(__dirname, '../../dist');

test('liquidjs renders in an MV3 content script without CSP errors', async () => {
  const stopServer = await startServer(PORT);
  const context = await chromium.launchPersistentContext('', {
    headless: false,
    args: [`--disable-extensions-except=${DIST}`, `--load-extension=${DIST}`],
  });
  try {
    const pageErrors: string[] = [];
    context.on('page', (p) => {
      p.on('pageerror', (err) => pageErrors.push(err.message));
    });

    const page = await context.newPage();
    let [serviceWorker] = context.serviceWorkers();
    if (!serviceWorker) serviceWorker = await context.waitForEvent('serviceworker');

    await serviceWorker.evaluate(async () => {
      await chrome.storage.sync.set({
        rules: [
          {
            id: 'r1',
            hostPattern: '127.0.0.1',
            pathPattern: '/internal/user/*',
            templateName: 'smoke',
            variables: { env: 'qa' },
            enabled: true,
          },
        ],
        templates: {
          smoke: '<div id="smoke-out">env={{ vars.env }} id={{ id }}</div>',
        },
      });
    });

    await page.waitForTimeout(500);
    await page.goto(`http://127.0.0.1:${PORT}/internal/user/1234`);
    await page.waitForTimeout(1500);

    const outer = await page.evaluate(() =>
      document.querySelector('#smoke-out')?.outerHTML ?? '(missing)',
    );
    expect(outer).toContain('env=qa');
    expect(outer).toContain('id=1234');

    const cspErrors = pageErrors.filter(
      (m) => m.includes('unsafe-eval') || m.includes('Content Security Policy'),
    );
    expect(cspErrors).toEqual([]);
  } finally {
    await context.close();
    await stopServer();
  }
});
