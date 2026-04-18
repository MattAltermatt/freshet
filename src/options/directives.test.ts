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

  it('parses new-rule with a full URL, splitting host and path-glob', () => {
    const encoded = encodeURIComponent('https://api.example.com/v1/users/42');
    expect(parseDirective(`#new-rule=${encoded}`)).toEqual({
      kind: 'new-rule',
      host: 'api.example.com',
      path: '/v1/users/**',
    });
  });

  it('parses new-rule with a root-path URL as host + /', () => {
    const encoded = encodeURIComponent('https://example.com/');
    expect(parseDirective(`#new-rule=${encoded}`)).toEqual({
      kind: 'new-rule',
      host: 'example.com',
      path: '/',
    });
  });

  it('falls back to host-only parsing when the directive value is not a URL', () => {
    const encoded = encodeURIComponent('api.example.com');
    expect(parseDirective(`#new-rule=${encoded}`)).toEqual({
      kind: 'new-rule',
      host: 'api.example.com',
      path: '/',
    });
  });

  it('parses edit-rule', () => {
    const encoded = encodeURIComponent('rule-1712-abc');
    expect(parseDirective(`#edit-rule=${encoded}`)).toEqual({
      kind: 'edit-rule',
      ruleId: 'rule-1712-abc',
    });
  });

  it('parses edit-template', () => {
    const encoded = encodeURIComponent('api-github-com');
    expect(parseDirective(`#edit-template=${encoded}`)).toEqual({
      kind: 'edit-template',
      name: 'api-github-com',
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

  it('round-trips new-rule url into host + path-glob', () => {
    const hash = directiveHash.newRule('https://api.example.com/v1/repos/claude/issues');
    expect(parseDirective(hash)).toEqual({
      kind: 'new-rule',
      host: 'api.example.com',
      path: '/v1/repos/**',
    });
  });

  it('round-trips edit-rule id', () => {
    const hash = directiveHash.editRule('rule-xyz');
    expect(parseDirective(hash)).toEqual({ kind: 'edit-rule', ruleId: 'rule-xyz' });
  });

  it('round-trips edit-template name', () => {
    const hash = directiveHash.editTemplate('api-github-com');
    expect(parseDirective(hash)).toEqual({
      kind: 'edit-template',
      name: 'api-github-com',
    });
  });
});
