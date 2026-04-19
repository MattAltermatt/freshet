import { createStorage } from '../storage/storage';
import {
  estimateBytes,
  SYNC_SOFT_LIMIT,
  migrateSyncToLocal,
  migrateTemplatesToV2,
} from '../storage/migration';
import starterInternalUser from '../starter/internal-user.html?raw';
import starterGithubRepo from '../starter/github-repo.html?raw';
import sampleInternalUser from '../starter/internal-user.sample.json?raw';
import sampleGithubRepo from '../starter/github-repo.sample.json?raw';
import { appearanceFor, type BadgeSignal } from './badge';

async function main(): Promise<void> {
  await maybeStorageAreaMigration();
  await maybeSchemaMigration();
  await seedStartersIfEmpty();
}

async function seedStartersIfEmpty(): Promise<void> {
  const storage = await createStorage(chrome.storage);
  const templates = await storage.getTemplates();
  if (Object.keys(templates).length > 0) return;
  // Combined starter bodies exceed the 8 KB per-item quota on chrome.storage.sync
  // once JSON-encoded. Commit this install to local up-front so the seed write
  // lands in an area without that limit.
  await chrome.storage.local.set({
    pj_storage_area: 'local',
    pj_sample_json: {
      'internal-user': sampleInternalUser,
      'github-repo': sampleGithubRepo,
    },
  });
  const localStorage = await createStorage(chrome.storage);
  await localStorage.setTemplates({
    'internal-user': starterInternalUser,
    'github-repo': starterGithubRepo,
  });
  await localStorage.setSchemaVersion(2);
}

async function maybeStorageAreaMigration(): Promise<void> {
  try {
    const all = await chrome.storage.sync.get(['rules', 'templates', 'hostSkipList']);
    if (estimateBytes(all) > SYNC_SOFT_LIMIT) {
      await migrateSyncToLocal(chrome.storage);
    }
  } catch (err) {
    console.warn('[freshet] storage-area migration skipped:', err);
  }
}

async function maybeSchemaMigration(): Promise<void> {
  try {
    const storage = await createStorage(chrome.storage);
    const current = await storage.getSchemaVersion();
    if (current !== undefined) return;
    const result = await migrateTemplatesToV2(storage);
    if (!result.ok) {
      console.warn(
        '[freshet] template migration rolled back; failing template IDs:',
        result.failed,
      );
    }
  } catch (err) {
    console.warn('[freshet] schema migration skipped:', err);
  }
}

void main();

chrome.commands.onCommand.addListener((command) => {
  if (command !== 'toggle-raw') return;
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tabId = tabs[0]?.id;
    if (tabId === undefined) return;
    void chrome.tabs.sendMessage(tabId, { kind: 'pj:toggle-raw' }).catch(() => {});
  });
});

// URL each tab's badge was last painted for. Used to ignore a stale
// `status:'loading'` clear that races a fresh `pj:rendered` for the same URL
// (content script can finish before the SW processes the loading event).
const lastSignaledUrl = new Map<number, string>();

chrome.runtime.onMessage.addListener((message, sender) => {
  if (typeof message !== 'object' || message === null) return;
  const kind = (message as { kind?: unknown }).kind;
  if (kind === 'pj:open-options') {
    const hash = (message as { hash?: unknown }).hash;
    const url =
      chrome.runtime.getURL('src/options/options.html') +
      (typeof hash === 'string' ? hash : '');
    void chrome.tabs.create({ url });
    return;
  }
  if (kind === 'pj:rendered' || kind === 'pj:render-error') {
    const tabId = sender.tab?.id;
    if (tabId === undefined) return;
    const appearance = appearanceFor(kind as BadgeSignal);
    void chrome.action.setBadgeText({ tabId, text: appearance.text });
    void chrome.action.setBadgeBackgroundColor({ tabId, color: appearance.color });
    if (sender.tab?.url) lastSignaledUrl.set(tabId, sender.tab.url);
  }
});

// Clear the badge on navigation start so stale state from the previous URL
// doesn't leak forward — the content script re-fires pj:rendered if the new
// page also matches a rule, and stays silent otherwise.
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status !== 'loading') return;
  // If the navigation's target URL matches what the content script already
  // signaled, a pj:rendered has already overtaken this event — don't clobber
  // it. Otherwise the tab is genuinely navigating away; clear.
  if (changeInfo.url && changeInfo.url === lastSignaledUrl.get(tabId)) return;
  lastSignaledUrl.delete(tabId);
  void chrome.action.setBadgeText({ tabId, text: '' });
});

chrome.tabs.onRemoved.addListener((tabId) => {
  lastSignaledUrl.delete(tabId);
});
