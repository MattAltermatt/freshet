import type { JSX } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import type { ThemePreference } from '../ui';

export interface HeaderProps {
  tab: 'rules' | 'templates';
  onTab: (t: 'rules' | 'templates') => void;
  themePref: ThemePreference;
  onThemePref: (p: ThemePreference) => void;
}

const SYNC_LIMIT = 102400; // chrome.storage.sync byte quota

export function Header({ tab, onTab, themePref, onThemePref }: HeaderProps): JSX.Element {
  const [bytes, setBytes] = useState<number>(0);

  useEffect(() => {
    if (typeof chrome === 'undefined' || !chrome.storage?.sync?.getBytesInUse) return;
    const update = (): void => {
      chrome.storage.sync.getBytesInUse(null, (n: number) => setBytes(n));
    };
    update();
    chrome.storage.onChanged.addListener(update);
    return () => chrome.storage.onChanged.removeListener(update);
  }, []);

  const pct = Math.min(100, (bytes / SYNC_LIMIT) * 100);
  const tone = pct > 80 ? 'danger' : pct > 50 ? 'warn' : 'ok';
  const kb = (bytes / 1024).toFixed(1);

  return (
    <header class="pj-header">
      <div class="pj-brand">
        <span class="pj-logo" aria-hidden="true">{'{>'}</span>
        <h1>Present-JSON</h1>
      </div>
      <nav class="pj-tabs">
        <button
          class={`pj-tab${tab === 'rules' ? ' pj-tab--active' : ''}`}
          onClick={() => onTab('rules')}
        >
          Rules
        </button>
        <button
          class={`pj-tab${tab === 'templates' ? ' pj-tab--active' : ''}`}
          onClick={() => onTab('templates')}
        >
          Templates
        </button>
      </nav>
      <div
        class="pj-quota"
        data-tone={tone}
        title={`${kb} KB of 100 KB sync storage`}
      >
        <div class="pj-quota-fill" style={{ width: `${pct}%` }} />
        <span class="pj-quota-label">{kb} KB / 100 KB</span>
      </div>
      <label class="pj-theme-toggle">
        <span class="pj-visually-hidden">Theme</span>
        <select
          value={themePref}
          onChange={(e) =>
            onThemePref((e.target as HTMLSelectElement).value as ThemePreference)
          }
        >
          <option value="system">Auto</option>
          <option value="light">Light</option>
          <option value="dark">Dark</option>
        </select>
      </label>
    </header>
  );
}
