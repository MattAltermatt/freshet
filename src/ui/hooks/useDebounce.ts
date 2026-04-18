import { useEffect, useState } from 'preact/hooks';

/**
 * Returns `value` after it has remained unchanged for `delayMs`.
 * Rapid updates are collapsed to the final value.
 */
export function useDebounce<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}
