import { useEffect, useState } from 'preact/hooks';

/**
 * Subscribe to a single top-level key in chrome.storage.local and expose a
 * Preact-friendly [value, setValue] tuple. `setValue` writes through to
 * chrome.storage.local immediately.
 *
 * The read subscription fires on changes from either storage area
 * (sync or local) since chrome.storage.onChanged batches by key.
 */
export function useStorage<K extends string, T = unknown>(
  key: K,
  fallback: T,
): [T, (next: T) => Promise<void>] {
  const [value, setValue] = useState<T>(fallback);

  useEffect(() => {
    let cancelled = false;
    chrome.storage.local.get(key, (rec) => {
      if (cancelled) return;
      const v = (rec as Record<string, T>)[key];
      if (v !== undefined) setValue(v);
    });
    const onChange = (
      changes: Record<string, chrome.storage.StorageChange>,
    ): void => {
      const change = changes[key];
      if (!change) return;
      setValue((change.newValue as T) ?? fallback);
    };
    chrome.storage.onChanged.addListener(onChange);
    return () => {
      cancelled = true;
      chrome.storage.onChanged.removeListener(onChange);
    };
    // fallback captured on mount; don't re-subscribe if it changes identity.
  }, [key]);

  const write = async (next: T): Promise<void> => {
    setValue(next);
    await chrome.storage.local.set({ [key]: next });
  };

  return [value, write];
}
