import { describe, it, expect } from 'vitest';
import { walkJsonPaths } from './liquidCompletions';

describe('walkJsonPaths', () => {
  it('walks nested objects', () => {
    const obj = { user: { name: 'x', id: 5 }, status: 'ok' };
    expect(walkJsonPaths(obj).sort()).toEqual(
      ['status', 'user', 'user.id', 'user.name'].sort(),
    );
  });

  it('inspects the first element of an array', () => {
    const obj = { items: [{ label: 'a', count: 1 }, { label: 'b', count: 2 }] };
    const paths = walkJsonPaths(obj);
    expect(paths).toContain('items');
    expect(paths).toContain('items[0].label');
    expect(paths).toContain('items[0].count');
  });

  it('returns [] for non-objects', () => {
    expect(walkJsonPaths(null)).toEqual([]);
    expect(walkJsonPaths('str')).toEqual([]);
    expect(walkJsonPaths(42)).toEqual([]);
  });
});
