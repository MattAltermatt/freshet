import { test, expect, chromium, type BrowserContext } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const extensionPath = path.join(__dirname, '../../dist');

async function launch(): Promise<{ ctx: BrowserContext; extId: string }> {
  const ctx = await chromium.launchPersistentContext('', {
    headless: false,
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
  });
  const [sw] = ctx.serviceWorkers();
  const worker = sw ?? (await ctx.waitForEvent('serviceworker'));
  const extId = worker.url().split('/')[2]!;
  return { ctx, extId };
}

test('popup shows matched-rule chip for a seeded rule', async () => {
  const { ctx, extId } = await launch();
  const [sw] = ctx.serviceWorkers();
  const worker = sw!;

  await worker.evaluate(async () => {
    await chrome.storage.local.set({
      pj_storage_area: 'local',
      rules: [{
        id: 'rule-seed',
        hostPattern: '*.example.com',
        pathPattern: '/**',
        templateName: 'Example',
        variables: {},
        active: true,
      }],
      templates: { Example: '<h1>x</h1>' },
      hostSkipList: [],
    });
  });

  const popup = await ctx.newPage();
  await popup.addInitScript(() => {
    Object.defineProperty(chrome.tabs, 'query', {
      configurable: true,
      value: (_q: unknown, cb: (t: Array<{ url: string }>) => void): void =>
        cb([{ url: 'https://api.example.com/v1/thing' }]),
    });
  });
  await popup.goto(`chrome-extension://${extId}/src/popup/popup.html`);

  await expect(popup.locator('.pj-rule-chip')).toBeVisible({ timeout: 5000 });
  await expect(popup.locator('.pj-rule-chip')).toHaveText('Example');

  await ctx.close();
});

test('popup skip toggle updates hostSkipList', async () => {
  const { ctx, extId } = await launch();
  const [sw] = ctx.serviceWorkers();
  const worker = sw!;

  await worker.evaluate(async () => {
    await chrome.storage.local.set({
      pj_storage_area: 'local',
      rules: [],
      templates: {},
      hostSkipList: [],
    });
  });

  const popup = await ctx.newPage();
  await popup.addInitScript(() => {
    Object.defineProperty(chrome.tabs, 'query', {
      configurable: true,
      value: (_q: unknown, cb: (t: Array<{ url: string }>) => void): void =>
        cb([{ url: 'https://example.com/x' }]),
    });
  });
  await popup.goto(`chrome-extension://${extId}/src/popup/popup.html`);

  await popup
    .getByRole('switch', { name: /Skip Freshet on example\.com/ })
    .click();

  const stored = await worker.evaluate(
    async () => (await chrome.storage.local.get('hostSkipList')) as { hostSkipList: string[] },
  );
  expect(stored.hostSkipList).toContain('example.com');

  await ctx.close();
});

test('popup "Test in options" opens options page with url tester pre-filled', async () => {
  const { ctx, extId } = await launch();
  const [sw] = ctx.serviceWorkers();
  const worker = sw!;

  await worker.evaluate(async () => {
    await chrome.storage.local.set({
      pj_storage_area: 'local',
      rules: [],
      templates: {},
      hostSkipList: [],
    });
  });

  const popup = await ctx.newPage();
  await popup.addInitScript(() => {
    Object.defineProperty(chrome.tabs, 'query', {
      configurable: true,
      value: (_q: unknown, cb: (t: Array<{ url: string }>) => void): void =>
        cb([{ url: 'https://api.example.com/v1' }]),
    });
    (window as unknown as { __opened: string }).__opened = '';
    Object.defineProperty(chrome.tabs, 'create', {
      configurable: true,
      value: async ({ url }: { url: string }): Promise<void> => {
        (window as unknown as { __opened: string }).__opened = url;
      },
    });
    // Prevent window.close() from closing our test page.
    window.close = (): void => {};
  });
  await popup.goto(`chrome-extension://${extId}/src/popup/popup.html`);

  await popup.getByRole('button', { name: 'Test in options' }).click();

  const opened = await popup.evaluate(
    () => (window as unknown as { __opened: string }).__opened,
  );
  expect(opened).toContain('src/options/options.html');
  expect(opened).toContain('#test-url=');
  expect(decodeURIComponent(opened)).toContain('api.example.com/v1');

  const optionsPage = await ctx.newPage();
  await optionsPage.goto(opened);
  await expect(optionsPage.locator('.pj-url-input')).toHaveValue(
    'https://api.example.com/v1',
  );

  await ctx.close();
});
