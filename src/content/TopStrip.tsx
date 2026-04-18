import type { JSX } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { Menu, type MenuItem } from '../ui/components/Menu';
import { useStorage } from '../ui/hooks/useStorage';
import { useTheme } from '../ui/hooks/useTheme';
import type { ThemePreference } from '../ui/theme';
import { directiveHash } from '../options/directives';
import type { HostSkipList, Rule } from '../shared/types';

export interface TopStripProps {
  rule: Rule;
  renderedHtml: string;
  rawJsonText: string;
  contentRoot: HTMLElement;
  /** Set automatically by mountTopStrip; overridable in tests. */
  shadowHost?: HTMLElement;
}

type ViewMode = 'rendered' | 'raw';

export function TopStrip({
  rule,
  renderedHtml,
  rawJsonText,
  contentRoot,
  shadowHost,
}: TopStripProps): JSX.Element {
  const env = rule.variables['env'];
  const [mode, setMode] = useState<ViewMode>('rendered');
  const [copyPulse, setCopyPulse] = useState(false);
  const [skipList, writeSkipList] = useStorage<'hostSkipList', HostSkipList>(
    'hostSkipList',
    [],
  );
  const [settings] = useStorage<'settings', { themePreference: ThemePreference }>(
    'settings',
    { themePreference: 'system' },
  );
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
      setCopyPulse(true);
      setTimeout(() => setCopyPulse(false), 1200);
    } catch {
      /* silent — user can still copy from the system URL bar. */
    }
  };

  const openEditRule = (): void => {
    const url =
      chrome.runtime.getURL('src/options/options.html') + directiveHash.editRule(rule.id);
    void chrome.tabs.create({ url });
  };

  const skipHost = async (): Promise<void> => {
    const host = window.location.hostname;
    if (!host) return;
    const next = Array.from(new Set([...skipList, host]));
    await writeSkipList(next);
    window.location.reload();
  };

  const menuItems: MenuItem[] = [
    {
      label: copyPulse ? 'Copied ✓' : 'Copy URL',
      icon: <span aria-hidden="true">{copyPulse ? '✓' : '↗'}</span>,
      onSelect: () => void copyUrl(),
    },
    {
      label: 'Edit rule',
      icon: <span aria-hidden="true">✎</span>,
      onSelect: openEditRule,
    },
    {
      label: 'Skip this host',
      icon: <span aria-hidden="true">✕</span>,
      danger: true,
      onSelect: () => void skipHost(),
    },
  ];

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
      <span class="pj-rule-name" data-testid="pj-rule-name" title={rule.templateName}>
        {rule.templateName}
      </span>
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
      <Menu
        align="right"
        items={menuItems}
        trigger={
          <button
            type="button"
            class="pj-menu-trigger-btn"
            aria-label="More actions"
            data-testid="pj-menu-trigger"
          >
            ⋯
          </button>
        }
      />
    </div>
  );
}
