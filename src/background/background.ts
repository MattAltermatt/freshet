import { createStorage } from '../storage/storage';
import {
  estimateBytes,
  SYNC_SOFT_LIMIT,
  migrateSyncToLocal,
  migrateTemplatesToV2,
} from '../storage/migration';
import starterInternalUser from '../starter/internal-user.html?raw';
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
  await storage.setTemplates({ 'internal-user': starterInternalUser });
  await storage.setSchemaVersion(2);
}

async function maybeStorageAreaMigration(): Promise<void> {
  try {
    const all = await chrome.storage.sync.get(['rules', 'templates', 'hostSkipList']);
    if (estimateBytes(all) > SYNC_SOFT_LIMIT) {
      await migrateSyncToLocal(chrome.storage);
    }
  } catch (err) {
    console.warn('[present-json] storage-area migration skipped:', err);
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
        '[present-json] template migration rolled back; failing template IDs:',
        result.failed,
      );
    }
  } catch (err) {
    console.warn('[present-json] schema migration skipped:', err);
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
  }
});

// Clear the badge on navigation start so stale state from the previous URL
// doesn't leak forward — the content script re-fires pj:rendered if the new
// page also matches a rule, and stays silent otherwise.
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status !== 'loading') return;
  void chrome.action.setBadgeText({ tabId, text: '' });
});
