import type { JSX } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { promoteStorageToLocal } from '../storage/promoteStorageToLocal';
import { truncateUrlMiddle } from '../shared/truncateUrl';

interface ActiveTab {
  url: string;
  host: string;
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

  useEffect(() => {
    void Promise.all([promoteStorageToLocal(), readActiveTab()]).then(([, t]) => {
      setTab(t);
      setReady(true);
    });
  }, []);

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
    </div>
  );
}
