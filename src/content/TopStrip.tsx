import type { JSX } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { Menu, type MenuItem } from '../ui/components/Menu';
import { useStorage } from '../ui/hooks/useStorage';
import { useTheme } from '../ui/hooks/useTheme';
import type { ThemePreference } from '../ui/theme';
import { directiveHash } from '../options/directives';
import type { Rule } from '../shared/types';

export interface TopStripProps {
  rule: Rule;
  renderedHtml: string;
  rawJsonText: string;
  contentRoot: HTMLElement;
  /** Set automatically by mountTopStrip; overridable in tests. */
  shadowHost?: HTMLElement;
  /** Phase 4 hook — reserved slot for the "another viewer handled this page" degraded state. */
  degraded?: { reason: string };
}

type ViewMode = 'rendered' | 'raw';

export function TopStrip({
  rule,
  renderedHtml,
  rawJsonText,
  contentRoot,
  shadowHost,
  degraded,
}: TopStripProps): JSX.Element {
  const env = rule.variables['env'];
  const [mode, setMode] = useState<ViewMode>('rendered');
  const [toast, setToast] = useState<{ kind: 'copy'; text: string } | null>(null);
  const [settings, writeSettings] = useStorage<
    'settings',
    { themePreference: ThemePreference }
  >('settings', { themePreference: 'system' });
  useTheme(
    shadowHost
      ? { preference: settings.themePreference, root: shadowHost }
      : { preference: settings.themePreference },
  );

  useEffect(() => {
    const onMessage = (message: unknown): void => {
      if (
        typeof message === 'object' &&
        message !== null &&
        (message as { kind?: unknown }).kind === 'pj:toggle-raw'
      ) {
        setMode((m) => (m === 'rendered' ? 'raw' : 'rendered'));
      }
    };
    chrome.runtime.onMessage.addListener(onMessage);
    return () => chrome.runtime.onMessage.removeListener(onMessage);
  }, []);

  useEffect(() => {
    if (mode === 'rendered') {
      const htmlAssign = 'inner' + 'HTML';
      (contentRoot as unknown as Record<string, unknown>)[htmlAssign] = renderedHtml;
      contentRoot.removeAttribute('data-mode');
      return;
    }
    let pretty: string;
    try {
      pretty = JSON.stringify(JSON.parse(rawJsonText), null, 2);
    } catch {
      pretty = rawJsonText;
    }
    const pre = document.createElement('pre');
    pre.style.cssText =
      'margin:0;padding:12px;font:12px ui-monospace,Menlo,monospace;white-space:pre-wrap;';
    pre.textContent = pretty;
    contentRoot.replaceChildren(pre);
    contentRoot.setAttribute('data-mode', 'raw');
  }, [mode, contentRoot, renderedHtml, rawJsonText]);

  const copyUrl = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setToast({ kind: 'copy', text: 'Copied URL to clipboard' });
      setTimeout(() => setToast(null), 1600);
    } catch {
      /* silent — user can still copy from the system URL bar. */
    }
  };

  const copyJson = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(rawJsonText);
      setToast({ kind: 'copy', text: 'Copied JSON to clipboard' });
      setTimeout(() => setToast(null), 1600);
    } catch {
      /* silent — clipboard may be unavailable in some contexts. */
    }
  };

  // Content scripts cannot call chrome.tabs.create in MV3 — route through background.
  const openEditRule = (): void => {
    void chrome.runtime.sendMessage({
      kind: 'pj:open-options',
      hash: directiveHash.editRule(rule.id),
    });
  };

  const openEditTemplate = (): void => {
    void chrome.runtime.sendMessage({
      kind: 'pj:open-options',
      hash: directiveHash.editTemplate(rule.templateName),
    });
  };

  // Same labels + icons as the options-page Header theme control so the two
  // surfaces read identically (see src/options/Header.tsx).
  const THEME_OPTIONS: Array<{ pref: ThemePreference; label: string; icon: string }> = [
    { pref: 'system', label: 'Theme: Auto', icon: '◐' },
    { pref: 'light', label: 'Theme: Light', icon: '☀' },
    { pref: 'dark', label: 'Theme: Dark', icon: '☾' },
  ];

  const themeItems: MenuItem[] = THEME_OPTIONS.map(({ pref, label, icon }) => {
    const active = settings.themePreference === pref;
    const item: MenuItem = {
      label,
      icon: <span aria-hidden="true">{icon}</span>,
      onSelect: () =>
        void writeSettings({ ...settings, themePreference: pref }),
    };
    if (active) item.trailingIcon = <span aria-hidden="true">✓</span>;
    return item;
  });

  return (
    <div class="pj-topstrip" data-testid="pj-topstrip">
      <span class="pj-logo" aria-hidden="true">
        <span class="pj-logo-brace">{'{'}</span>
        <span class="pj-logo-bracket">{'>'}</span>
      </span>
      {env ? (
        <span class="pj-env-chip" data-testid="pj-env-chip">
          {env}
        </span>
      ) : null}
      <button
        type="button"
        class="pj-link"
        data-testid="pj-rule-link"
        title="Edit this rule"
        onClick={openEditRule}
      >
        <span class="pj-link-label">
          {rule.name || rule.hostPattern || '(unnamed rule)'}
        </span>
        <span class="pj-link-arrow" aria-hidden="true">↗</span>
      </button>
      <span class="pj-sep" aria-hidden="true">·</span>
      <button
        type="button"
        class="pj-link"
        data-testid="pj-rule-name"
        title={`Edit template "${rule.templateName}"`}
        onClick={openEditTemplate}
      >
        <span class="pj-link-label">{rule.templateName}</span>
        <span class="pj-link-arrow" aria-hidden="true">↗</span>
      </button>
      {degraded ? (
        <span class="pj-degraded" data-testid="pj-degraded">
          ⚠ {degraded.reason}
        </span>
      ) : (
        <div class="pj-right">
          <div class="pj-toggle-group" role="group" aria-label="View mode">
            <button
              type="button"
              aria-pressed={mode === 'rendered'}
              onClick={() => setMode('rendered')}
            >
              Rendered
            </button>
            <button
              type="button"
              aria-pressed={mode === 'raw'}
              onClick={() => setMode('raw')}
              title="Toggle raw JSON (⌘⇧J)"
            >
              Raw<span class="pj-toggle-hint"> ⌘⇧J</span>
            </button>
          </div>
          <button
            type="button"
            class="pj-btn"
            data-testid="pj-copy-url"
            title="Copy URL to clipboard"
            onClick={() => void copyUrl()}
          >
            <span class="pj-btn-icon" aria-hidden="true">⧉</span>
            <span>Copy URL</span>
          </button>
          <button
            type="button"
            class="pj-btn"
            data-testid="pj-copy-json"
            title="Copy raw JSON to clipboard"
            onClick={() => void copyJson()}
          >
            <span class="pj-btn-icon" aria-hidden="true">{'{}'}</span>
            <span>Copy JSON</span>
          </button>
          <Menu
            align="right"
            items={themeItems}
            trigger={
              <button
                type="button"
                class="pj-btn pj-theme-trigger"
                data-testid="pj-theme-trigger"
                aria-label="Theme"
                title="Theme"
              >
                <span class="pj-btn-icon" aria-hidden="true">
                  {settings.themePreference === 'dark'
                    ? '☾'
                    : settings.themePreference === 'light'
                      ? '☀'
                      : '◐'}
                </span>
                <span>
                  {settings.themePreference === 'dark'
                    ? 'Dark'
                    : settings.themePreference === 'light'
                      ? 'Light'
                      : 'Auto'}
                </span>
                <span class="pj-btn-chev" aria-hidden="true">▾</span>
              </button>
            }
          />
        </div>
      )}
      {toast ? (
        <div
          class="pj-toast"
          role="status"
          aria-live="polite"
          data-testid="pj-toast"
        >
          {toast.text}
        </div>
      ) : null}
    </div>
  );
}
