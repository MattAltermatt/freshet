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
  /** Create a blank template with the given name; returns the accepted name. */
  onCreateTemplate: (name: string) => string;
  /** Open the named template in the Templates tab. */
  onRequestEditTemplate: (name: string) => void;
  directive?: OptionsDirective | null;
  onDirectiveHandled?: () => void;
}

export function RulesTab({
  rules,
  templates,
  onChange,
  onDelete,
  onCreateTemplate,
  onRequestEditTemplate,
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
  const [newRulePath, setNewRulePath] = useState<string>('');
  // Names of templates the user created inline during the current modal
  // session, so the post-save toast can offer to jump straight into editing.
  const [createdTemplateNames, setCreatedTemplateNames] = useState<string[]>([]);
  const toast = useToast();

  useEffect(() => {
    if (!directive) return;
    if (directive.kind === 'test-url') {
      setTesterUrl(directive.url);
      onDirectiveHandled?.();
      return;
    }
    if (directive.kind === 'new-rule') {
      setNewRuleHost(directive.host);
      setNewRulePath(directive.path);
      setEditing(null);
      onDirectiveHandled?.();
      return;
    }
    if (directive.kind !== 'edit-rule') return;
    // edit-rule: defer until rules are populated from storage, otherwise the
    // findIndex on the initial empty array silently drops the directive.
    if (rules.length === 0) return;
    const idx = rules.findIndex((r) => r.id === directive.ruleId);
    if (idx >= 0) {
      setEditing(idx);
    } else {
      // Rule id came from the popup but the rule has since been deleted.
      // Surface it — otherwise the user sees an inexplicable no-op on the
      // options page after clicking "Edit rule".
      toast.push({
        variant: 'info',
        message: 'Rule not found — it may have been deleted.',
        ttlMs: 4000,
      });
    }
    onDirectiveHandled?.();
  }, [directive, rules]);

  const close = (): void => {
    setEditing(undefined);
    setNewRuleHost('');
    setNewRulePath('');
    setCreatedTemplateNames([]);
  };

  const handleCreateTemplate = (name: string): string => {
    const accepted = onCreateTemplate(name);
    setCreatedTemplateNames((prev) => [...prev, accepted]);
    return accepted;
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
    const inlineTemplateName = isNew && createdTemplateNames.includes(rule.templateName)
      ? rule.templateName
      : null;
    close();
    if (inlineTemplateName) {
      toast.push({
        variant: 'success',
        message: `Rule added · template "${inlineTemplateName}" is empty`,
        ttlMs: 6000,
        action: {
          label: 'Open template →',
          onClick: () => onRequestEditTemplate(inlineTemplateName),
        },
      });
      return;
    }
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
          {...(editing === null && newRulePath ? { initialPath: newRulePath } : {})}
          templates={templates}
          onSave={save}
          onCancel={close}
          onCreateTemplate={handleCreateTemplate}
        />
      ) : null}
    </div>
  );
}
