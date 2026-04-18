import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import { useToast } from '../../ui';
import type { Rule, Templates } from '../../shared/types';
import { RuleStack } from './RuleStack';
import { UrlTester } from './UrlTester';
import { RuleEditModal } from './RuleEditModal';

export interface RulesTabProps {
  rules: Rule[];
  templates: Templates;
  onChange: (next: Rule[]) => void;
  onDelete: (index: number) => void;
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
  const toast = useToast();

  const close = (): void => setEditing(undefined);

  const save = (rule: Rule): void => {
    const isNew = editing === null;
    if (isNew) {
      onChange([...rules, rule]);
    } else if (typeof editing === 'number') {
      const next = [...rules];
      next[editing] = rule;
      onChange(next);
    }
    close();
    toast.push({
      variant: 'success',
      message: isNew ? 'Rule added · Saved ✓' : 'Rule saved ✓',
      ttlMs: 2000,
    });
  };

  return (
    <div class="pj-rules-tab">
      <section class="pj-rules-left">
        <RuleStack
          rules={rules}
          templates={templates}
          onChange={onChange}
          onEdit={(idx) => setEditing(idx)}
          onDelete={(idx) => onDelete(idx)}
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
