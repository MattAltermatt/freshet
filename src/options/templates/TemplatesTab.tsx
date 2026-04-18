import type { JSX } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { Cheatsheet, useAutosave, useStorage } from '../../ui';
import type { Rule, Templates } from '../../shared/types';
import { TemplatesToolbar } from './TemplatesToolbar';
import { TemplateEditor } from './TemplateEditor';
import { SampleJsonEditor } from './SampleJsonEditor';
import { PreviewIframe } from './PreviewIframe';
import type { OptionsDirective } from '../directives';

export interface TemplatesTabProps {
  templates: Templates;
  onTemplatesChange: (next: Templates) => void;
  rules: Rule[];
  onDisableRules: (ruleIds: string[]) => void;
  directive?: OptionsDirective | null;
  onDirectiveHandled?: () => void;
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

interface CollapseState {
  editor: boolean;
  sample: boolean;
  preview: boolean;
}

const DEFAULT_COLLAPSE: CollapseState = { editor: false, sample: false, preview: false };

const PLAYGROUND_URL = 'https://liquidjs.com/playground.html';

// Matches the LiquidJS playground's hash format — base64-of-UTF-8 for
// template, then a comma, then base64-of-UTF-8 for context. Reverse-engineered
// from https://liquidjs.com/js/main.js (utoa + parseArgs).
function utf8ToBase64(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let bin = '';
  for (const byte of bytes) bin += String.fromCharCode(byte);
  return btoa(bin);
}
function playgroundUrl(template: string, context: string): string {
  return `${PLAYGROUND_URL}#${utf8ToBase64(template)},${utf8ToBase64(context)}`;
}

export function TemplatesTab({
  templates,
  onTemplatesChange,
  rules,
  onDisableRules,
  directive,
  onDirectiveHandled,
}: TemplatesTabProps): JSX.Element {
  const [samples, writeSamples] = useStorage<'pj_sample_json', Record<string, string>>(
    'pj_sample_json',
    {},
  );
  const [migrated, writeMigrated] = useStorage<'pj_migrated_v2', string[]>(
    'pj_migrated_v2',
    [],
  );
  const [collapse, writeCollapse] = useStorage<'pj_ui_collapse', CollapseState>(
    'pj_ui_collapse',
    DEFAULT_COLLAPSE,
  );
  const toggleCollapse = (key: keyof CollapseState): void => {
    void writeCollapse({ ...collapse, [key]: !collapse[key] });
  };

  const templateNames = Object.keys(templates);
  const [current, setCurrent] = useState<string | null>(
    templateNames[0] ?? null,
  );

  // Keep `current` in sync if the underlying list changes (e.g. after delete)
  // or if the user switches to a template that was just removed.
  useEffect(() => {
    if (current !== null && templates[current] === undefined) {
      setCurrent(templateNames[0] ?? null);
    } else if (current === null && templateNames.length > 0) {
      setCurrent(templateNames[0] ?? null);
    }
  }, [templates, current, templateNames]);

  useEffect(() => {
    if (!directive || directive.kind !== 'edit-template') return;
    // Defer until the template exists in storage — if the caller just created
    // it, a write may still be in flight and `templates` won't have it yet.
    if (templates[directive.name] === undefined) return;
    setCurrent(directive.name);
    onDirectiveHandled?.();
  }, [directive, templates]);

  const active = current && templates[current] !== undefined ? current : null;
  const tpl = active ? templates[active] ?? '' : '';
  const sampleText = active ? samples[active] ?? DEFAULT_SAMPLE : DEFAULT_SAMPLE;
  const ruleVars = collectRuleVars(rules, active);
  const isMigrated = active !== null && migrated.includes(active);

  // Debounced Saved ✓ toast for template body edits. Writes to storage are
  // immediate (above); this hook just confirms the commit visually 600 ms
  // after the user stops typing. We key on the body text only (not the
  // template name) so that switching templates doesn't trigger a spurious
  // toast — only real edits fire it. First render is skipped by useAutosave.
  useAutosave(tpl, async () => {}, { delayMs: 600 });

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
            <section class="pj-templates-col" data-area="template" data-collapsed={collapse.editor}>
              <button
                type="button"
                class="pj-templates-label pj-disclosure"
                aria-expanded={!collapse.editor}
                onClick={() => toggleCollapse('editor')}
              >
                <span class="pj-disclosure-arrow" aria-hidden="true">
                  {collapse.editor ? '▸' : '▾'}
                </span>
                <span class="pj-templates-label-title">
                  <span class="pj-role-pill pj-role-pill--input">INPUT</span>
                  Template
                </span>
                <span class="pj-templates-label-hint">
                  Liquid — tap <code>{'{{'}</code> or <code>{'{%'}</code> for autocomplete
                </span>
              </button>
              {!collapse.editor ? (
                <>
                  <TemplateEditor
                    value={tpl}
                    onChange={handleTemplateInput}
                    sampleJson={safeParse(sampleText)}
                    ruleVars={ruleVars}
                    minHeight="0"
                  />
                  <p class="pj-playground-links" aria-label="LiquidJS playground links">
                    <a
                      href={PLAYGROUND_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Open LiquidJS playground
                      <span class="pj-ext-arrow" aria-hidden="true">↗</span>
                    </a>
                    <a
                      href={playgroundUrl(tpl, sampleText)}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Pre-fills the playground with the current Template + Sample JSON"
                    >
                      Open with current values
                      <span class="pj-ext-arrow" aria-hidden="true">↗</span>
                    </a>
                  </p>
                </>
              ) : null}
            </section>
            <section class="pj-templates-col" data-area="sample" data-collapsed={collapse.sample}>
              <button
                type="button"
                class="pj-templates-label pj-disclosure"
                aria-expanded={!collapse.sample}
                onClick={() => toggleCollapse('sample')}
              >
                <span class="pj-disclosure-arrow" aria-hidden="true">
                  {collapse.sample ? '▸' : '▾'}
                </span>
                <span class="pj-templates-label-title">
                  <span class="pj-role-pill pj-role-pill--input">INPUT</span>
                  Sample JSON
                </span>
                <span class="pj-templates-label-hint">
                  Saved per template. Powers preview + autocomplete.
                </span>
              </button>
              {!collapse.sample ? (
                <SampleJsonEditor value={sampleText} onChange={handleSampleInput} minHeight="0" />
              ) : null}
            </section>
            <section class="pj-templates-col" data-area="preview" data-collapsed={collapse.preview}>
              <button
                type="button"
                class="pj-templates-label pj-disclosure"
                aria-expanded={!collapse.preview}
                onClick={() => toggleCollapse('preview')}
              >
                <span class="pj-disclosure-arrow" aria-hidden="true">
                  {collapse.preview ? '▸' : '▾'}
                </span>
                <span class="pj-templates-label-title">
                  <span class="pj-role-pill pj-role-pill--output">OUTPUT</span>
                  Preview
                </span>
                <span class="pj-templates-label-hint">
                  Sandboxed iframe, re-rendered 250 ms after you stop typing.
                </span>
              </button>
              {!collapse.preview ? (
                <PreviewIframe
                  template={tpl}
                  sampleJsonText={sampleText}
                  vars={{}}
                />
              ) : null}
            </section>
          </div>
          <Cheatsheet />
        </>
      )}
    </div>
  );
}
