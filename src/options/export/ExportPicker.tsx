import type { JSX } from 'preact';
import { useMemo, useState } from 'preact/hooks';
import type { Rule } from '../../shared/types';

export interface ExportPickerProps {
  rules: Rule[];
  templates: string[];
  onCancel: () => void;
  onNext: (ruleIds: string[], templateNames: string[]) => void;
}

function ruleMatches(r: Rule, q: string): boolean {
  if (!q) return true;
  const hay = `${r.name ?? ''} ${r.hostPattern} ${r.pathPattern} ${r.templateName}`.toLowerCase();
  return hay.includes(q.toLowerCase());
}

export function ExportPicker(props: ExportPickerProps): JSX.Element {
  const [query, setQuery] = useState('');
  const [pickedRules, setPickedRules] = useState<Set<string>>(new Set());
  const [pickedTemplates, setPickedTemplates] = useState<Set<string>>(new Set());

  const visibleRules = useMemo(
    () => props.rules.filter((r) => ruleMatches(r, query)),
    [props.rules, query],
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

  function handleNext(): void {
    const finalTemplates = new Set<string>([...pickedTemplates, ...autoPulledTemplates]);
    props.onNext(Array.from(pickedRules), Array.from(finalTemplates));
  }

  return (
    <div class="pj-export-picker">
      <h2>Pick what to export</h2>
      <p>Rules that reference a template will pull that template in automatically.</p>
      <input
        type="search"
        placeholder="filter (e.g. [qa])"
        value={query}
        onInput={(e) => setQuery((e.target as HTMLInputElement).value)}
      />

      <section aria-label="Rules">
        <h3>Rules ({visibleRules.length})</h3>
        {visibleRules.map((r) => (
          <label key={r.id}>
            <input
              type="checkbox"
              checked={pickedRules.has(r.id)}
              onChange={() => toggleRule(r.id)}
            />
            {r.name ?? r.hostPattern}
          </label>
        ))}
      </section>

      <section aria-label="Templates">
        <h3>Templates ({props.templates.length})</h3>
        {props.templates.map((n) => {
          const auto = autoPulledTemplates.has(n);
          return (
            <label key={n}>
              <input
                type="checkbox"
                checked={auto || pickedTemplates.has(n)}
                onChange={() => toggleTemplate(n)}
                disabled={auto}
              />
              {n} {auto ? <em>(auto-pulled)</em> : null}
            </label>
          );
        })}
      </section>

      <footer class="pj-dialog-footer">
        <button type="button" class="pj-btn" onClick={props.onCancel}>Cancel</button>
        <button type="button" class="pj-btn" data-variant="primary" onClick={handleNext}>
          Next: Scrub
        </button>
      </footer>
    </div>
  );
}
