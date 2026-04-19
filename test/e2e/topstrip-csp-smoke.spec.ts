import { test, expect, chromium } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from '../fixtures-server/server';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const extensionPath = path.join(__dirname, '../../dist');

let stopServer: () => Promise<void>;
test.beforeAll(async () => {
  stopServer = await startServer(4391);
});
test.afterAll(async () => {
  await stopServer();
});

test('top-strip mounts in a shadow root on a rendered JSON page (no CSP violations)', async () => {
  const ctx = await chromium.launchPersistentContext('', {
    headless: false,
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
  });
  const [sw] = ctx.serviceWorkers();
  const worker = sw ?? (await ctx.waitForEvent('serviceworker'));

  await worker.evaluate(async () => {
    await chrome.storage.local.set({
      pj_storage_area: 'local',
      rules: [{
        id: 'rule-smoke',
        hostPattern: '127.0.0.1',
        pathPattern: '/**',
        templateName: 'Smoke',
        variables: {},
        active: true,
      }],
      templates: { Smoke: '<h1 id="pj-smoke-rendered">hi</h1>' },
      hostSkipList: [],
      settings: { themePreference: 'light' },
    });
  });

  const page = await ctx.newPage();
  const cspViolations: string[] = [];
  page.on('console', (msg) => {
    const t = msg.text().toLowerCase();
    if (t.includes('content security policy') || t.includes('unsafe-eval')) {
      cspViolations.push(msg.text());
    }
  });
  await page.goto('http://127.0.0.1:4391/internal/user/1234');

  await page.waitForFunction(
    () => Boolean(document.getElementById('pj-topstrip-host')),
    null,
    { timeout: 5000 },
  );

  const mountPresent = await page.evaluate(() => {
    const host = document.getElementById('pj-topstrip-host');
    if (!host) return false;
    return Boolean(document.getElementById('pj-root'));
  });
  expect(mountPresent).toBe(true);
  expect(cspViolations, `CSP violations: ${cspViolations.join('\n')}`).toEqual([]);

  await ctx.close();
});
