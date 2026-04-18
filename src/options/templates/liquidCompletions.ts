import type { CompletionContext, CompletionResult } from '@codemirror/autocomplete';

const HELPERS = ['date', 'link', 'num', 'raw'];
// Format tokens understood by the `date` filter (see src/engine/helpers.ts formatDate).
const DATE_FORMAT_TOKENS = ['yyyy', 'MM', 'dd', 'HH', 'mm', 'ss'];
const TAGS = [
  'if', 'else', 'elsif', 'endif',
  'for', 'endfor',
  'unless', 'endunless',
  'case', 'when', 'endcase',
  'assign', 'capture', 'endcapture',
  'comment', 'endcomment',
  'raw', 'endraw',
  'include', 'render',
];

/**
 * Walks an arbitrary JS object and returns all dotted paths. Array elements
 * are probed via the first item and keyed as `items[0]` — a valid Liquid
 * accessor that users can copy verbatim or edit to another index.
 */
export function walkJsonPaths(obj: unknown, prefix = ''): string[] {
  if (!obj || typeof obj !== 'object') return [];
  const out: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    out.push(path);
    if (Array.isArray(v)) {
      const element = v[0];
      if (element && typeof element === 'object') {
        out.push(...walkJsonPaths(element, `${path}[0]`));
      }
    } else if (v && typeof v === 'object') {
      out.push(...walkJsonPaths(v, path));
    }
  }
  return out;
}

export interface LiquidCompletionContext {
  sampleJsonPaths: string[];
  ruleVars: string[];
}

export function liquidCompletions(ctx: LiquidCompletionContext) {
  return (cc: CompletionContext): CompletionResult | null => {
    const before = cc.state.doc.sliceString(Math.max(0, cc.pos - 80), cc.pos);

    // Inside an open double-quoted filter argument: `| <filter>: "<partial>`.
    // The top-level cascade can't reach here because its anchors all require
    // word/pipe chars at $ — a `"` breaks the chain.
    const inFilterStringArg = before.match(/\|\s*(\w+)\s*:\s*"([^"]*)$/);
    if (inFilterStringArg) {
      const filter = inFilterStringArg[1]!;
      if (filter === 'date') {
        const partialLen = (before.match(/[A-Za-z]*$/)?.[0] ?? '').length;
        return {
          from: cc.pos - partialLen,
          options: DATE_FORMAT_TOKENS.map((t) => ({
            label: t,
            type: 'constant',
            detail: 'date token',
          })),
        };
      }
      return null;
    }

    const word = cc.matchBefore(/[\w.[\]]*/);
    if (!word || (word.from === word.to && !cc.explicit)) return null;

    const inOutput = /\{\{\s*(?:[\w.[\]|]*\s*)*[\w.[\]]*$/.test(before);
    const inTag = /\{%-?\s*\w*$/.test(before);
    const afterPipe = /\|\s*\w*$/.test(before);

    const options: Array<{ label: string; type: string; detail?: string }> = [];

    if (afterPipe) {
      for (const h of HELPERS) options.push({ label: h, type: 'function', detail: 'filter' });
    } else if (inOutput) {
      for (const p of ctx.sampleJsonPaths) options.push({ label: p, type: 'variable', detail: 'json' });
      for (const v of ctx.ruleVars) options.push({ label: `vars.${v}`, type: 'variable', detail: 'rule var' });
      for (const h of HELPERS) options.push({ label: h, type: 'function', detail: 'filter' });
    } else if (inTag) {
      for (const t of TAGS) options.push({ label: t, type: 'keyword' });
    } else {
      return null;
    }

    if (options.length === 0) return null;
    return { from: word.from, options };
  };
}
