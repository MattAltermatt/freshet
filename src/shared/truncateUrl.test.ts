import { describe, it, expect } from 'vitest';
import { truncateUrlMiddle } from './truncateUrl';

describe('truncateUrlMiddle', () => {
  it('returns the url unchanged when within max', () => {
    expect(truncateUrlMiddle('https://a.com/x', 40)).toBe('https://a.com/x');
  });

  it('truncates the middle with an ellipsis when too long', () => {
    const url = 'https://api.github.com/repos/MattAltermatt/freshet/issues/123';
    const out = truncateUrlMiddle(url, 40);
    expect(out.length).toBeLessThanOrEqual(40);
    expect(out).toContain('…');
    expect(out.startsWith('https://')).toBe(true);
    expect(out.endsWith('/issues/123')).toBe(true);
  });

  it('keeps the leading scheme+host and the trailing path', () => {
    const out = truncateUrlMiddle('https://very.long.example.com/a/b/c/d/e/f/g/h/i/j/k', 30);
    expect(out).toMatch(/^https:\/\/very\.l/);
    expect(out).toMatch(/k$/);
    expect(out).toContain('…');
  });

  it('handles short max gracefully', () => {
    expect(truncateUrlMiddle('https://example.com/path', 10)).toBe('https…path');
  });
});
