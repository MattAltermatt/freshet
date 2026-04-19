import type { JSX } from 'preact';
import { useMemo, useState } from 'preact/hooks';
import type { FreshetBundle } from '../../bundle/schema';
import type { SniffHit } from '../../bundle/sniff';
import { detectCollisions } from '../../bundle/collide';
import type { Rule, Templates } from '../../shared/types';
import type { ImportPlan } from './ImportDialog';
import { RuleIdentity } from '../rules/RuleIdentity';
import { TemplatePill } from '../../ui/components/TemplatePill';

export interface ImportReviewProps {
  bundle: FreshetBundle;
  hits: SniffHit[];
  existingRules: Rule[];
  existingTemplates: Templates;
  onBack: () => void;
  onCommit: (plan: Omit<ImportPlan, 'mode'>) => void;
}

export function ImportReview(props: ImportReviewProps): JSX.Element {
  const report = useMemo(
    () => detectCollisions(props.bundle, props.existingRules, props.existingTemplates),
    [props.bundle, props.existingRules, props.existingTemplates],
  );

  const [query, setQuery] = useState('');
  const [skipRules, setSkipRules] = useState<Set<string>>(new Set());
  const [skipTemplates, setSkipTemplates] = useState<Set<string>>(new Set());
  const [templateResolution, setTemplateResolution] = useState<
    Map<string, 'rename' | 'replace' | 'skip'>
  >(new Map(report.templateCollisions.map((c) => [c.name, 'rename' as const])));
  const [ruleResolution, setRuleResolution] = useState<
    Map<string, 'replace' | 'skip' | 'keepBoth'>
  >(new Map(report.ruleIdCollisions.map((c) => [c.id, 'replace' as const])));
  const [replaceConfirmed, setReplaceConfirmed] = useState<Set<string>>(new Set());

  const renameMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of report.templateCollisions) {
      if (templateResolution.get(c.name) === 'rename') {
        m.set(c.name, c.proposedRename);
      }
    }
    return m;
  }, [report.templateCollisions, templateResolution]);

  function toggleSkipRule(id: string): void {
    setSkipRules((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSkipTemplate(name: string): void {
    setSkipTemplates((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  function handleCommit(): void {
    props.onCommit({
      bundle: props.bundle,
      skipRuleIds: skipRules,
      skipTemplateNames: skipTemplates,
      templateCollisionResolution: templateResolution,
      ruleCollisionResolution: ruleResolution,
      templateRenameMap: renameMap,
    });
  }

  const visibleRules = props.bundle.rules.filter((r) => {
    if (!query) return true;
    const hay = `${r.name ?? ''} ${r.hostPattern} ${r.pathPattern} ${r.templateName}`.toLowerCase();
    return hay.includes(query.toLowerCase());
  });
  const visibleTemplates = props.bundle.templates.filter((t) => {
    if (!query) return true;
    return t.name.toLowerCase().includes(query.toLowerCase());
  });

  const includedCount =
    props.bundle.rules.filter((r) => !skipRules.has(r.id)).length +
    props.bundle.templates.filter((t) => !skipTemplates.has(t.name)).length;

  return (
    <div class="pj-import-review">
      <header class="pj-dialog-header">
        <h2>Review import</h2>
        <p class="pj-dialog-subtitle">
          Uncheck anything you don't want. Resolve any collisions flagged with ⚠ before importing.
        </p>
      </header>

      <div class="pj-review-toolbar">
        <input
          type="search"
          class="pj-picker-filter"
          placeholder="filter by name, host, path, template…"
          value={query}
          onInput={(e) => setQuery((e.target as HTMLInputElement).value)}
        />
      </div>

      <section class="pj-review-section" aria-label="Rules">
        <h3>Rules ({visibleRules.length})</h3>
        {visibleRules.map((r) => {
          const isIdCol = report.ruleIdCollisions.some((c) => c.id === r.id);
          const resolution = ruleResolution.get(r.id);
          const skipped = skipRules.has(r.id);
          const effectiveRule = {
            hostPattern: r.hostPattern,
            pathPattern: r.pathPattern,
            templateName: renameMap.get(r.templateName) ?? r.templateName,
            ...(r.name ? { name: r.name } : {}),
          };
          return (
            <div
              key={r.id}
              class={`pj-review-row${skipped ? ' pj-review-row--skipped' : ''}`}
            >
              <label class="pj-review-row-include" title="Include in import">
                <input
                  type="checkbox"
                  checked={!skipped}
                  onChange={() => toggleSkipRule(r.id)}
                />
              </label>
              <div class="pj-review-row-body">
                <RuleIdentity rule={effectiveRule} density="card" />
                {renameMap.has(r.templateName) ? (
                  <p class="pj-review-rename-note">
                    template reference rewritten from <code>{r.templateName}</code> to{' '}
                    <code>{renameMap.get(r.templateName)}</code>
                  </p>
                ) : null}
                {isIdCol ? (
                  <ConflictBox
                    title="Round-trip collision (same id)"
                    options={[
                      { value: 'replace', label: 'Replace existing' },
                      { value: 'keepBoth', label: 'Keep both (new id)' },
                      { value: 'skip', label: 'Skip' },
                    ]}
                    selected={resolution ?? 'replace'}
                    onSelect={(v) =>
                      setRuleResolution((prev) =>
                        new Map(prev).set(r.id, v as 'replace' | 'skip' | 'keepBoth'),
                      )
                    }
                    confirmRequired={resolution === 'replace'}
                    confirmed={replaceConfirmed.has(r.id)}
                    onToggleConfirm={() =>
                      setReplaceConfirmed((prev) => {
                        const next = new Set(prev);
                        if (next.has(r.id)) next.delete(r.id);
                        else next.add(r.id);
                        return next;
                      })
                    }
                  />
                ) : null}
              </div>
            </div>
          );
        })}
      </section>

      <section class="pj-review-section" aria-label="Templates">
        <h3>Templates ({visibleTemplates.length})</h3>
        {visibleTemplates.map((t) => {
          const col = report.templateCollisions.find((c) => c.name === t.name);
          const res = templateResolution.get(t.name);
          const skipped = skipTemplates.has(t.name);
          const confirmKey = `t:${t.name}`;
          return (
            <div
              key={t.name}
              class={`pj-review-row${skipped ? ' pj-review-row--skipped' : ''}`}
            >
              <label class="pj-review-row-include" title="Include in import">
                <input
                  type="checkbox"
                  checked={!skipped}
                  onChange={() => toggleSkipTemplate(t.name)}
                />
              </label>
              <div class="pj-review-row-body">
                <div class="pj-review-template-row">
                  <TemplatePill name={t.name} />
                  {col ? (
                    <span class="pj-review-rename-preview">
                      →{' '}
                      <TemplatePill
                        name={res === 'rename' ? col.proposedRename : t.name}
                      />
                      {res === 'replace' ? (
                        <span class="pj-review-replace-note"> (replacing existing)</span>
                      ) : null}
                      {res === 'skip' ? (
                        <span class="pj-review-skip-note"> (skipped)</span>
                      ) : null}
                    </span>
                  ) : null}
                </div>
                {col ? (
                  <ConflictBox
                    title="Name already exists"
                    options={[
                      { value: 'rename', label: `Rename to ${col.proposedRename}` },
                      { value: 'replace', label: 'Replace existing' },
                      { value: 'skip', label: 'Skip' },
                    ]}
                    selected={res ?? 'rename'}
                    onSelect={(v) =>
                      setTemplateResolution((prev) =>
                        new Map(prev).set(t.name, v as 'rename' | 'replace' | 'skip'),
                      )
                    }
                    confirmRequired={res === 'replace'}
                    confirmed={replaceConfirmed.has(confirmKey)}
                    onToggleConfirm={() =>
                      setReplaceConfirmed((prev) => {
                        const next = new Set(prev);
                        if (next.has(confirmKey)) next.delete(confirmKey);
                        else next.add(confirmKey);
                        return next;
                      })
                    }
                  />
                ) : null}
              </div>
            </div>
          );
        })}
      </section>

      <footer class="pj-dialog-footer">
        <span class="pj-review-hint">
          {includedCount} item(s) will be imported · rules start <strong>INACTIVE</strong> —
          toggle on after import.
        </span>
        <div class="pj-dialog-footer-actions">
          <button type="button" class="pj-btn" onClick={props.onBack}>
            Back
          </button>
          <button
            type="button"
            class="pj-btn"
            data-variant="primary"
            onClick={handleCommit}
            disabled={includedCount === 0}
          >
            Import
          </button>
        </div>
      </footer>
    </div>
  );
}

interface ConflictBoxProps {
  title: string;
  options: Array<{ value: string; label: string }>;
  selected: string;
  onSelect: (v: string) => void;
  confirmRequired: boolean;
  confirmed: boolean;
  onToggleConfirm: () => void;
}

function ConflictBox(props: ConflictBoxProps): JSX.Element {
  const groupName = `conflict-${Math.random().toString(36).slice(2, 9)}`;
  return (
    <div class="pj-conflict-box" role="group" aria-label={props.title}>
      <div class="pj-conflict-box-head">
        <span class="pj-conflict-box-icon" aria-hidden="true">⚠</span>
        <strong>{props.title}</strong>
      </div>
      <div class="pj-conflict-box-options">
        {props.options.map((opt) => (
          <label key={opt.value} class="pj-conflict-option">
            <input
              type="radio"
              name={groupName}
              checked={props.selected === opt.value}
              onChange={() => props.onSelect(opt.value)}
            />
            <span>{opt.label}</span>
          </label>
        ))}
      </div>
      {props.confirmRequired ? (
        <label class="pj-conflict-confirm">
          <input
            type="checkbox"
            checked={props.confirmed}
            onChange={props.onToggleConfirm}
          />
          Confirm replace (overwrites existing)
        </label>
      ) : null}
    </div>
  );
}
