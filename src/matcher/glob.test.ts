import { describe, it, expect } from 'vitest';
import { compileGlob } from './glob';

describe('compileGlob — globs', () => {
  it('matches literal text exactly', () => {
    const re = compileGlob('example.com', { caseInsensitive: true });
    expect(re.test('example.com')).toBe(true);
    expect(re.test('example.coma')).toBe(false);
    expect(re.test('aexample.com')).toBe(false);
  });

  it('* matches any chars except /', () => {
    const re = compileGlob('/api/*/v1', { caseInsensitive: false });
    expect(re.test('/api/users/v1')).toBe(true);
    expect(re.test('/api/users/nested/v1')).toBe(false);
  });

  it('** matches across / boundaries', () => {
    const re = compileGlob('/api/**/v1', { caseInsensitive: false });
    expect(re.test('/api/users/v1')).toBe(true);
    expect(re.test('/api/users/nested/v1')).toBe(true);
  });
  it('** matches empty sequences (zero chars)', () => {
    const hostRe = compileGlob('**.server.com', { caseInsensitive: true });
    expect(hostRe.test('.server.com')).toBe(true);
    expect(hostRe.test('api.server.com')).toBe(true);
    const pathRe = compileGlob('/api/**', { caseInsensitive: false });
    expect(pathRe.test('/api/')).toBe(true);
    expect(pathRe.test('/api/users')).toBe(true);
  });

  it('escapes regex meta characters in literal text', () => {
    const re = compileGlob('foo.bar+baz(qux)', { caseInsensitive: true });
    expect(re.test('foo.bar+baz(qux)')).toBe(true);
    expect(re.test('fooXbar+baz(qux)')).toBe(false);
  });

  it('case-insensitive flag controls host matching', () => {
    const re = compileGlob('Example.COM', { caseInsensitive: true });
    expect(re.test('example.com')).toBe(true);
    expect(re.test('EXAMPLE.com')).toBe(true);
  });

  it('case-sensitive flag does not ignore case', () => {
    const re = compileGlob('/Users', { caseInsensitive: false });
    expect(re.test('/Users')).toBe(true);
    expect(re.test('/users')).toBe(false);
  });
});

describe('compileGlob — regex escape hatch', () => {
  it('treats /…/ as raw regex', () => {
    const re = compileGlob('/^\\/api\\/v\\d+$/', { caseInsensitive: false });
    expect(re.test('/api/v1')).toBe(true);
    expect(re.test('/api/v42')).toBe(true);
    expect(re.test('/api/vX')).toBe(false);
  });

  it('does not treat bare // as match-all regex', () => {
    const re = compileGlob('//', { caseInsensitive: false });
    expect(re.test('/api/foo')).toBe(false);
    expect(re.test('https://example.com')).toBe(false);
    expect(re.test('//')).toBe(true);
  });
});
