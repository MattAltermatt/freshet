import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import { Menu, type MenuItem } from '../ui/components/Menu';
import type { Rule } from '../shared/types';

export interface TopStripProps {
  rule: Rule;
  renderedHtml: string;
  rawJsonText: string;
  contentRoot: HTMLElement;
  /** Set automatically by mountTopStrip; overridable in tests. */
  shadowHost?: HTMLElement;
}

type ViewMode = 'rendered' | 'raw';

export function TopStrip({ rule }: TopStripProps): JSX.Element {
  const env = rule.variables['env'];
  const [mode, setMode] = useState<ViewMode>('rendered');

  const menuItems: MenuItem[] = [
    { label: 'Copy URL', onSelect: () => {/* Task 11 */} },
    { label: 'Edit rule', onSelect: () => {/* Task 12 */} },
    { label: 'Skip this host', danger: true, onSelect: () => {/* Task 13 */} },
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
