import { describe, it, expect } from 'vitest';
import type { CompletionContext } from '@codemirror/autocomplete';
import { liquidCompletions, walkJsonPaths } from './liquidCompletions';

function makeContext(text: string, explicit = false): CompletionContext {
  const pos = text.length;
  return {
    pos,
    explicit,
    state: { doc: { sliceString: (from: number, to: number) => text.slice(from, to) } },
    matchBefore(regex: RegExp) {
      const anchored = new RegExp(regex.source + '$');
      const m = text.slice(0, pos).match(anchored);
      if (!m) return null;
      return { from: pos - m[0].length, to: pos, text: m[0] };
    },
  } as unknown as CompletionContext;
}

describe('walkJsonPaths', () => {
  it('walks nested objects', () => {
    const obj = { user: { name: 'x', id: 5 }, status: 'ok' };
    expect(walkJsonPaths(obj).sort()).toEqual(
      ['status', 'user', 'user.id', 'user.name'].sort(),
    );
  });

  it('inspects the first element of an array', () => {
    const obj = { items: [{ label: 'a', count: 1 }, { label: 'b', count: 2 }] };
    const paths = walkJsonPaths(obj);
    expect(paths).toContain('items');
    expect(paths).toContain('items[0].label');
    expect(paths).toContain('items[0].count');
  });

  it('returns [] for non-objects', () => {
    expect(walkJsonPaths(null)).toEqual([]);
    expect(walkJsonPaths('str')).toEqual([]);
    expect(walkJsonPaths(42)).toEqual([]);
  });
});

describe('liquidCompletions inside filter string arg', () => {
  const source = liquidCompletions({ sampleJsonPaths: ['id', 'name'], ruleVars: [] });

  it('offers date format tokens inside a date filter string arg', () => {
    const text = '{{ ts | date: "y';
    const result = source(makeContext(text));
    expect(result).not.toBeNull();
    const labels = result!.options.map((o) => o.label);
    expect(labels).toEqual(['yyyy', 'MM', 'dd', 'HH', 'mm', 'ss']);
    expect(result!.from).toBe(text.length - 1);
  });

  it('offers all tokens at the start of a date format string on explicit trigger', () => {
    const text = '{{ ts | date: "';
    const result = source(makeContext(text, true));
    expect(result).not.toBeNull();
    expect(result!.from).toBe(text.length);
    expect(result!.options).toHaveLength(6);
  });

  it('returns null inside an unknown-filter string arg', () => {
    const text = '{{ items | unknown: "s';
    expect(source(makeContext(text))).toBeNull();
  });

  it('still offers JSON paths after the filter colon when no string literal has opened', () => {
    const text = '{{ id';
    const result = source(makeContext(text));
    expect(result).not.toBeNull();
    expect(result!.options.some((o) => o.label === 'id')).toBe(true);
  });

  it('does not fire when the cursor sits just after a closed filter string arg', () => {
    const text = '{{ ts | date: "yyyy"';
    expect(source(makeContext(text))).toBeNull();
  });
});
