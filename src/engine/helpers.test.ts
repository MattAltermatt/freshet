import { describe, it, expect } from 'vitest';
import { formatDate } from './helpers';

describe('formatDate', () => {
  it('default format renders localized month/day/time', () => {
    const out = formatDate('2026-04-17T23:09:30Z', undefined);
    expect(out).toMatch(/2026/);
    expect(out).toMatch(/Apr/);
  });
  it('custom yyyy-MM-dd HH:mm', () => {
    process.env.TZ = 'UTC';
    expect(formatDate('2026-04-17T23:09:30Z', 'yyyy-MM-dd HH:mm')).toBe('2026-04-17 23:09');
  });
  it('returns empty for invalid input', () => {
    expect(formatDate('not a date', undefined)).toBe('');
    expect(formatDate(undefined, undefined)).toBe('');
  });
});
