import { describe, it, expect } from 'vitest';
import { parseDirective, directiveHash } from './directives';

describe('parseDirective', () => {
  it('returns null for empty hash', () => {
    expect(parseDirective('')).toBeNull();
    expect(parseDirective('#')).toBeNull();
  });

  it('returns null for unknown directive', () => {
    expect(parseDirective('#huh')).toBeNull();
  });

  it('parses test-url', () => {
    const encoded = encodeURIComponent('https://api.github.com/repos/x');
    expect(parseDirective(`#test-url=${encoded}`)).toEqual({
      kind: 'test-url',
      url: 'https://api.github.com/repos/x',
    });
  });

  it('parses new-rule with host', () => {
    const encoded = encodeURIComponent('api.example.com');
    expect(parseDirective(`#new-rule:host=${encoded}`)).toEqual({
      kind: 'new-rule',
      host: 'api.example.com',
    });
  });

  it('parses edit-rule', () => {
    const encoded = encodeURIComponent('rule-1712-abc');
    expect(parseDirective(`#edit-rule=${encoded}`)).toEqual({
      kind: 'edit-rule',
      ruleId: 'rule-1712-abc',
    });
  });

  it('rejects malformed test-url (non-URI)', () => {
    expect(parseDirective('#test-url=%E0%A4%A')).toBeNull();
  });
});

describe('directiveHash', () => {
  it('round-trips test-url through parseDirective', () => {
    const url = 'https://ex.com/a b/?x=1';
    const hash = directiveHash.testUrl(url);
    expect(parseDirective(hash)).toEqual({ kind: 'test-url', url });
  });

  it('round-trips new-rule host', () => {
    const hash = directiveHash.newRule('api.example.com');
    expect(parseDirective(hash)).toEqual({ kind: 'new-rule', host: 'api.example.com' });
  });

  it('round-trips edit-rule id', () => {
    const hash = directiveHash.editRule('rule-xyz');
    expect(parseDirective(hash)).toEqual({ kind: 'edit-rule', ruleId: 'rule-xyz' });
  });
});
