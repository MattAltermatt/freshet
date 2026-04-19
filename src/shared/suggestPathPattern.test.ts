import { describe, it, expect } from 'vitest';
import { suggestPathPattern } from './suggestPathPattern';
import { compileGlob } from '../matcher/glob';

describe('suggestPathPattern', () => {
  it('keeps root as /', () => {
    expect(suggestPathPattern('/')).toBe('/');
    expect(suggestPathPattern('')).toBe('/');
  });

  it('wraps a single segment with /**', () => {
    expect(suggestPathPattern('/foo')).toBe('/foo/**');
    expect(suggestPathPattern('/foo/')).toBe('/foo/**');
  });

  it('keeps two segments and appends /**', () => {
    expect(suggestPathPattern('/foo/bar')).toBe('/foo/bar/**');
    expect(suggestPathPattern('/foo/bar/')).toBe('/foo/bar/**');
  });

  it('collapses three-or-more segments to the first two', () => {
    expect(suggestPathPattern('/a/b/c')).toBe('/a/b/**');
    expect(suggestPathPattern('/api/v1/users/123/profile')).toBe('/api/v1/**');
  });

  it('ignores empty segments produced by double slashes', () => {
    expect(suggestPathPattern('//foo//bar')).toBe('/foo/bar/**');
  });

  // Regression: popup's "+ Add rule for this host" for `https://httpbin.org/json`
  // must produce a path pattern that matches `/json` — the URL that spawned it.
  it('regression: suggested pattern for /json actually matches /json', () => {
    const pattern = suggestPathPattern('/json');
    const re = compileGlob(pattern, { caseInsensitive: false });
    expect(re.test('/json')).toBe(true);
  });

  it('regression: suggested pattern matches origin URL for deeper paths too', () => {
    for (const path of ['/api/users', '/a/b/c', '/foo']) {
      const pattern = suggestPathPattern(path);
      const re = compileGlob(pattern, { caseInsensitive: false });
      expect(re.test(path)).toBe(true);
    }
  });
});
