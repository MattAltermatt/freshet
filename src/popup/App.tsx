import type { JSX } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { promoteStorageToLocal } from '../storage/promoteStorageToLocal';
import { truncateUrlMiddle } from '../shared/truncateUrl';
// Deep imports (not the `../ui` barrel) so the popup bundle doesn't pull in
// CodeMirror via `CodeMirrorBox` / `pjHighlightStyle`. Keeps popup under budget.
import { Toggle } from '../ui/components/Toggle';
import { useStorage } from '../ui/hooks/useStorage';
import type { HostSkipList, Rule } from '../shared/types';
import { findMatchingRule } from '../matcher/matcher';
import { directiveHash } from '../options/directives';

interface ActiveTab {
  url: string;
  host: string;
}

function openOptionsAt(hash: string): void {
  const url = chrome.runtime.getURL('src/options/options.html') + hash;
  void chrome.tabs.create({ url });
  window.close();
}

function readActiveTab(): Promise<ActiveTab> {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const url = tabs[0]?.url ?? '';
      let host = '';
      try {
        host = url ? new URL(url).hostname : '';
      } catch {
        host = '';
      }
      resolve({ url, host });
    });
  });
}

export function App(): JSX.Element {
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<ActiveTab>({ url: '', host: '' });
  const [testUrl, setTestUrl] = useState<string>('');
  const [rules] = useStorage<'rules', Rule[]>('rules', []);
  const [skipList, writeSkipList] = useStorage<'hostSkipList', HostSkipList>(
    'hostSkipList',
    [],
  );

  useEffect(() => {
    void Promise.all([promoteStorageToLocal(), readActiveTab()]).then(([, t]) => {
      setTab(t);
      setTestUrl(t.url);
      setReady(true);
    });
  }, []);

  const skipped = tab.host ? skipList.includes(tab.host) : false;

  const toggleSkip = async (next: boolean): Promise<void> => {
    if (!tab.host) return;
    const updated = next
      ? Array.from(new Set([...skipList, tab.host]))
      : skipList.filter((h) => h !== tab.host);
    await writeSkipList(updated);
  };

  const matched = (() => {
    if (!tab.url) return null;
    try {
      const u = new URL(tab.url);
      return findMatchingRule(u.hostname, u.pathname, rules);
    } catch {
      return null;
    }
  })();

  if (!ready) {
    return (
      <div class="pj-popup pj-popup--booting">
        <p class="pj-popup-placeholder">Loading…</p>
      </div>
    );
  }

  return (
    <div class="pj-popup">
      <header class="pj-popup-header">
        <span class="pj-logo" aria-hidden="true">
          <span class="pj-logo-brace">{'{'}</span>
          <span class="pj-logo-bracket">{'>'}</span>
        </span>
        <h1>Present-JSON</h1>
      </header>
      <section class="pj-popup-url" aria-label="Active tab URL">
        <span class="pj-popup-label">Tab URL</span>
        <code class="pj-popup-url-text" title={tab.url}>
          {tab.url ? truncateUrlMiddle(tab.url, 44) : '(no URL)'}
        </code>
      </section>
      <section class="pj-popup-match" aria-label="Match status">
        <span class="pj-popup-label">Matched rule</span>
        {matched ? (
          <div class="pj-popup-match-row">
            <span class="pj-rule-chip">{matched.templateName || matched.id}</span>
            <button
              type="button"
              class="pj-linkish"
              onClick={() => matched && openOptionsAt(directiveHash.editRule(matched.id))}
            >
              Edit rule
            </button>
          </div>
        ) : (
          <div class="pj-popup-match-row">
            <span class="pj-popup-miss">No rule matches this URL</span>
            <button
              type="button"
              class="pj-btn pj-btn--accent"
              disabled={!tab.host}
              onClick={() => openOptionsAt(directiveHash.newRule(tab.url))}
            >
              + Add rule for this host
            </button>
          </div>
        )}
      </section>
      <section class="pj-popup-test" aria-label="Test URL in options">
        <label class="pj-popup-label" for="pj-popup-test-url">Test URL</label>
        <div class="pj-popup-test-row">
          <div class="pj-popup-test-input-wrap">
            <input
              id="pj-popup-test-url"
              type="text"
              class="pj-popup-test-input"
              value={testUrl}
              onInput={(e) => setTestUrl((e.target as HTMLInputElement).value)}
              placeholder="https://…"
            />
            {testUrl ? (
              <button
                type="button"
                class="pj-popup-test-clear"
                aria-label="Clear test URL"
                onClick={() => setTestUrl('')}
              >
                ✕
              </button>
            ) : null}
          </div>
          <button
            type="button"
            class="pj-btn"
            disabled={!testUrl.trim()}
            onClick={() => openOptionsAt(directiveHash.testUrl(testUrl.trim()))}
          >
            Test in options
          </button>
        </div>
      </section>
      <section class="pj-popup-skip" aria-label="Skip toggle">
        <Toggle
          checked={skipped}
          onChange={(next) => void toggleSkip(next)}
          disabled={!tab.host}
          label={
            tab.host
              ? `Skip Present-JSON on ${tab.host}`
              : 'Skip toggle unavailable on this page'
          }
        />
      </section>
      <footer class="pj-popup-footer">
        <button
          type="button"
          class="pj-linkish"
          onClick={() => chrome.runtime.openOptionsPage()}
        >
          Open options
        </button>
      </footer>
    </div>
  );
}
