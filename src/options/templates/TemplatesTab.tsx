import type { JSX } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { Cheatsheet, useStorage } from '../../ui';
import type { Rule, Templates } from '../../shared/types';
import { TemplatesToolbar } from './TemplatesToolbar';
import { TemplateEditor } from './TemplateEditor';
import { SampleJsonEditor } from './SampleJsonEditor';
import { PreviewIframe } from './PreviewIframe';

export interface TemplatesTabProps {
  templates: Templates;
  onTemplatesChange: (next: Templates) => void;
  rules: Rule[];
  onDisableRules: (ruleIds: string[]) => void;
}

const DEFAULT_SAMPLE = `{
  "id": 1234,
  "email": "matt@example.com",
  "status": "active"
}
`;

function safeParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return {};
  }
}

function collectRuleVars(rules: Rule[], templateName: string | null): string[] {
  if (!templateName) return [];
  const vars = new Set<string>();
  for (const r of rules) {
    if (r.templateName !== templateName) continue;
    for (const k of Object.keys(r.variables)) vars.add(k);
  }
  return [...vars];
}

export function TemplatesTab({
  templates,
  onTemplatesChange,
  rules,
  onDisableRules,
}: TemplatesTabProps): JSX.Element {
  const [samples, writeSamples] = useStorage<'pj_sample_json', Record<string, string>>(
    'pj_sample_json',
    {},
  );
  const [migrated, writeMigrated] = useStorage<'pj_migrated_v2', string[]>(
    'pj_migrated_v2',
    [],
  );

  const templateNames = Object.keys(templates);
  const [current, setCurrent] = useState<string | null>(
    templateNames[0] ?? null,
  );

  // Keep `current` in sync if the underlying list changes (e.g. after delete).
  useEffect(() => {
    if (current !== null && templates[current] === undefined) {
      setCurrent(templateNames[0] ?? null);
    } else if (current === null && templateNames.length > 0) {
      setCurrent(templateNames[0] ?? null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templates]);

  const active = current && templates[current] !== undefined ? current : null;
  const tpl = active ? templates[active] ?? '' : '';
  const sampleText = active ? samples[active] ?? DEFAULT_SAMPLE : DEFAULT_SAMPLE;
  const ruleVars = collectRuleVars(rules, active);
  const isMigrated = active !== null && migrated.includes(active);

  const handleTemplateInput = (next: string): void => {
    if (!active) return;
    onTemplatesChange({ ...templates, [active]: next });
    // Editing dismisses the migration banner for that template.
    if (isMigrated) {
      void writeMigrated(migrated.filter((n) => n !== active));
    }
  };

  const handleSampleInput = (next: string): void => {
    if (!active) return;
    void writeSamples({ ...samples, [active]: next });
  };

  const dismissBanner = (): void => {
    if (!active) return;
    void writeMigrated(migrated.filter((n) => n !== active));
  };

  return (
    <div class="pj-templates-tab">
      <TemplatesToolbar
        templates={templates}
        current={active}
        rules={rules}
        onSelect={(name) => setCurrent(name || null)}
        onChange={onTemplatesChange}
        onDisableRules={onDisableRules}
      />
      {active === null ? (
        <div class="pj-empty">
          <p>No template selected.</p>
          <p class="pj-empty-hint">
            Click <strong>+ New</strong> above to create one.
          </p>
        </div>
      ) : (
        <>
          {isMigrated ? (
            <div class="pj-banner" role="status">
              <span class="pj-banner-icon" aria-hidden="true">🔁</span>
              <span>
                This template was auto-migrated to Liquid syntax. Review it, then
                dismiss — or just save (even without edits).
              </span>
              <button type="button" class="pj-banner-dismiss" onClick={dismissBanner}>
                Dismiss
              </button>
            </div>
          ) : null}
          <p class="pj-flow-caption" aria-label="Data flow">
            <span class="pj-flow-token pj-flow-input">Template</span>
            <span class="pj-flow-op" aria-hidden="true">＋</span>
            <span class="pj-flow-token pj-flow-input">Sample JSON</span>
            <span class="pj-flow-op" aria-hidden="true">→</span>
            <span class="pj-flow-token pj-flow-output">Preview</span>
          </p>
          <div class="pj-templates-body">
            <section class="pj-templates-editor">
              <div class="pj-templates-label">
                <span class="pj-templates-label-title">
                  <span class="pj-role-pill pj-role-pill--input">INPUT</span>
                  Template
                </span>
                <span class="pj-templates-label-hint">
                  Liquid syntax — tap <code>{'{{'}</code> or <code>{'{%'}</code> for autocomplete
                </span>
              </div>
              <TemplateEditor
                value={tpl}
                onChange={handleTemplateInput}
                sampleJson={safeParse(sampleText)}
                ruleVars={ruleVars}
              />
              <Cheatsheet />
            </section>
            <section class="pj-templates-side">
              <div class="pj-templates-side-block">
                <div class="pj-templates-label">
                  <span class="pj-templates-label-title">
                    <span class="pj-role-pill pj-role-pill--input">INPUT</span>
                    Sample JSON
                  </span>
                  <span class="pj-templates-label-hint">
                    Saved per template. Powers preview + autocomplete.
                  </span>
                </div>
                <SampleJsonEditor value={sampleText} onChange={handleSampleInput} />
              </div>
              <div class="pj-templates-side-block pj-templates-preview-block">
                <div class="pj-templates-label">
                  <span class="pj-templates-label-title">
                    <span class="pj-role-pill pj-role-pill--output">OUTPUT</span>
                    Preview
                  </span>
                  <span class="pj-templates-label-hint">
                    Sandboxed iframe, re-rendered 250 ms after you stop typing.
                  </span>
                </div>
                <PreviewIframe
                  template={tpl}
                  sampleJsonText={sampleText}
                  vars={{}}
                />
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  );
}
