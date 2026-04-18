import type { CompletionContext, CompletionResult } from '@codemirror/autocomplete';

const HELPERS = ['date', 'link', 'num', 'raw'];
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
 * Walks an arbitrary JS object and returns all dotted paths. Arrays are
 * described as `key[]` so the UI hints "items[]" without suggesting an
 * index-specific path.
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
    const word = cc.matchBefore(/[\w.[\]]*/);
    if (!word || (word.from === word.to && !cc.explicit)) return null;

    const before = cc.state.doc.sliceString(Math.max(0, cc.pos - 40), cc.pos);
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
