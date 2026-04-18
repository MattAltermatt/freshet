import { Liquid } from 'liquidjs';
import { migrateTemplate } from '../engine/migrate';
import type { StorageShape } from '../shared/types';

export const SYNC_SOFT_LIMIT = 90 * 1024;

export function estimateBytes(payload: Partial<StorageShape>): number {
  return new TextEncoder().encode(JSON.stringify(payload)).length;
}

export function needsMigration(payload: Partial<StorageShape>): boolean {
  return estimateBytes(payload) > SYNC_SOFT_LIMIT;
}

export async function migrateSyncToLocal(api: typeof chrome.storage): Promise<void> {
  const all = await api.sync.get(['rules', 'templates', 'hostSkipList']);
  await api.local.set({ ...all, pj_storage_area: 'local' });
  await api.sync.clear();
}

export interface MigrateTemplatesStorage {
  getTemplates(): Promise<Record<string, string>>;
  setTemplates(next: Record<string, string>): Promise<void>;
  setSchemaVersion(version: number): Promise<void>;
}

export interface MigrateResult {
  ok: boolean;
  migrated: string[];
  failed: string[];
}

export async function migrateTemplatesToV2(storage: MigrateTemplatesStorage): Promise<MigrateResult> {
  const before = await storage.getTemplates();
  const validator = new Liquid();
  const rewritten: Record<string, string> = {};
  const migrated: string[] = [];
  const failed: string[] = [];
  for (const [key, source] of Object.entries(before)) {
    const next = migrateTemplate(source);
    try {
      validator.parse(next);
      rewritten[key] = next;
      migrated.push(key);
    } catch {
      failed.push(key);
    }
  }
  if (failed.length > 0) return { ok: false, migrated: [], failed };
  await storage.setTemplates(rewritten);
  await storage.setSchemaVersion(2);
  return { ok: true, migrated, failed: [] };
}
