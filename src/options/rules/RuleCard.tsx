import type { JSX } from 'preact';
import { Toggle } from '../../ui';
import type { Rule } from '../../shared/types';
import type { ImportFlagEntry } from '../../storage/storage';
import { NeedsAttention } from '../badges/NeedsAttention';
import { RuleIdentity } from './RuleIdentity';

export interface RuleCardProps {
  rule: Rule;
  index: number;
  total: number;
  onToggle: (active: boolean) => void;
  onEdit: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
  flagEntry?: ImportFlagEntry;
  onDismissFlags?: () => void;
  gripProps?: JSX.HTMLAttributes<HTMLSpanElement>;
  cardProps?: JSX.HTMLAttributes<HTMLElement>;
  displayNumber?: number;
  didDrag?: () => boolean;
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
  flagEntry,
  onDismissFlags,
  gripProps,
  cardProps,
  displayNumber,
  didDrag,
}: RuleCardProps): JSX.Element {
  const varCount = Object.keys(rule.variables).length;
  const num = displayNumber ?? index + 1;
  const ruleLabel = rule.name || rule.hostPattern || 'unnamed rule';
  return (
    <article
      class={`pj-rule-card${rule.active ? ' pj-rule-card--active' : ' pj-rule-card--inactive'}`}
      {...cardProps}
    >
      <span
        class="pj-rule-grip"
        role="button"
        tabIndex={-1}
        aria-label={`Drag to reorder rule ${index + 1}: ${ruleLabel}`}
        {...gripProps}
      >
        ⋮⋮
      </span>
      <div class="pj-rule-num" aria-label={`Rule ${num}`}>{num}</div>
      <div class="pj-rule-main">
        <button
          type="button"
          class="pj-rule-body"
          onClick={() => { if (!didDrag?.()) onEdit(); }}
        >
          <RuleIdentity rule={rule} density="card" />
          {rule.isExample && !rule.exampleUrl ? (
            <span class="pj-example-pill" title="Bundled with Freshet">
              Example
            </span>
          ) : null}
          {varCount > 0 ? (
            <span class="pj-rule-vars" title={`${varCount} variables`}>
              {varCount} {varCount === 1 ? 'var' : 'vars'}
            </span>
          ) : null}
        </button>
        {rule.isExample && rule.exampleUrl ? (
          <a
            class="pj-example-pill pj-example-pill--link"
            href={rule.exampleUrl}
            target="_blank"
            rel="noopener noreferrer"
            title={`Example: ${rule.exampleUrl}`}
          >
            Example <span class="pj-example-pill-arrow" aria-hidden="true">↗</span>
          </a>
        ) : null}
      </div>
      {flagEntry && onDismissFlags ? (
        <NeedsAttention entry={flagEntry} onDismiss={onDismissFlags} />
      ) : null}
      <div class="pj-rule-controls" onClick={(e) => e.stopPropagation()}>
        <Toggle label="Active" checked={rule.active} onChange={onToggle} />
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
