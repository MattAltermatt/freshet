import type { JSX } from 'preact';
import type { Rule, Templates } from '../../shared/types';
import { RuleCard } from './RuleCard';

export interface RuleStackProps {
  rules: Rule[];
  templates: Templates;
  onChange: (next: Rule[]) => void;
  onEdit: (index: number | null) => void;
  onDelete: (index: number) => void;
}

export function RuleStack({
  rules,
  onChange,
  onEdit,
  onDelete,
}: RuleStackProps): JSX.Element {
  const swap = (i: number, j: number): void => {
    if (i < 0 || j < 0 || i >= rules.length || j >= rules.length) return;
    const next = [...rules];
    [next[i], next[j]] = [next[j]!, next[i]!];
    onChange(next);
  };

  const patch = (i: number, p: Partial<Rule>): void => {
    const next = rules.map((r, k) => (k === i ? { ...r, ...p } : r));
    onChange(next);
  };

  return (
    <div class="pj-rule-stack">
      <div class="pj-rule-stack-header">
        <h2>Rules</h2>
        <button
          type="button"
          class="pj-btn"
          data-variant="primary"
          onClick={() => onEdit(null)}
        >
          + Add rule
        </button>
      </div>
      {rules.length === 0 ? (
        <div class="pj-empty">
          <p>No rules yet.</p>
          <p class="pj-empty-hint">
            Click <strong>+ Add rule</strong> to match a URL pattern to a template.
          </p>
        </div>
      ) : (
        <div class="pj-rule-cards">
          {rules.map((r, i) => (
            <RuleCard
              key={r.id}
              rule={r}
              index={i}
              total={rules.length}
              onToggle={(a) => patch(i, { active: a })}
              onEdit={() => onEdit(i)}
              onMoveUp={() => swap(i, i - 1)}
              onMoveDown={() => swap(i, i + 1)}
              onDelete={() => onDelete(i)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
