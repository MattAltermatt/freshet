import { describe, it, expect } from 'vitest';
import { suggestTemplateName } from './suggestTemplateName';

describe('suggestTemplateName', () => {
  it('slugs dotted hosts', () => {
    expect(suggestTemplateName('api.github.com')).toBe('api-github-com');
  });

  it('lowercases mixed case', () => {
    expect(suggestTemplateName('API.Example.COM')).toBe('api-example-com');
  });

  it('collapses runs of non-alphanumeric into a single dash', () => {
    expect(suggestTemplateName('api..example..com')).toBe('api-example-com');
    expect(suggestTemplateName('weird__host--name')).toBe('weird-host-name');
  });

  it('strips leading and trailing dashes', () => {
    expect(suggestTemplateName('-foo-')).toBe('foo');
    expect(suggestTemplateName('...')).toBe('new-template');
  });

  it('falls back when the host is empty', () => {
    expect(suggestTemplateName('')).toBe('new-template');
  });

  it('handles IPv4 literals', () => {
    expect(suggestTemplateName('127.0.0.1')).toBe('127-0-0-1');
  });
});
