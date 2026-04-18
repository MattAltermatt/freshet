import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/preact';
import { useDebounce } from './useDebounce';

describe('useDebounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('emits after the delay and collapses rapid updates', () => {
    const { result, rerender } = renderHook(
      ({ v }: { v: string }) => useDebounce(v, 100),
      { initialProps: { v: 'a' } },
    );
    expect(result.current).toBe('a');
    rerender({ v: 'b' });
    rerender({ v: 'c' });
    expect(result.current).toBe('a');
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(result.current).toBe('c');
  });

  it('respects delay changes', () => {
    const { result, rerender } = renderHook(
      ({ v, d }: { v: number; d: number }) => useDebounce(v, d),
      { initialProps: { v: 1, d: 50 } },
    );
    rerender({ v: 2, d: 50 });
    act(() => {
      vi.advanceTimersByTime(49);
    });
    expect(result.current).toBe(1);
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toBe(2);
  });
});
