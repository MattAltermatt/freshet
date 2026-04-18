import { createStorage } from '../storage/storage';
import {
  estimateBytes,
  SYNC_SOFT_LIMIT,
  migrateSyncToLocal,
  migrateTemplatesToV2,
} from '../storage/migration';
import starterInternalUser from '../starter/internal-user.html?raw';

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
