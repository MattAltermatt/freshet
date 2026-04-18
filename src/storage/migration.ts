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
