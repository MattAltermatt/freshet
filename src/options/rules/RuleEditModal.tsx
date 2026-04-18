import type { JSX } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { Button, KVEditor, Toggle } from '../../ui';
import { isValidHostPattern, isValidPathPattern } from '../../matcher/glob';
import type { Rule, Templates } from '../../shared/types';
import { PatternField } from './PatternField';

export interface RuleEditModalProps {
  initial: Rule | null;
  templates: Templates;
  onSave: (rule: Rule) => void;
  onCancel: () => void;
}

const HOST_EXAMPLES = ['*.server.com', '127.0.0.1', '/^admin.*/', 'api.example.com'];
const PATH_EXAMPLES = ['/', '/api/**', '/users/*', '/^\\/v2\\/.*$/'];

function blankRule(templates: Templates): Rule {
  return {
    id: `rule-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    hostPattern: '',
    pathPattern: '/',
    templateName: Object.keys(templates)[0] ?? '',
    variables: {},
    enabled: true,
  };
}

export function RuleEditModal({
  initial,
  templates,
  onSave,
  onCancel,
}: RuleEditModalProps): JSX.Element {
  const [rule, setRule] = useState<Rule>(() =>
    initial ? structuredClone(initial) : blankRule(templates),
  );

  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onCancel]);

  const hostErr = isValidHostPattern(rule.hostPattern) ? null : 'Invalid glob or regex';
  const pathErr = isValidPathPattern(rule.pathPattern)
    ? null
    : rule.pathPattern === ''
      ? 'Path pattern is required'
      : 'Invalid glob or regex';
  const templateErr = rule.templateName ? null : 'Select a template';
  const canSave = !hostErr && !pathErr && !templateErr;

  const templateNames = Object.keys(templates);
  const title = initial ? `Edit rule · ${initial.id}` : 'New rule';

  return (
    <div
      class="pj-modal-backdrop"
      onClick={onCancel}
      role="presentation"
    >
      <div
        class="pj-modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        ref={dialogRef}
        onClick={(e) => e.stopPropagation()}
      >
        <header class="pj-modal-header">
          <h3>{title}</h3>
          <Toggle
            label={rule.enabled ? 'Enabled' : 'Disabled'}
            checked={rule.enabled}
            onChange={(en) => setRule({ ...rule, enabled: en })}
          />
        </header>

        <div class="pj-modal-body">
          <PatternField
            label="Host pattern"
            value={rule.hostPattern}
            onChange={(v) => setRule({ ...rule, hostPattern: v })}
            examples={HOST_EXAMPLES}
            placeholder="api.example.com · *.server.com · /regex/"
            hint="Leave empty to match any host. Glob (*, **) or /regex/ between slashes."
            error={hostErr}
          />
          <PatternField
            label="Path pattern"
            value={rule.pathPattern}
            onChange={(v) => setRule({ ...rule, pathPattern: v })}
            examples={PATH_EXAMPLES}
            placeholder="/api/** · /users/* · /regex/"
            hint="Glob (* matches a segment, ** matches any number of segments) or /regex/ between slashes."
            error={pathErr}
          />
          <div class="pj-field">
            <label for="pj-rule-tmpl">Template</label>
            {templateNames.length > 0 ? (
              <select
                id="pj-rule-tmpl"
                class={templateErr ? 'pj-invalid' : ''}
                value={rule.templateName}
                onChange={(e) =>
                  setRule({
                    ...rule,
                    templateName: (e.target as HTMLSelectElement).value,
                  })
                }
              >
                {templateNames.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            ) : (
              <div class="pj-field-hint">
                No templates yet. Add one on the <strong>Templates</strong> tab first.
              </div>
            )}
            {templateErr ? <div class="pj-field-err">{templateErr}</div> : null}
          </div>
          <div class="pj-field">
            <label>Variables</label>
            <p class="pj-field-hint">
              Accessible in templates as{' '}
              <code>{'{{ vars.name }}'}</code>.
            </p>
            <KVEditor
              value={rule.variables}
              onChange={(vars) => setRule({ ...rule, variables: vars })}
            />
          </div>
        </div>

        <footer class="pj-modal-footer">
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={!canSave}
            onClick={() => canSave && onSave(rule)}
          >
            {initial ? 'Save changes' : 'Add rule'}
          </Button>
        </footer>
      </div>
    </div>
  );
}
