import { describe, it, expect } from 'vitest';
import { formatDate, buildLink, formatNumber, renderTree } from './helpers';

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

describe('formatNumber', () => {
  it('renders sub-thousand values without a suffix', () => {
    expect(formatNumber(0)).toBe('0');
    expect(formatNumber(7)).toBe('7');
    expect(formatNumber(500)).toBe('500');
    expect(formatNumber(999)).toBe('999');
  });
  it('compacts thousands with a k suffix', () => {
    expect(formatNumber(1000)).toBe('1k');
    expect(formatNumber(1234)).toBe('1.2k');
    expect(formatNumber(10000)).toBe('10k');
    expect(formatNumber(234567)).toBe('235k');
  });
  it('compacts millions with an M suffix', () => {
    expect(formatNumber(1_000_000)).toBe('1M');
    expect(formatNumber(1_234_567)).toBe('1.2M');
    expect(formatNumber(10_000_000)).toBe('10M');
  });
  it('compacts billions with a B suffix', () => {
    expect(formatNumber(1_000_000_000)).toBe('1B');
    expect(formatNumber(2_345_000_000)).toBe('2.3B');
  });
  it('preserves sign for negative numbers', () => {
    expect(formatNumber(-1234)).toBe('-1.2k');
    expect(formatNumber(-500)).toBe('-500');
  });
  it('accepts numeric strings', () => {
    expect(formatNumber('234567')).toBe('235k');
  });
  it('returns empty for null/undefined/NaN/non-numeric', () => {
    expect(formatNumber(null)).toBe('');
    expect(formatNumber(undefined)).toBe('');
    expect(formatNumber(NaN)).toBe('');
    expect(formatNumber('abc')).toBe('');
    expect(formatNumber({})).toBe('');
  });
});

describe('renderTree', () => {
  it('emits a <div class="pj-tree"> wrapper and a scoped <style>', () => {
    const out = renderTree({ a: 1 });
    expect(out).toContain('<style>');
    expect(out).toContain('.pj-tree{');
    expect(out).toContain('<div class="pj-tree">');
  });
  it('wraps an object root in a <details open> with key+count', () => {
    const out = renderTree({ a: 1, b: 2 });
    expect(out).toMatch(/<details open><summary><span class="t">\{2\}<\/span><\/summary>/);
  });
  it('wraps an array root with [N] count', () => {
    const out = renderTree([10, 20, 30]);
    expect(out).toMatch(/<details open><summary><span class="t">\[3\]<\/span><\/summary>/);
  });
  it('renders nested objects two levels open by default, deeper closed', () => {
    const out = renderTree({ a: { b: { c: 1 } } });
    // Top + first nested = open
    const opens = out.match(/<details open>/g) ?? [];
    expect(opens.length).toBe(2);
    // Third level closed
    expect(out).toMatch(/<details><summary><span class="k">b<\/span>/);
  });
  it('classes primitives by type', () => {
    expect(renderTree({ s: 'hi' })).toContain('<span class="v-str">&quot;hi&quot;</span>');
    expect(renderTree({ n: 42 })).toContain('<span class="v-num">42</span>');
    expect(renderTree({ b: true })).toContain('<span class="v-bool">true</span>');
    expect(renderTree({ z: null })).toContain('<span class="v-null">null</span>');
  });
  it('HTML-escapes string values and keys', () => {
    const out = renderTree({ '<key>': '<script>x</script>' });
    expect(out).toContain('&lt;key&gt;');
    expect(out).toContain('&lt;script&gt;');
    expect(out).not.toContain('<script>x</script>');
  });
  it('truncates with … when maxDepth is reached', () => {
    const out = renderTree({ a: { b: { c: { d: 1 } } } }, 1);
    expect(out).toContain('…');
    // No <details> for the truncated branch
    expect(out).not.toContain('<span class="k">d</span>');
  });
  it('handles cycles without infinite recursion', () => {
    const obj: Record<string, unknown> = { a: 1 };
    obj.self = obj;
    const out = renderTree(obj);
    expect(out).toContain('⟳ cycle');
  });
  it('renders array element keys as [0], [1] …', () => {
    const out = renderTree([{ x: 1 }, { x: 2 }]);
    expect(out).toContain('<span class="k">[0]</span>');
    expect(out).toContain('<span class="k">[1]</span>');
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
