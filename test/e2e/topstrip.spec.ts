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

test('top-strip renders rule-link + template-link + flat-action buttons on a matched page', async () => {
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
        id: 'rule-e2e',
        name: 'E2E rule',
        hostPattern: '127.0.0.1',
        pathPattern: '/**',
        templateName: 'Example',
        variables: { env: 'staging' },
        active: true,
      }],
      templates: { Example: '<h1 id="pj-rendered">rendered</h1>' },
      hostSkipList: [],
      settings: { themePreference: 'light' },
    });
  });

  const page = await ctx.newPage();
  await page.goto('http://127.0.0.1:4391/internal/user/1234');
  await page.waitForSelector('#pj-topstrip-host');

  const probe = await page.evaluate(() => {
    const host = document.getElementById('pj-topstrip-host');
    const root = host?.shadowRoot;
    if (!root) {
      return {
        ruleLink: null,
        templateLink: null,
        env: null,
        hasGroup: false,
        hasCopyUrl: false,
        hasCopyJson: false,
        hasThemeTrigger: false,
        hasMenuTrigger: false,
      };
    }
    return {
      ruleLink: root.querySelector('[data-testid="pj-rule-link"]')?.textContent ?? null,
      templateLink: root.querySelector('[data-testid="pj-rule-name"]')?.textContent ?? null,
      env: root.querySelector('[data-testid="pj-env-chip"]')?.textContent ?? null,
      hasGroup: Boolean(root.querySelector('[role="group"]')),
      hasCopyUrl: Boolean(root.querySelector('[data-testid="pj-copy-url"]')),
      hasCopyJson: Boolean(root.querySelector('[data-testid="pj-copy-json"]')),
      hasThemeTrigger: Boolean(root.querySelector('[data-testid="pj-theme-trigger"]')),
      hasMenuTrigger: Boolean(root.querySelector('[data-testid="pj-menu-trigger"]')),
    };
  });

  expect(probe.ruleLink).toContain('E2E rule');
  expect(probe.templateLink).toContain('Example');
  expect(probe.env).toBe('staging');
  expect(probe.hasGroup).toBe(true);
  expect(probe.hasCopyUrl).toBe(true);
  expect(probe.hasCopyJson).toBe(true);
  expect(probe.hasThemeTrigger).toBe(true);
  expect(probe.hasMenuTrigger).toBe(false);

  await ctx.close();
});

test('toggle-raw message flips the strip into raw mode', async () => {
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
        id: 'r-k', hostPattern: '127.0.0.1', pathPattern: '/**',
        templateName: 'K', variables: {}, active: true,
      }],
      templates: { K: '<h1 id="pj-rendered">rendered</h1>' },
      hostSkipList: [],
      settings: { themePreference: 'light' },
    });
  });

  const page = await ctx.newPage();
  await page.goto('http://127.0.0.1:4391/internal/user/1234');
  await page.waitForSelector('#pj-root');

  expect(await page.locator('#pj-rendered').count()).toBe(1);

  await worker.evaluate(async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab.id) await chrome.tabs.sendMessage(tab.id, { kind: 'pj:toggle-raw' });
  });

  await page.waitForFunction(
    () => document.getElementById('pj-root')?.getAttribute('data-mode') === 'raw',
    null,
    { timeout: 2000 },
  );

  await ctx.close();
});

