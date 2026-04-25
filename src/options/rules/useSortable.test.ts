import { describe, it, expect } from 'vitest';
import { reorder, computeTargetIndex, clampScrollDelta } from './useSortable';

describe('reorder()', () => {
  it('moves an item from a lower index to a higher index', () => {
    expect(reorder(['a', 'b', 'c', 'd'], 0, 2)).toEqual(['b', 'c', 'a', 'd']);
  });
  it('moves an item from a higher index to a lower index', () => {
    expect(reorder(['a', 'b', 'c', 'd'], 3, 1)).toEqual(['a', 'd', 'b', 'c']);
  });
  it('returns the same reference when from === to (signals no-op)', () => {
    const items = ['a', 'b', 'c'];
    expect(reorder(items, 1, 1)).toBe(items);
  });
});

describe('computeTargetIndex()', () => {
  // Three cards stacked: each 80px tall, top at y=0, 100, 200. Midpoints: 40, 140, 240.
  const rects = [
    { top: 0, bottom: 80 },
    { top: 100, bottom: 180 },
    { top: 200, bottom: 280 },
  ] as Pick<DOMRect, 'top' | 'bottom'>[];

  it('returns 0 when pointer is above the first midpoint (and origin is not 0)', () => {
    expect(computeTargetIndex(20, rects, /* draggedIndex */ 2)).toBe(0);
  });
  it('returns 1 when pointer is between midpoint 0 and midpoint 1', () => {
    expect(computeTargetIndex(80, rects, 2)).toBe(1);
  });
  it('returns 2 when pointer is between midpoint 1 and midpoint 2', () => {
    expect(computeTargetIndex(180, rects, 0)).toBe(2);
  });
  it('returns N (insert at end) when pointer is below the last midpoint', () => {
    expect(computeTargetIndex(300, rects, 0)).toBe(3);
  });
  it('returns the same index when pointer hovers within own slot (no-op)', () => {
    // dragged is index 1, pointer near its midpoint → no change
    expect(computeTargetIndex(140, rects, 1)).toBe(1);
  });
});

describe('clampScrollDelta()', () => {
  // Viewport height 800. Trigger zone 50px from each edge. Max 12 px/frame.
  const v = 800;

  it('returns 0 when pointer is in the middle of the viewport', () => {
    expect(clampScrollDelta(400, v)).toBe(0);
  });
  it('returns 0 just outside the top trigger zone (>= 50px from top)', () => {
    expect(clampScrollDelta(50, v)).toBe(0);
  });
  it('returns negative (scroll up) inside the top zone', () => {
    expect(clampScrollDelta(20, v)).toBeLessThan(0);
    expect(clampScrollDelta(20, v)).toBeGreaterThanOrEqual(-12);
  });
  it('returns full -12 at the very top', () => {
    expect(clampScrollDelta(0, v)).toBe(-12);
  });
  it('returns positive (scroll down) inside the bottom zone', () => {
    expect(clampScrollDelta(780, v)).toBeGreaterThan(0);
    expect(clampScrollDelta(780, v)).toBeLessThanOrEqual(12);
  });
  it('returns full +12 at the very bottom', () => {
    expect(clampScrollDelta(800, v)).toBe(12);
  });
});
