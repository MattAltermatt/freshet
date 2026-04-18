import { test, expect, chromium } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const extensionPath = path.join(__dirname, '../../dist');

test('top-strip renders with rule name + env chip + toggle-group + menu on a matched page', async () => {
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
        hostPattern: '127.0.0.1',
        pathPattern: '/**',
        templateName: 'Example',
        variables: { env: 'staging' },
        enabled: true,
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
    if (!root) return { ruleName: null, env: null, hasGroup: false, hasMenuTrigger: false };
    const ruleName = root.querySelector('[data-testid="pj-rule-name"]')?.textContent ?? null;
    const env = root.querySelector('[data-testid="pj-env-chip"]')?.textContent ?? null;
    const hasGroup = Boolean(root.querySelector('[role="group"]'));
    const hasMenuTrigger = Boolean(root.querySelector('[data-testid="pj-menu-trigger"]'));
    return { ruleName, env, hasGroup, hasMenuTrigger };
  });

  expect(probe.ruleName).toBe('Example');
  expect(probe.env).toBe('staging');
  expect(probe.hasGroup).toBe(true);
  expect(probe.hasMenuTrigger).toBe(true);

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
        templateName: 'K', variables: {}, enabled: true,
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

test('skip this host adds hostname to hostSkipList', async () => {
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
        id: 'r-s', hostPattern: '127.0.0.1', pathPattern: '/**',
        templateName: 'S', variables: {}, enabled: true,
      }],
      templates: { S: '<h1 id="pj-rendered">rendered</h1>' },
      hostSkipList: [],
      settings: { themePreference: 'light' },
    });
  });

  const page = await ctx.newPage();
  await page.goto('http://127.0.0.1:4391/internal/user/1234');
  await page.waitForSelector('#pj-topstrip-host');

  await page.evaluate(() => {
    const root = document.getElementById('pj-topstrip-host')?.shadowRoot;
    (root!.querySelector('[data-testid="pj-menu-trigger"]') as HTMLButtonElement).click();
  });
  await page.evaluate(() => {
    const root = document.getElementById('pj-topstrip-host')?.shadowRoot;
    const items = root!.querySelectorAll('.pj-menu-item');
    const skip = Array.from(items).find((el) => el.textContent?.includes('Skip this host'));
    (skip as HTMLButtonElement).click();
  });

  // The handler writes storage then reloads — verify from the SW side.
  await page.waitForLoadState('load').catch(() => {});
  const stored = await worker.evaluate(
    async () => (await chrome.storage.local.get('hostSkipList')) as { hostSkipList: string[] },
  );
  expect(stored.hostSkipList).toContain('127.0.0.1');

  await ctx.close();
});
