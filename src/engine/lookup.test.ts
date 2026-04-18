import { describe, it, expect } from 'vitest';
import { lookup } from './lookup';

describe('lookup', () => {
  const json = { id: 1, user: { name: 'Alice', tags: ['a', 'b'] } };
  const vars = { adminHost: 'admin.example.com', env: 'qa' };

  it('reads top-level keys', () => {
    expect(lookup('id', json, vars)).toBe(1);
  });
  it('reads dotted paths', () => {
    expect(lookup('user.name', json, vars)).toBe('Alice');
  });
  it('reads array indices via dot', () => {
    expect(lookup('user.tags.0', json, vars)).toBe('a');
  });
  it('returns undefined for missing paths', () => {
    expect(lookup('user.missing', json, vars)).toBeUndefined();
    expect(lookup('absent', json, vars)).toBeUndefined();
  });
  it('resolves @-prefixed paths against variables', () => {
    expect(lookup('@adminHost', json, vars)).toBe('admin.example.com');
  });
  it('returns undefined for missing variables', () => {
    expect(lookup('@nope', json, vars)).toBeUndefined();
  });
  it('supports "this" as the implicit current object', () => {
    expect(lookup('this.id', json, vars)).toBe(1);
    expect(lookup('this', json, vars)).toEqual(json);
  });
});
