import { describe, it, expect } from 'vitest';
import { formatDate, buildLink, formatNumber } from './helpers';

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

describe('formatNumber', () => {
  it('renders sub-thousand values without a suffix', () => {
    expect(formatNumber(0)).toBe('0');
    expect(formatNumber(7)).toBe('7');
    expect(formatNumber(500)).toBe('500');
    expect(formatNumber(999)).toBe('999');
  });
  it('compacts thousands with a k suffix', () => {
    expect(formatNumber(1000)).toBe('1k');
    expect(formatNumber(1234)).toBe('1.2k');
    expect(formatNumber(10000)).toBe('10k');
    expect(formatNumber(234567)).toBe('235k');
  });
  it('compacts millions with an M suffix', () => {
    expect(formatNumber(1_000_000)).toBe('1M');
    expect(formatNumber(1_234_567)).toBe('1.2M');
    expect(formatNumber(10_000_000)).toBe('10M');
  });
  it('compacts billions with a B suffix', () => {
    expect(formatNumber(1_000_000_000)).toBe('1B');
    expect(formatNumber(2_345_000_000)).toBe('2.3B');
  });
  it('preserves sign for negative numbers', () => {
    expect(formatNumber(-1234)).toBe('-1.2k');
    expect(formatNumber(-500)).toBe('-500');
  });
  it('accepts numeric strings', () => {
    expect(formatNumber('234567')).toBe('235k');
  });
  it('returns empty for null/undefined/NaN/non-numeric', () => {
    expect(formatNumber(null)).toBe('');
    expect(formatNumber(undefined)).toBe('');
    expect(formatNumber(NaN)).toBe('');
    expect(formatNumber('abc')).toBe('');
    expect(formatNumber({})).toBe('');
  });
});

describe('buildLink', () => {
  it('interpolates a simple template', () => {
    const out = buildLink(
      'https://{{@adminHost}}/user/{{id}}',
      { id: 1234 },
      { adminHost: 'admin.x.com' },
    );
    expect(out).toBe('https://admin.x.com/user/1234');
  });
  it('encodes query components', () => {
    const out = buildLink('https://x/?q={{q}}', { q: 'a b&c' }, {});
    expect(out).toBe('https://x/?q=a%20b%26c');
  });
  it('returns empty string for empty template', () => {
    expect(buildLink('', {}, {})).toBe('');
  });
});
