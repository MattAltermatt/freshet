import { describe, it, expect } from 'vitest';
import { formatDate, buildLink } from './helpers';

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
