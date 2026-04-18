import { StreamLanguage, type StreamParser } from '@codemirror/language';

/**
 * Minimal Liquid highlighter for CodeMirror 6. Recognizes:
 *   {{ expr }}   — output expression
 *   {{{ expr }}} — legacy raw output (tolerated for visual parity with Handlebars starters)
 *   {% tag %}    — block/control tag
 *   {%- … -%}    — whitespace-stripping variants
 *   {# … #}, {%- comment -%}…{%- endcomment -%}  — comments
 * Everything else is rendered as plain HTML.
 *
 * This is a colorizer, not a parser. Liquid semantics are validated by
 * LiquidJS at render time; the editor just needs to make the code readable.
 */

interface LiquidState {
  mode: 'html' | 'output' | 'tag' | 'string' | 'comment' | 'hashComment';
  stringQuote: string | null;
}

const KEYWORDS = new Set([
  'if', 'elsif', 'else', 'endif', 'unless', 'endunless',
  'for', 'endfor', 'break', 'continue',
  'case', 'when', 'endcase',
  'capture', 'endcapture',
  'assign', 'increment', 'decrement',
  'comment', 'endcomment', 'raw', 'endraw',
  'include', 'render', 'with', 'in', 'as',
  'and', 'or', 'not', 'contains', 'empty', 'true', 'false', 'nil',
]);

const FILTERS = new Set(['date', 'link', 'num', 'raw', 'default', 'upcase', 'downcase', 'escape', 'size', 'first', 'last', 'join', 'split', 'replace']);

const parser: StreamParser<LiquidState> = {
  startState(): LiquidState {
    return { mode: 'html', stringQuote: null };
  },

  token(stream, state): string | null {
    // {% comment %}…{% endcomment %} body (until closing %})
    if (state.mode === 'comment') {
      while (!stream.eol()) {
        if (stream.match('%}', true)) {
          state.mode = 'html';
          return 'comment';
        }
        stream.next();
      }
      return 'comment';
    }

    // {# … #} block-comment body that can span multiple lines.
    if (state.mode === 'hashComment') {
      while (!stream.eol()) {
        if (stream.match('#}', true)) {
          state.mode = 'html';
          return 'comment';
        }
        stream.next();
      }
      return 'comment';
    }

    // Inside a string literal inside a liquid expression
    if (state.mode === 'output' || state.mode === 'tag') {
      if (state.stringQuote) {
        while (!stream.eol()) {
          const ch = stream.next();
          if (ch === '\\') {
            stream.next();
            continue;
          }
          if (ch === state.stringQuote) {
            state.stringQuote = null;
            return 'string';
          }
        }
        return 'string';
      }

      // Close output / tag delimiter
      if (state.mode === 'output' && (stream.match(/^-?}}}/, true) || stream.match(/^-?}}/, true))) {
        state.mode = 'html';
        return 'brace';
      }
      if (state.mode === 'tag' && stream.match(/^-?%}/, true)) {
        state.mode = 'html';
        return 'brace';
      }

      // Whitespace
      if (stream.eatSpace()) return null;

      const ch: string | null = stream.peek() ?? null;

      // Strings
      if (ch === '"' || ch === "'") {
        stream.next();
        state.stringQuote = ch as string;
        return 'string';
      }

      // Numbers
      if (ch !== null && /[0-9]/.test(ch)) {
        stream.eatWhile(/[0-9.]/);
        return 'number';
      }

      // Pipe = filter operator (next identifier is a filter)
      if (ch === '|') {
        stream.next();
        return 'operator';
      }

      // Operators / punctuation
      if (ch !== null && /[=!<>+\-*/%,.:()]/.test(ch)) {
        stream.next();
        return 'operator';
      }

      // Identifiers
      if (ch !== null && /[A-Za-z_]/.test(ch)) {
        let word = '';
        for (;;) {
          const next = stream.peek();
          if (!next || !/[A-Za-z0-9_]/.test(next)) break;
          stream.next();
          word += next;
        }
        if (state.mode === 'tag' && KEYWORDS.has(word)) return 'keyword';
        if (FILTERS.has(word)) return 'atom';
        return 'variableName';
      }

      if (ch !== null) stream.next();
      return null;
    }

    // state.mode === 'html'
    // Enter {# … #} comment. Close on same line OR span until next line.
    if (stream.match('{#', true)) {
      while (!stream.eol()) {
        if (stream.match('#}', true)) return 'comment';
        stream.next();
      }
      state.mode = 'hashComment';
      return 'comment';
    }

    // Enter output expression
    if (stream.match(/^{{{?-?/, true)) {
      state.mode = 'output';
      return 'brace';
    }

    // Enter tag
    if (stream.match(/^{%-?\s*comment\s*-?%}/, true)) {
      state.mode = 'comment';
      return 'keyword';
    }
    if (stream.match(/^{%-?/, true)) {
      state.mode = 'tag';
      return 'brace';
    }

    // Plain HTML: consume chunks of text
    if (stream.peek() === '<') {
      stream.next();
      stream.eatWhile(/[^{<]/);
      return 'tagName';
    }
    // A lone `{` that didn't match any Liquid opener (e.g. CSS inside
    // <style>, raw `{` in JSON examples) must still advance the stream —
    // CodeMirror throws "Stream parser failed to advance stream" otherwise.
    if (stream.peek() === '{') {
      stream.next();
      return null;
    }
    stream.eatWhile(/[^{<]/);
    return null;
  },
};

export const liquid = StreamLanguage.define(parser);
