import { useEffect, useRef } from 'preact/hooks';
import { pushToastImpl } from './useToast';

export interface AutosaveOptions {
  /** Debounce between state change and write. Default 300 ms. */
  delayMs?: number;
  /** Suppress Saved/retry toasts (useful for silent writes). Default false. */
  suppressToast?: boolean;
  /** Max retry attempts after a transient failure. Default 3. */
  maxRetries?: number;
  onSaved?: () => void;
  onFailed?: (err: Error) => void;
}

/**
 * Debounces the given value, then writes via `save`. On success emits a
 * `Saved ✓` toast (unless suppressed). On failure retries with exponential
 * backoff up to `maxRetries` before surfacing a persistent error toast.
 *
 * The first render does NOT trigger a save — only subsequent value changes.
 */
export function useAutosave<T>(
  value: T,
  save: (v: T) => Promise<void>,
  opts: AutosaveOptions = {},
): void {
  const { delayMs = 300, suppressToast = false, maxRetries = 3, onSaved, onFailed } = opts;
  const first = useRef(true);
  const latest = useRef<T>(value);
  latest.current = value;

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }

    let cancelled = false;

    const attempt = async (tryN: number): Promise<void> => {
      if (cancelled) return;
      try {
        await save(latest.current);
        if (cancelled) return;
        if (!suppressToast) {
          pushToastImpl({ variant: 'success', message: 'Saved ✓', ttlMs: 2000 });
        }
        onSaved?.();
      } catch (err) {
        if (cancelled) return;
        if (tryN >= maxRetries) {
          if (!suppressToast) {
            pushToastImpl({
              variant: 'danger',
              message: 'Save failed — retry?',
              ttlMs: 0,
            });
          }
          onFailed?.(err as Error);
          return;
        }
        if (!suppressToast) {
          pushToastImpl({
            variant: 'info',
            message: 'Save failed — retrying',
            ttlMs: 1500,
          });
        }
        setTimeout(() => void attempt(tryN + 1), 250 * 2 ** tryN);
      }
    };

    const id = setTimeout(() => void attempt(1), delayMs);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
    // Intentionally re-run only on `value` identity changes.
  }, [value]);
}
