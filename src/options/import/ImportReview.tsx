import type { JSX } from 'preact';
import { useMemo, useState } from 'preact/hooks';
import type { FreshetBundle } from '../../bundle/schema';
import type { SniffHit } from '../../bundle/sniff';
import { detectCollisions } from '../../bundle/collide';
import type { Rule, Templates } from '../../shared/types';
import type { ImportPlan } from './ImportDialog';

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
    const hay = `${r.name ?? ''} ${r.hostPattern} ${r.pathPattern}`.toLowerCase();
    return hay.includes(query.toLowerCase());
  });

  return (
    <div class="pj-import-review">
      <h2>Review import</h2>
      <input
        type="search"
        placeholder="filter"
        value={query}
        onInput={(e) => setQuery((e.target as HTMLInputElement).value)}
      />

      <section aria-label="Rules">
        <h3>Rules ({visibleRules.length})</h3>
        {visibleRules.map((r) => {
          const isIdCol = report.ruleIdCollisions.some((c) => c.id === r.id);
          const resolution = ruleResolution.get(r.id);
          const needsReplaceConfirm = resolution === 'replace';
          return (
            <div key={r.id} class="pj-review-row">
              <label>
                <input
                  type="checkbox"
                  checked={!skipRules.has(r.id)}
                  onChange={() => toggleSkipRule(r.id)}
                />
                {r.name ?? r.hostPattern}
              </label>
              {renameMap.has(r.templateName) ? (
                <div class="pj-rename-cascade">
                  → template: {r.templateName} → {renameMap.get(r.templateName)}
                </div>
              ) : null}
              {isIdCol ? (
                <div class="pj-collision">
                  <strong>⚠ Round-trip collision (same id).</strong>
                  <label>
                    <input
                      type="radio"
                      name={`rule-res-${r.id}`}
                      checked={resolution === 'replace'}
                      onChange={() =>
                        setRuleResolution((prev) => new Map(prev).set(r.id, 'replace'))
                      }
                    />
                    Replace existing
                  </label>
                  {needsReplaceConfirm ? (
                    <label>
                      <input
                        type="checkbox"
                        checked={replaceConfirmed.has(r.id)}
                        onChange={() =>
                          setReplaceConfirmed((prev) => {
                            const next = new Set(prev);
                            if (next.has(r.id)) next.delete(r.id);
                            else next.add(r.id);
                            return next;
                          })
                        }
                      />
                      Confirm replace
                    </label>
                  ) : null}
                  <label>
                    <input
                      type="radio"
                      name={`rule-res-${r.id}`}
                      checked={resolution === 'skip'}
                      onChange={() =>
                        setRuleResolution((prev) => new Map(prev).set(r.id, 'skip'))
                      }
                    />
                    Skip
                  </label>
                  <label>
                    <input
                      type="radio"
                      name={`rule-res-${r.id}`}
                      checked={resolution === 'keepBoth'}
                      onChange={() =>
                        setRuleResolution((prev) => new Map(prev).set(r.id, 'keepBoth'))
                      }
                    />
                    Keep both
                  </label>
                </div>
              ) : null}
            </div>
          );
        })}
      </section>

      <section aria-label="Templates">
        <h3>Templates ({props.bundle.templates.length})</h3>
        {props.bundle.templates.map((t) => {
          const col = report.templateCollisions.find((c) => c.name === t.name);
          const res = templateResolution.get(t.name);
          return (
            <div key={t.name} class="pj-review-row">
              <label>
                <input
                  type="checkbox"
                  checked={!skipTemplates.has(t.name)}
                  onChange={() => toggleSkipTemplate(t.name)}
                />
                {t.name}
              </label>
              {col ? (
                <div class="pj-collision">
                  <strong>⚠ Name already exists.</strong>
                  <label>
                    <input
                      type="radio"
                      name={`tmpl-res-${t.name}`}
                      checked={res === 'rename'}
                      onChange={() =>
                        setTemplateResolution((prev) =>
                          new Map(prev).set(t.name, 'rename'),
                        )
                      }
                    />
                    Rename to {col.proposedRename}
                  </label>
                  <label>
                    <input
                      type="radio"
                      name={`tmpl-res-${t.name}`}
                      checked={res === 'replace'}
                      onChange={() =>
                        setTemplateResolution((prev) =>
                          new Map(prev).set(t.name, 'replace'),
                        )
                      }
                    />
                    Replace existing
                  </label>
                  {res === 'replace' ? (
                    <label>
                      <input
                        type="checkbox"
                        checked={replaceConfirmed.has(`t:${t.name}`)}
                        onChange={() =>
                          setReplaceConfirmed((prev) => {
                            const next = new Set(prev);
                            const key = `t:${t.name}`;
                            if (next.has(key)) next.delete(key);
                            else next.add(key);
                            return next;
                          })
                        }
                      />
                      Confirm replace
                    </label>
                  ) : null}
                  <label>
                    <input
                      type="radio"
                      name={`tmpl-res-${t.name}`}
                      checked={res === 'skip'}
                      onChange={() =>
                        setTemplateResolution((prev) =>
                          new Map(prev).set(t.name, 'skip'),
                        )
                      }
                    />
                    Skip
                  </label>
                </div>
              ) : null}
            </div>
          );
        })}
      </section>

      <p class="pj-note">
        Imported rules start <strong>INACTIVE</strong> — toggle on per rule after import.
      </p>

      <div class="pj-dialog-footer">
        <button type="button" class="pj-btn" onClick={props.onBack}>
          Back
        </button>
        <button type="button" class="pj-btn" data-variant="primary" onClick={handleCommit}>
          Import
        </button>
      </div>
    </div>
  );
}
