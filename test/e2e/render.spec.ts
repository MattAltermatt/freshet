import { test, expect, chromium, type BrowserContext } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from '../fixtures-server/server';

const PORT = 4391;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.resolve(__dirname, '../../dist');

let context: BrowserContext;
let stopServer: () => Promise<void>;

test.beforeAll(async () => {
  stopServer = await startServer(PORT);
  context = await chromium.launchPersistentContext('', {
    headless: false,
    args: [`--disable-extensions-except=${DIST}`, `--load-extension=${DIST}`],
  });
});

test.afterAll(async () => {
  await context.close();
  await stopServer();
});

test('renders JSON via the bundled starter template', async () => {
  const page = await context.newPage();

  let [serviceWorker] = context.serviceWorkers();
  if (!serviceWorker) serviceWorker = await context.waitForEvent('serviceworker');
  await serviceWorker.evaluate(
    async (vars) => {
      await chrome.storage.sync.set({
        rules: [
          {
            id: 'r1',
            hostPattern: '127.0.0.1',
            pathPattern: '/internal/user/*',
            templateName: 'internal-user',
            variables: vars,
            enabled: true,
          },
        ],
      });
    },
    { adminHost: 'qa-admin.server.com', env: 'qa' },
  );

  await page.waitForTimeout(500);
  await page.goto(`http://127.0.0.1:${PORT}/internal/user/1234`);
  await page.waitForTimeout(500);

  await expect(page.locator('#pj-root')).toBeVisible();
  await expect(page.locator('#pj-root')).toContainText('1234');
  await expect(page.locator('#pj-root .pj-down')).toHaveText('DOWN');

  await page.click('#pj-topbar >> text=Show raw JSON');
  await expect(page.locator('#pj-root pre')).toContainText('"id": 1234');
});
