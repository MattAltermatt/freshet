import type { JSX } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { Button, KVEditor, Toggle, useFocusTrap } from '../../ui';
import { isValidHostPattern, isValidPathPattern } from '../../matcher/glob';
import type { Rule, Templates } from '../../shared/types';
import { suggestTemplateName, uniqueTemplateName } from '../../shared/suggestTemplateName';
import { extractTemplateVars } from '../../shared/extractTemplateVars';
import { PatternField } from './PatternField';

export interface RuleEditModalProps {
  initial: Rule | null;
  initialHost?: string;
  initialPath?: string;
  templates: Templates;
  onSave: (rule: Rule) => void;
  onCancel: () => void;
  /**
   * Called when the user wants to create a blank template inline. Must return
   * the canonical name the store accepted (may differ from the requested name
   * on collision); the rule's `templateName` is then set to the returned value.
   */
  onCreateTemplate: (name: string) => string;
}

const HOST_EXAMPLES = ['*.server.com', '127.0.0.1', '/^admin.*/', 'api.example.com'];
const PATH_EXAMPLES = ['/', '/api/**', '/users/*', '/^\\/v2\\/.*$/'];

function blankRule(templates: Templates, host?: string, path?: string): Rule {
  return {
    id: `rule-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    hostPattern: host ?? '',
    pathPattern: path && path.length > 0 ? path : '/',
    templateName: Object.keys(templates)[0] ?? '',
    variables: {},
    active: true,
  };
}

export function RuleEditModal({
  initial,
  initialHost,
  initialPath,
  templates,
  onSave,
  onCancel,
  onCreateTemplate,
}: RuleEditModalProps): JSX.Element {
  const [rule, setRule] = useState<Rule>(() =>
    initial ? structuredClone(initial) : blankRule(templates, initialHost, initialPath),
  );
  // Names of templates created via "+ Create template" this session. Drives
  // the in-modal guidance banner so the user isn't surprised when the empty
  // template renders nothing.
  const [createdHere, setCreatedHere] = useState<string[]>([]);

  const dialogRef = useRef<HTMLDivElement>(null);
  const hostInputRef = useRef<HTMLInputElement>(null);
  useFocusTrap({
    containerRef: dialogRef,
    active: true,
    onEscape: onCancel,
    initialFocusRef: hostInputRef,
  });

  const hostErr = isValidHostPattern(rule.hostPattern) ? null : 'Invalid glob or regex';
  const pathErr = isValidPathPattern(rule.pathPattern)
    ? null
    : rule.pathPattern === ''
      ? 'Path pattern is required'
      : 'Invalid glob or regex';
  const templateErr = rule.templateName ? null : 'Select a template';
  const canSave = !hostErr && !pathErr && !templateErr;

  const templateNames = Object.keys(templates);
  // If the rule points at a template name that isn't present in the templates
  // record yet (storage race on directive-triggered opens, or stale rule
  // pointing at a since-renamed template), surface it as a selectable option
  // so the <select> renders with the right value instead of going blank.
  const selectOptions = templateNames.includes(rule.templateName) || !rule.templateName
    ? templateNames
    : [rule.templateName, ...templateNames];
  const title = initial ? `Edit rule · ${initial.id}` : 'New rule';

  const handleCreateTemplate = (): void => {
    const defaultName = uniqueTemplateName(
      suggestTemplateName(rule.hostPattern),
      templates,
    );
    const raw = window.prompt('New template name', defaultName);
    if (raw === null) return;
    const name = raw.trim();
    if (!name) return;
    if (templates[name] !== undefined) {
      window.alert(`"${name}" already exists — pick a different name.`);
      return;
    }
    const accepted = onCreateTemplate(name);
    setRule({ ...rule, templateName: accepted });
    setCreatedHere((prev) => (prev.includes(accepted) ? prev : [...prev, accepted]));
  };

  const pendingTemplateName = createdHere.includes(rule.templateName)
    ? rule.templateName
    : null;

  const expectedVars = useMemo(
    () => extractTemplateVars(templates[rule.templateName] ?? ''),
    [templates, rule.templateName],
  );

  // Additive: when the active template references vars the rule hasn't
  // declared yet, seed them as empty-value rows so the user can't miss that
  // they need to be filled in. Never removes — existing values are preserved,
  // and extras stay (they may be intentional).
  useEffect(() => {
    const currentKeys = new Set(Object.keys(rule.variables));
    const missing = expectedVars.filter((v) => !currentKeys.has(v));
    if (missing.length === 0) return;
    setRule((r) => ({
      ...r,
      variables: {
        ...r.variables,
        ...Object.fromEntries(missing.map((v) => [v, ''])),
      },
    }));
  }, [expectedVars]);

  const declaredVarKeys = Object.keys(rule.variables);
  const unusedVars = declaredVarKeys.filter((k) => !expectedVars.includes(k));

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
            label={rule.active ? 'Active' : 'Inactive'}
            checked={rule.active}
            onChange={(a) => setRule({ ...rule, active: a })}
          />
        </header>

        <div class="pj-modal-body">
          <div class="pj-field">
            <label for="pj-rule-name">Name <span class="pj-field-hint">(optional)</span></label>
            <input
              id="pj-rule-name"
              type="text"
              value={rule.name ?? ''}
              onInput={(e) => {
                const v = (e.target as HTMLInputElement).value;
                if (v) {
                  setRule({ ...rule, name: v });
                } else {
                  const { name: _drop, ...rest } = rule;
                  void _drop;
                  setRule(rest);
                }
              }}
              placeholder="[qa] PagerDuty incidents"
            />
            <p class="pj-field-hint">
              Human-readable label. Shown on rule cards and in exported bundles.
              Falls back to the host pattern if empty.
            </p>
          </div>
          <PatternField
            label="Host pattern"
            value={rule.hostPattern}
            onChange={(v) => setRule({ ...rule, hostPattern: v })}
            examples={HOST_EXAMPLES}
            placeholder="api.example.com · *.server.com · /regex/"
            hint="Leave empty to match any host. Glob (*, **) or /regex/ between slashes."
            error={hostErr}
            inputRef={hostInputRef}
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
            <div class="pj-template-picker">
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
                  {selectOptions.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              ) : (
                <div class="pj-field-hint pj-template-picker-hint">
                  No templates yet — create one to attach.
                </div>
              )}
              <Button variant="ghost" onClick={handleCreateTemplate}>
                + Create template
              </Button>
            </div>
            {templateErr ? <div class="pj-field-err">{templateErr}</div> : null}
            {pendingTemplateName ? (
              <div class="pj-banner pj-template-pending-banner" role="status">
                <span class="pj-banner-icon" aria-hidden="true">ℹ️</span>
                <span>
                  <strong>"{pendingTemplateName}"</strong> was created as an
                  empty template. Add any variables it needs below, save the
                  rule, then open the <strong>Templates</strong> tab to define
                  its HTML output.
                </span>
              </div>
            ) : null}
          </div>
          <div class="pj-field">
            <label>Variables</label>
            <p class="pj-field-hint">
              Accessible in templates as{' '}
              <code>{'{{ vars.name }}'}</code>.
            </p>
            {expectedVars.length > 0 ? (
              <p class="pj-field-hint pj-vars-referenced">
                Referenced by this template:{' '}
                {expectedVars.map((v, i) => (
                  <span key={v}>
                    {i > 0 ? ', ' : ''}
                    <code>{v}</code>
                  </span>
                ))}
              </p>
            ) : null}
            {unusedVars.length > 0 ? (
              <p class="pj-field-hint pj-vars-unused">
                Not used by this template (safe to remove):{' '}
                {unusedVars.map((v, i) => (
                  <span key={v}>
                    {i > 0 ? ', ' : ''}
                    <code>{v}</code>
                  </span>
                ))}
              </p>
            ) : null}
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
