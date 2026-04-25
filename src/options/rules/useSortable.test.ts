import { describe, it, expect } from 'vitest';
import { reorder } from './useSortable';

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
