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
  /** Records names of templates that were rewritten, for the options-tab banner. */
  setMigratedList?(names: string[]): Promise<void>;
}

export interface MigrateResult {
  ok: boolean;
  migrated: string[];
  failed: string[];
}

/**
 * Convert any saved rule with `{ enabled: boolean }` to `{ active: boolean }`.
 * Idempotent: rules that already have `active` are left untouched. Runs against
 * both `.sync` and `.local` because at the time of release a user's rules may
 * still be in `.sync` (the storage-area migration only fires past 90 KB).
 *
 * Returns the per-area count of rewritten rules (mostly for test assertions).
 */
export async function migrateRulesEnabledToActive(
  api: typeof chrome.storage,
): Promise<{ syncMigrated: number; localMigrated: number }> {
  const result = { syncMigrated: 0, localMigrated: 0 };
  for (const areaName of ['sync', 'local'] as const) {
    const area = api[areaName];
    let bag: { rules?: unknown };
    try {
      bag = await area.get('rules');
    } catch {
      continue;
    }
    const rules = bag.rules;
    if (!Array.isArray(rules)) continue;
    let count = 0;
    const next = rules.map((r) => {
      if (r && typeof r === 'object' && 'enabled' in r && !('active' in r)) {
        count += 1;
        const { enabled, ...rest } = r as { enabled: boolean } & Record<string, unknown>;
        return { ...rest, active: enabled };
      }
      return r;
    });
    if (count > 0) {
      await area.set({ rules: next });
      if (areaName === 'sync') result.syncMigrated = count;
      else result.localMigrated = count;
    }
  }
  return result;
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
  if (storage.setMigratedList && migrated.length > 0) {
    await storage.setMigratedList(migrated);
  }
  return { ok: true, migrated, failed: [] };
}
