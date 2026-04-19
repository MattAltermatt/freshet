import type { JSX } from 'preact';
import { useMemo, useState } from 'preact/hooks';
import type { Rule } from '../../shared/types';
import { TemplatePill } from '../../ui/components/TemplatePill';

export interface ExportPickerProps {
  rules: Rule[];
  templates: string[];
  onCancel: () => void;
  onNext: (ruleIds: string[], templateNames: string[]) => void;
}

type SortKey = 'name' | 'host';

function ruleMatches(r: Rule, q: string): boolean {
  if (!q) return true;
  const hay = `${r.name ?? ''} ${r.hostPattern} ${r.pathPattern} ${r.templateName}`.toLowerCase();
  return hay.includes(q.toLowerCase());
}

function ruleLabel(r: Rule): string {
  return r.name ?? r.hostPattern ?? '(unnamed)';
}

function sortRules(rules: Rule[], key: SortKey): Rule[] {
  const copy = [...rules];
  if (key === 'name') {
    copy.sort((a, b) =>
      ruleLabel(a).localeCompare(ruleLabel(b), undefined, { sensitivity: 'base' }),
    );
  } else {
    copy.sort((a, b) =>
      a.hostPattern.localeCompare(b.hostPattern, undefined, { sensitivity: 'base' }),
    );
  }
  return copy;
}

export function ExportPicker(props: ExportPickerProps): JSX.Element {
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [pickedRules, setPickedRules] = useState<Set<string>>(new Set());
  const [pickedTemplates, setPickedTemplates] = useState<Set<string>>(new Set());

  const sortedRules = useMemo(() => sortRules(props.rules, sortKey), [props.rules, sortKey]);
  const sortedTemplates = useMemo(
    () => [...props.templates].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' })),
    [props.templates],
  );
  const visibleRules = useMemo(
    () => sortedRules.filter((r) => ruleMatches(r, query)),
    [sortedRules, query],
  );
  const visibleTemplates = useMemo(
    () =>
      query
        ? sortedTemplates.filter((n) => n.toLowerCase().includes(query.toLowerCase()))
        : sortedTemplates,
    [sortedTemplates, query],
  );

  const autoPulledTemplates = useMemo(
    () =>
      new Set(
        props.rules
          .filter((r) => pickedRules.has(r.id))
          .map((r) => r.templateName),
      ),
    [props.rules, pickedRules],
  );

  function toggleRule(id: string): void {
    setPickedRules((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleTemplate(name: string): void {
    if (autoPulledTemplates.has(name)) return;
    setPickedTemplates((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  const allVisibleRulesChecked =
    visibleRules.length > 0 && visibleRules.every((r) => pickedRules.has(r.id));
  const allVisibleTemplatesChecked =
    visibleTemplates.length > 0 &&
    visibleTemplates.every(
      (n) => pickedTemplates.has(n) || autoPulledTemplates.has(n),
    );
  const allChecked = allVisibleRulesChecked && allVisibleTemplatesChecked;

  function toggleSelectAll(): void {
    if (allChecked) {
      setPickedRules((prev) => {
        const next = new Set(prev);
        for (const r of visibleRules) next.delete(r.id);
        return next;
      });
      setPickedTemplates((prev) => {
        const next = new Set(prev);
        for (const n of visibleTemplates) next.delete(n);
        return next;
      });
    } else {
      setPickedRules((prev) => {
        const next = new Set(prev);
        for (const r of visibleRules) next.add(r.id);
        return next;
      });
      setPickedTemplates((prev) => {
        const next = new Set(prev);
        for (const n of visibleTemplates) {
          if (!autoPulledTemplates.has(n)) next.add(n);
        }
        return next;
      });
    }
  }

  function handleNext(): void {
    const finalTemplates = new Set<string>([...pickedTemplates, ...autoPulledTemplates]);
    props.onNext(Array.from(pickedRules), Array.from(finalTemplates));
  }

  const selectedCount = pickedRules.size + pickedTemplates.size + autoPulledTemplates.size;

  return (
    <div class="pj-export-picker">
      <header class="pj-dialog-header">
        <h2>Pick what to export</h2>
        <p class="pj-dialog-subtitle">
          Checking a rule automatically pulls in the template it references.
        </p>
      </header>

      <div class="pj-picker-toolbar">
        <input
          type="search"
          class="pj-picker-filter"
          placeholder="filter by name, host, path…"
          value={query}
          onInput={(e) => setQuery((e.target as HTMLInputElement).value)}
        />
        <label class="pj-picker-sort">
          Sort:
          <select
            value={sortKey}
            onChange={(e) => setSortKey((e.target as HTMLSelectElement).value as SortKey)}
          >
            <option value="name">Name</option>
            <option value="host">Host</option>
          </select>
        </label>
        <label class="pj-picker-select-all">
          <input
            type="checkbox"
            checked={allChecked}
            onChange={toggleSelectAll}
            aria-label="Select all visible"
          />
          Select all visible
        </label>
      </div>

      <div class="pj-picker-grid">
        <section class="pj-picker-col" aria-label="Rules">
          <h3>Rules ({visibleRules.length})</h3>
          {visibleRules.length === 0 ? (
            <p class="pj-picker-empty">No rules match.</p>
          ) : (
            <ul class="pj-picker-list">
              {visibleRules.map((r) => (
                <li key={r.id}>
                  <label class="pj-picker-item">
                    <input
                      type="checkbox"
                      checked={pickedRules.has(r.id)}
                      onChange={() => toggleRule(r.id)}
                    />
                    <span class="pj-picker-item-body">
                      <span class="pj-picker-item-name">{ruleLabel(r)}</span>
                      <span class="pj-picker-item-sub">
                        <code>{r.hostPattern || '(any host)'}</code>
                        <span class="pj-rule-sep">·</span>
                        <TemplatePill name={r.templateName} />
                      </span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section class="pj-picker-col" aria-label="Templates">
          <h3>Templates ({visibleTemplates.length})</h3>
          {visibleTemplates.length === 0 ? (
            <p class="pj-picker-empty">No templates match.</p>
          ) : (
            <ul class="pj-picker-list">
              {visibleTemplates.map((n) => {
                const auto = autoPulledTemplates.has(n);
                return (
                  <li key={n}>
                    <label class="pj-picker-item">
                      <input
                        type="checkbox"
                        checked={auto || pickedTemplates.has(n)}
                        onChange={() => toggleTemplate(n)}
                        disabled={auto}
                      />
                      <span class="pj-picker-item-body">
                        <TemplatePill name={n} />
                        {auto ? (
                          <span class="pj-picker-autopull" title="Pulled in by a selected rule">
                            auto-pulled
                          </span>
                        ) : null}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      <footer class="pj-dialog-footer">
        <span class="pj-picker-count" aria-live="polite">
          {selectedCount === 0
            ? 'Nothing selected yet.'
            : `${pickedRules.size} rule(s) + ${pickedTemplates.size + autoPulledTemplates.size} template(s) selected`}
        </span>
        <div class="pj-dialog-footer-actions">
          <button type="button" class="pj-btn" onClick={props.onCancel}>
            Cancel
          </button>
          <button
            type="button"
            class="pj-btn"
            data-variant="primary"
            onClick={handleNext}
            disabled={selectedCount === 0}
          >
            Next: Scrub
          </button>
        </div>
      </footer>
    </div>
  );
}
