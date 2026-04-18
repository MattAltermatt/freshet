import { describe, it, expect } from 'vitest';
import { suggestPathPattern } from './suggestPathPattern';

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
});
