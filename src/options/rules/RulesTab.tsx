import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import type { Rule, Templates } from '../../shared/types';
import { RuleStack } from './RuleStack';
import { UrlTester } from './UrlTester';
import { RuleEditModal } from './RuleEditModal';

export interface RulesTabProps {
  rules: Rule[];
  templates: Templates;
  onChange: (next: Rule[]) => void;
  onDelete: (index: number, rule: Rule) => void;
}

export function RulesTab({
  rules,
  templates,
  onChange,
  onDelete,
}: RulesTabProps): JSX.Element {
  // editing:
  //   undefined = modal closed
  //   null      = modal open for a NEW rule
  //   number    = modal open to edit rule at that index
  const [editing, setEditing] = useState<number | null | undefined>(undefined);

  const close = (): void => setEditing(undefined);

  const save = (rule: Rule): void => {
    if (editing === null) {
      onChange([...rules, rule]);
    } else if (typeof editing === 'number') {
      const next = [...rules];
      next[editing] = rule;
      onChange(next);
    }
    close();
  };

  return (
    <div class="pj-rules-tab">
      <section class="pj-rules-left">
        <RuleStack
          rules={rules}
          templates={templates}
          onChange={onChange}
          onEdit={(idx) => setEditing(idx)}
          onDelete={(idx) => onDelete(idx, rules[idx]!)}
        />
      </section>
      <section class="pj-rules-right">
        <UrlTester rules={rules} />
      </section>
      {editing !== undefined ? (
        <RuleEditModal
          initial={editing === null ? null : rules[editing] ?? null}
          templates={templates}
          onSave={save}
          onCancel={close}
        />
      ) : null}
    </div>
  );
}
