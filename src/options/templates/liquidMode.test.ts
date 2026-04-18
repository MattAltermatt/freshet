import { describe, it, expect } from 'vitest';
import { liquid } from './liquidMode';

/**
 * Drive the StreamParser directly against representative inputs and confirm
 * it always advances. CodeMirror throws "Stream parser failed to advance
 * stream" when token() returns without consuming at least one character.
 */
function runParser(lines: string[]): void {
  const streamParser = (liquid as unknown as {
    streamParser: {
      startState: () => unknown;
      token: (stream: unknown, state: unknown) => string | null;
    };
  }).streamParser;
  const state = streamParser.startState();
  for (const line of lines) {
    const stream = {
      pos: 0,
      string: line,
      start: 0,
      eol(): boolean {
        return this.pos >= line.length;
      },
      peek(): string | undefined {
        return line[this.pos];
      },
      next(): string | undefined {
        return line[this.pos++];
      },
      match(pattern: string | RegExp, consume = true): boolean | RegExpMatchArray | null {
        if (typeof pattern === 'string') {
          if (line.startsWith(pattern, this.pos)) {
            if (consume) this.pos += pattern.length;
            return true;
          }
          return false;
        }
        const anchored = new RegExp(pattern.source.replace(/^\^/, ''));
        const m = anchored.exec(line.slice(this.pos));
        if (!m || m.index !== 0) return null;
        if (consume) this.pos += m[0].length;
        return m;
      },
      eatWhile(re: RegExp): boolean {
        const start = this.pos;
        while (this.pos < line.length && re.test(line[this.pos]!)) this.pos++;
        return this.pos > start;
      },
      eatSpace(): boolean {
        return this.eatWhile(/\s/);
      },
    };
    while (!stream.eol()) {
      const before = stream.pos;
      streamParser.token(stream, state);
      if (stream.pos === before) {
        throw new Error(
          `StreamParser failed to advance at char "${line[before]}" (line: ${JSON.stringify(
            line,
          )})`,
        );
      }
    }
  }
}

describe('liquid StreamParser', () => {
  it('advances on plain HTML', () => {
    expect(() => runParser(['<h1>Hello</h1>'])).not.toThrow();
  });

  it('advances on a Liquid output expression', () => {
    expect(() => runParser(['<p>{{ vars.name }}</p>'])).not.toThrow();
  });

  it('advances on a Liquid tag block', () => {
    expect(() => runParser(['{% if x %}y{% endif %}'])).not.toThrow();
  });

  it('advances on a lone `{` inside CSS (regression)', () => {
    expect(() =>
      runParser([
        '<style>',
        '  body { margin: 0; padding: 0; }',
        '  .card { background: #fff }',
        '</style>',
      ]),
    ).not.toThrow();
  });

  it('advances on JSON-like content with bare braces', () => {
    expect(() => runParser(['<pre>{ "id": 1, "label": "x" }</pre>'])).not.toThrow();
  });
});
