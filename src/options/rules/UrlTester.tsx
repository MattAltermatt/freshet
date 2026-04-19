import type { JSX } from 'preact';
import { useEffect, useMemo, useState } from 'preact/hooks';
import type { Rule } from '../../shared/types';
import { findMatchingRule, matchesHost, matchesPath } from '../../matcher/matcher';

export interface UrlTesterProps {
  rules: Rule[];
  initialUrl?: string;
}

type RowState =
  | 'idle'
  | 'invalid'
  | 'match'
  | 'shadowed'
  | 'miss-host'
  | 'miss-path'
  | 'inactive';

const ICONS: Record<RowState, string> = {
  idle: '·',
  invalid: '?',
  match: '✅',
  shadowed: '⚠',
  'miss-host': '—',
  'miss-path': '—',
  inactive: '○',
};

const REASONS: Record<RowState, string> = {
  idle: '',
  invalid: 'invalid URL',
  match: 'matches',
  shadowed: 'shadowed by an earlier rule',
  'miss-host': "host doesn't match",
  'miss-path': "path doesn't match",
  inactive: 'inactive',
};

const CHIPS: string[] = [
  'https://api.github.com/repos/MattAltermatt/freshet',
  'http://127.0.0.1:4391/internal/user/1234',
];

export function UrlTester({ rules, initialUrl }: UrlTesterProps): JSX.Element {
  const [url, setUrl] = useState(initialUrl ?? '');
  useEffect(() => {
    if (initialUrl) setUrl(initialUrl);
  }, [initialUrl]);

  const parsed = useMemo<URL | null>(() => {
    if (!url.trim()) return null;
    try {
      return new URL(url);
    } catch {
      return null;
    }
  }, [url]);

  const winner = useMemo<Rule | null>(() => {
    if (!parsed) return null;
    return findMatchingRule(parsed.hostname, parsed.pathname, rules);
  }, [parsed, rules]);

  const rows = useMemo<Array<{ rule: Rule; state: RowState }>>(() => {
    if (!url.trim()) return rules.map((rule) => ({ rule, state: 'idle' as RowState }));
    if (!parsed) return rules.map((rule) => ({ rule, state: 'invalid' as RowState }));
    return rules.map((rule) => {
      if (!rule.active) return { rule, state: 'inactive' as RowState };
      const hostOk = matchesHost(parsed.hostname, rule.hostPattern);
      const pathOk = matchesPath(parsed.pathname, rule.pathPattern);
      if (rule === winner) return { rule, state: 'match' as RowState };
      if (hostOk && pathOk && winner && winner !== rule) {
        return { rule, state: 'shadowed' as RowState };
      }
      if (!hostOk) return { rule, state: 'miss-host' as RowState };
      return { rule, state: 'miss-path' as RowState };
    });
  }, [url, parsed, rules, winner]);

  return (
    <div class="pj-url-tester">
      <h2>URL tester</h2>
      <p class="pj-url-help">
        Paste any URL to see which rule matches and why the others don't.
      </p>
      {CHIPS.length > 0 ? (
        <div class="pj-chips" aria-label="Example URLs">
          {CHIPS.map((u) => {
            let host = u;
            try {
              host = new URL(u).host;
            } catch {
              /* keep raw */
            }
            return (
              <button
                key={u}
                type="button"
                class="pj-chip"
                title={u}
                onClick={() => setUrl(u)}
              >
                {host}
              </button>
            );
          })}
        </div>
      ) : null}
      <div class="pj-url-input-wrap">
        <input
          type="text"
          class="pj-url-input"
          placeholder="Paste any URL to test"
          value={url}
          onInput={(e) => setUrl((e.target as HTMLInputElement).value)}
        />
        {url ? (
          <button
            type="button"
            class="pj-url-clear"
            aria-label="Clear URL"
            onClick={() => setUrl('')}
          >
            ✕
          </button>
        ) : null}
      </div>
      <p class="pj-url-legend" aria-label="Legend">
        <span><span class="pj-url-icon" aria-hidden="true">✅</span> match</span>
        <span><span class="pj-url-icon" aria-hidden="true">—</span> miss</span>
        <span><span class="pj-url-icon" aria-hidden="true">⚠</span> shadowed</span>
        <span><span class="pj-url-icon" aria-hidden="true">○</span> inactive</span>
      </p>
      {rules.length === 0 ? (
        <p class="pj-url-empty">No rules to test against. Add one on the left.</p>
      ) : (
        <>
          <h3 class="pj-url-results-heading">Per-rule results</h3>
          <ol class="pj-url-results">
          {rows.map(({ rule, state }, i) => (
            <li key={rule.id} class="pj-url-result" data-state={state}>
              <span class="pj-url-icon" aria-hidden="true">
                {ICONS[state]}
              </span>
              <span class="pj-url-order">{i + 1}.</span>
              <span class="pj-url-identity">
                {rule.name ? (
                  <span class="pj-url-name">{rule.name}</span>
                ) : null}
                <code class="pj-url-pattern">
                  {rule.hostPattern || '(any)'} · {rule.pathPattern || '(any)'}
                </code>
              </span>
              {REASONS[state] ? (
                <span class="pj-url-reason">{REASONS[state]}</span>
              ) : null}
            </li>
          ))}
          </ol>
        </>
      )}
    </div>
  );
}
