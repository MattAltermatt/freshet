/**
 * One-time storage-area promotion run on every options-page boot.
 *
 * The legacy storage facade picked `chrome.storage.sync` by default and
 * auto-migrated to `.local` above ~90 KB. The Preact options page reads via
 * `useStorage`, which talks to `.local` directly — so a fresh install that
 * still has its seed data in `.sync` would render empty (and worse, a save
 * would write to `.local` while `.sync` still held the real data).
 *
 * This helper forces convergence: if the `pj_storage_area` sentinel isn't
 * already `'local'`, copy every known key from `.sync` into `.local`, then
 * stamp the sentinel. After that, `useStorage` reads the right area and the
 * content script / service worker (which go through `createStorage`) follow
 * the sentinel and also read from `.local`.
 *
 * Idempotent: once the sentinel is `'local'`, the function returns a no-op
 * on subsequent calls.
 */

const KNOWN_KEYS = [
  'rules',
  'templates',
  'hostSkipList',
  'schemaVersion',
  'pj_migrated_v2',
] as const;

export async function promoteStorageToLocal(): Promise<void> {
  const { pj_storage_area: area } = (await chrome.storage.local.get('pj_storage_area')) as {
    pj_storage_area?: string;
  };
  if (area === 'local') return;

  const fromSync = await chrome.storage.sync.get([...KNOWN_KEYS]);
  const fromLocal = await chrome.storage.local.get([...KNOWN_KEYS]);

  const patch: Record<string, unknown> = { pj_storage_area: 'local' };
  for (const k of KNOWN_KEYS) {
    // Local wins if already present; otherwise copy sync's value (if any).
    const v = (fromLocal as Record<string, unknown>)[k];
    if (v !== undefined) continue;
    const synced = (fromSync as Record<string, unknown>)[k];
    if (synced !== undefined) patch[k] = synced;
  }
  await chrome.storage.local.set(patch);
}
