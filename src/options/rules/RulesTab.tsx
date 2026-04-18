import type { JSX } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { useToast } from '../../ui';
import type { Rule, Templates } from '../../shared/types';
import { RuleStack } from './RuleStack';
import { UrlTester } from './UrlTester';
import { RuleEditModal } from './RuleEditModal';
import type { OptionsDirective } from '../directives';

export interface RulesTabProps {
  rules: Rule[];
  templates: Templates;
  onChange: (next: Rule[]) => void;
  onDelete: (index: number) => void;
  directive?: OptionsDirective | null;
  onDirectiveHandled?: () => void;
}

export function RulesTab({
  rules,
  templates,
  onChange,
  onDelete,
  directive,
  onDirectiveHandled,
}: RulesTabProps): JSX.Element {
  // editing:
  //   undefined = modal closed
  //   null      = modal open for a NEW rule
  //   number    = modal open to edit rule at that index
  const [editing, setEditing] = useState<number | null | undefined>(undefined);
  const [testerUrl, setTesterUrl] = useState<string>('');
  const [newRuleHost, setNewRuleHost] = useState<string>('');
  const toast = useToast();

  useEffect(() => {
    if (!directive) return;
    if (directive.kind === 'test-url') {
      setTesterUrl(directive.url);
    } else if (directive.kind === 'new-rule') {
      setNewRuleHost(directive.host);
      setEditing(null);
    } else if (directive.kind === 'edit-rule') {
      const idx = rules.findIndex((r) => r.id === directive.ruleId);
      if (idx >= 0) setEditing(idx);
    }
    onDirectiveHandled?.();
  }, [directive]);

  const close = (): void => {
    setEditing(undefined);
    setNewRuleHost('');
  };

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
        <UrlTester rules={rules} initialUrl={testerUrl} />
      </section>
      {editing !== undefined ? (
        <RuleEditModal
          initial={editing === null ? null : rules[editing] ?? null}
          {...(editing === null && newRuleHost ? { initialHost: newRuleHost } : {})}
          templates={templates}
          onSave={save}
          onCancel={close}
        />
      ) : null}
    </div>
  );
}
