import { createStorage } from '../storage/storage';
import { estimateBytes, SYNC_SOFT_LIMIT, migrateSyncToLocal } from '../storage/migration';
import starterInternalUser from '../starter/internal-user.html?raw';

async function main(): Promise<void> {
  await maybeMigrate();
  await seedStartersIfEmpty();
}

async function seedStartersIfEmpty(): Promise<void> {
  const storage = await createStorage(chrome.storage);
  const templates = await storage.getTemplates();
  if (Object.keys(templates).length > 0) return;
  await storage.setTemplates({ 'internal-user': starterInternalUser });
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

void main();
