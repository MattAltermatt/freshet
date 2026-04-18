import type { JSX } from 'preact';
import type { Rule } from '../shared/types';

export interface TopStripProps {
  rule: Rule;
  renderedHtml: string;
  rawJsonText: string;
  contentRoot: HTMLElement;
  /** Set automatically by mountTopStrip; overridable in tests. */
  shadowHost?: HTMLElement;
}

export function TopStrip({ rule }: TopStripProps): JSX.Element {
  return (
    <div class="pj-topstrip" data-testid="pj-topstrip">
      <span class="pj-rule-name" data-testid="pj-rule-name">
        {rule.templateName}
      </span>
    </div>
  );
}
