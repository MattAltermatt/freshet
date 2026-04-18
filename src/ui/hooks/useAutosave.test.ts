import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/preact';
import { useAutosave } from './useAutosave';
import { clearAllToasts } from './useToast';

describe('useAutosave', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    clearAllToasts();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not save on first render', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    renderHook(() => useAutosave('x', save));
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    expect(save).not.toHaveBeenCalled();
  });

  it('debounces and saves once with latest value', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const { rerender } = renderHook(
      ({ v }: { v: number }) => useAutosave(v, save, { delayMs: 100, suppressToast: true }),
      { initialProps: { v: 1 } },
    );
    rerender({ v: 2 });
    rerender({ v: 3 });
    expect(save).not.toHaveBeenCalled();
    await act(async () => {
      vi.advanceTimersByTime(100);
      await Promise.resolve();
    });
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith(3);
  });

  it('retries on rejection', async () => {
    const save = vi
      .fn()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValue(undefined);
    const { rerender } = renderHook(
      ({ v }: { v: number }) => useAutosave(v, save, { delayMs: 100, suppressToast: true }),
      { initialProps: { v: 1 } },
    );
    rerender({ v: 2 });
    await act(async () => {
      vi.advanceTimersByTime(100);
      await Promise.resolve();
      await Promise.resolve();
    });
    await act(async () => {
      vi.advanceTimersByTime(500);
      await Promise.resolve();
    });
    expect(save).toHaveBeenCalledTimes(2);
  });

  it('fires onFailed when retries exhausted (initial + maxRetries attempts)', async () => {
    const save = vi.fn().mockRejectedValue(new Error('down'));
    const onFailed = vi.fn();
    const { rerender } = renderHook(
      ({ v }: { v: number }) =>
        useAutosave(v, save, { delayMs: 50, suppressToast: true, maxRetries: 1, onFailed }),
      { initialProps: { v: 1 } },
    );
    rerender({ v: 2 });
    // attempt 1 (initial, after delayMs)
    await act(async () => {
      vi.advanceTimersByTime(50);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(save).toHaveBeenCalledTimes(1);
    expect(onFailed).not.toHaveBeenCalled();
    // attempt 2 (retry, backoff 250 * 2^0 = 250)
    await act(async () => {
      vi.advanceTimersByTime(250);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(save).toHaveBeenCalledTimes(2);
    // attemptNumber is now 3 on the next call, exceeding maxRetries=1 → onFailed fires
    expect(onFailed).toHaveBeenCalledOnce();
  });
});
