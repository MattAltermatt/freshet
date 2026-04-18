import { createStorage } from '../storage/storage';
import { estimateBytes, SYNC_SOFT_LIMIT, migrateSyncToLocal } from '../storage/migration';
import type { Rule } from '../shared/types';

const CS_ID = 'pj-content-script';

async function main(): Promise<void> {
  await maybeMigrate();
  await registerContentScript();
}

async function maybeMigrate(): Promise<void> {
  try {
    const all = await chrome.storage.sync.get(['rules', 'templates', 'hostSkipList']);
    if (estimateBytes(all) > SYNC_SOFT_LIMIT) {
      await migrateSyncToLocal(chrome.storage);
    }
  } catch (err) {
    console.warn('[present-json] migration skipped:', err);
  }
}

async function registerContentScript(): Promise<void> {
  const storage = createStorage(chrome.storage);
  const rules = await storage.getRules();
  const matches = rulesToMatchPatterns(rules);

  try {
    await chrome.scripting.unregisterContentScripts({ ids: [CS_ID] });
  } catch {
    /* ignore */
  }

  if (matches.length === 0) return;

  await chrome.scripting.registerContentScripts([
    {
      id: CS_ID,
      matches,
      js: ['src/content/content-script.ts'],
      runAt: 'document_idle',
      allFrames: false,
      persistAcrossSessions: true,
    },
  ]);
}

function rulesToMatchPatterns(rules: Rule[]): string[] {
  const hosts = new Set<string>();
  for (const r of rules) {
    if (!r.enabled) continue;
    const host = r.hostPattern.replace(/\/(.+)\//, '*').replace(/\*\*/g, '*');
    hosts.add(`*://${host}/*`);
  }
  return [...hosts];
}

void main();

chrome.storage.onChanged.addListener((changes, area) => {
  if ((area === 'sync' || area === 'local') && changes['rules']) {
    void registerContentScript();
  }
});
