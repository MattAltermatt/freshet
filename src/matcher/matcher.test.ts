import { describe, it, expect } from 'vitest';
import { match } from './matcher';
import type { Rule } from '../shared/types';

const baseRule = (over: Partial<Rule> = {}): Rule => ({
  id: 'r',
  hostPattern: '**',
  pathPattern: '**',
  templateName: 't',
  variables: {},
  enabled: true,
  ...over,
});

describe('match', () => {
  it('returns null when no rules match', () => {
    const rules: Rule[] = [baseRule({ hostPattern: 'nope.com' })];
    expect(match('https://example.com/x', rules)).toBeNull();
  });

  it('returns the first matching rule in order', () => {
    const rules: Rule[] = [
      baseRule({ id: 'a', hostPattern: 'qa-*.server.com', pathPattern: '/internal/**' }),
      baseRule({ id: 'b', hostPattern: '**.server.com', pathPattern: '/internal/**' }),
    ];
    expect(match('https://qa-1.server.com/internal/user/1', rules)?.id).toBe('a');
    expect(match('https://api.server.com/internal/user/1', rules)?.id).toBe('b');
  });

  it('strips query strings before matching', () => {
    const rules: Rule[] = [baseRule({ pathPattern: '/user/*' })];
    expect(match('https://example.com/user/1?a=1&b=2', rules)).not.toBeNull();
  });

  it('skips disabled rules', () => {
    const rules: Rule[] = [
      baseRule({ id: 'a', enabled: false }),
      baseRule({ id: 'b', enabled: true }),
    ];
    expect(match('https://example.com/x', rules)?.id).toBe('b');
  });

  it('matches host case-insensitively', () => {
    const rules: Rule[] = [baseRule({ hostPattern: 'Example.COM' })];
    expect(match('https://example.com/x', rules)).not.toBeNull();
  });

  it('matches path case-sensitively', () => {
    const rules: Rule[] = [baseRule({ pathPattern: '/Users' })];
    expect(match('https://example.com/Users', rules)).not.toBeNull();
    expect(match('https://example.com/users', rules)).toBeNull();
  });

  it('returns null for invalid URLs', () => {
    const rules: Rule[] = [baseRule()];
    expect(match('not a url', rules)).toBeNull();
  });
});
