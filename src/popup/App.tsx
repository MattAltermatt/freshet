import type { JSX } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { promoteStorageToLocal } from '../storage/promoteStorageToLocal';

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
      <p class="pj-popup-placeholder">Tab: {tab.url || '(no URL)'}</p>
    </div>
  );
}
