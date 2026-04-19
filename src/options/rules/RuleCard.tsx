import type { JSX } from 'preact';
import { Toggle } from '../../ui';
import type { Rule } from '../../shared/types';

export interface RuleCardProps {
  rule: Rule;
  index: number;
  total: number;
  onToggle: (enabled: boolean) => void;
  onEdit: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
}

export function RuleCard({
  rule,
  index,
  total,
  onToggle,
  onEdit,
  onMoveUp,
  onMoveDown,
  onDelete,
}: RuleCardProps): JSX.Element {
  const varCount = Object.keys(rule.variables).length;
  return (
    <article
      class={`pj-rule-card${rule.enabled ? ' pj-rule-card--active' : ' pj-rule-card--disabled'}`}
    >
      <div class="pj-rule-num" aria-label={`Rule ${index + 1}`}>{index + 1}</div>
      <button type="button" class="pj-rule-body" onClick={onEdit}>
        <code class="pj-rule-pattern">
          {rule.hostPattern || '(any host)'} <span class="pj-rule-sep">·</span>{' '}
          {rule.pathPattern || '(any path)'}
        </code>
        <span class="pj-rule-template" title={`Template: ${rule.templateName}`}>
          {rule.templateName}
        </span>
        {rule.isExample ? (
          rule.exampleUrl ? (
            <a
              class="pj-example-pill pj-example-pill--link"
              href={rule.exampleUrl}
              target="_blank"
              rel="noopener noreferrer"
              title={`Example: ${rule.exampleUrl}`}
              onClick={(e) => e.stopPropagation()}
            >
              Example <span class="pj-example-pill-arrow" aria-hidden="true">↗</span>
            </a>
          ) : (
            <span class="pj-example-pill" title="Bundled with Freshet">
              Example
            </span>
          )
        ) : null}
        {varCount > 0 ? (
          <span class="pj-rule-vars" title={`${varCount} variables`}>
            {varCount} {varCount === 1 ? 'var' : 'vars'}
          </span>
        ) : null}
      </button>
      <div class="pj-rule-controls" onClick={(e) => e.stopPropagation()}>
        <Toggle label="Enabled" checked={rule.enabled} onChange={onToggle} />
        <button
          type="button"
          class="pj-rule-iconbtn"
          aria-label="move up"
          title="Move earlier (higher priority)"
          disabled={index === 0}
          onClick={onMoveUp}
        >
          ▲
        </button>
        <button
          type="button"
          class="pj-rule-iconbtn"
          aria-label="move down"
          title="Move later (lower priority)"
          disabled={index === total - 1}
          onClick={onMoveDown}
        >
          ▼
        </button>
        <button
          type="button"
          class="pj-rule-iconbtn pj-rule-iconbtn--danger"
          aria-label={`delete rule ${index + 1}`}
          title="Delete this rule"
          onClick={onDelete}
        >
          ✕
        </button>
      </div>
    </article>
  );
}
