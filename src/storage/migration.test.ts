import { describe, it, expect } from 'vitest';
import { estimateBytes, needsMigration, SYNC_SOFT_LIMIT } from './migration';

describe('storage migration', () => {
  it('estimates byte size', () => {
    const payload = { rules: [], templates: { a: 'x'.repeat(100) }, hostSkipList: [] };
    const bytes = estimateBytes(payload);
    expect(bytes).toBeGreaterThan(100);
    expect(bytes).toBeLessThan(400);
  });
  it('flags migration when over the soft limit', () => {
    const big = { rules: [], templates: { a: 'x'.repeat(SYNC_SOFT_LIMIT) }, hostSkipList: [] };
    expect(needsMigration(big)).toBe(true);
  });
  it('does not flag migration when under the soft limit', () => {
    const small = { rules: [], templates: { a: 'x' }, hostSkipList: [] };
    expect(needsMigration(small)).toBe(false);
  });
});
