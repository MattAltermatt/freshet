import type { JSX } from 'preact';
import { useMemo } from 'preact/hooks';
import type { Rule } from '../../shared/types';
import { sniff, type SniffHit } from '../../bundle/sniff';
import type { FreshetBundle } from '../../bundle/schema';
import { TemplatePill } from '../../ui/components/TemplatePill';

export interface ExportScrubProps {
  rules: Rule[];
  templateNames: string[];
  sampleJson: Record<string, string>;
  stripSampleJson: Set<string>;
  stripVariables: Set<string>;
  onToggleStripSampleJson: (name: string) => void;
  onToggleStripVariables: (ruleId: string) => void;
  bundle: FreshetBundle;
  onBack: () => void;
  onDone: () => void;
}

/**
 * Groups sniff hits with the same pattern applied to the same "leaf" name
 * (e.g. 5× `author` matches across `timeline[0..4].author` collapse into a
 * single row with a count). The full field paths are preserved in `paths` so
 * the UI can expand on demand.
 */
interface GroupedHit {
  patternId: string;
  patternRegex: string;
  matchedText: string;
  paths: string[];
  scope: 'rule' | 'template';
  scopeIndex: number;
}

function leafName(field: string): string {
  const m = field.match(/([^.[\]]+)(?:\[[^\]]*\])?$/);
  return m ? m[1]! : field;
}

function groupHits(hits: SniffHit[]): GroupedHit[] {
  const byKey = new Map<string, GroupedHit>();
  for (const h of hits) {
    const ruleMatch = h.field.match(/^rules\[(\d+)\]/);
    const tmplMatch = h.field.match(/^templates\[(\d+)\]/);
    const scope: 'rule' | 'template' = ruleMatch ? 'rule' : 'template';
    const scopeIndex = Number((ruleMatch ?? tmplMatch)?.[1] ?? -1);
    const leaf = leafName(h.field);
    const key = `${scope}|${scopeIndex}|${h.patternId}|${leaf}|${h.matchedText}`;
    const existing = byKey.get(key);
    if (existing) {
      existing.paths.push(h.field);
    } else {
      byKey.set(key, {
        patternId: h.patternId,
        patternRegex: h.patternRegex,
        matchedText: h.matchedText,
        paths: [h.field],
        scope,
        scopeIndex,
      });
    }
  }
  return Array.from(byKey.values());
}

function FlagRow({ g }: { g: GroupedHit }): JSX.Element {
  const count = g.paths.length;
  const firstPath = g.paths[0]!;
  const leaf = leafName(firstPath);
  return (
    <details class="pj-sniff-flag">
      <summary>
        <span class="pj-sniff-flag-icon" aria-hidden="true">🚩</span>
        <span class="pj-sniff-flag-summary">
          <code>{leaf}</code>
          {count > 1 ? <span class="pj-sniff-flag-count">×{count}</span> : null}
          <span class="pj-sniff-flag-match">matched <code>{g.patternRegex}</code></span>
          <span class="pj-sniff-flag-text">
            value: <code>{g.matchedText}</code>
          </span>
        </span>
      </summary>
      <ul class="pj-sniff-flag-paths">
        {g.paths.map((p) => (
          <li key={p}>
            <code>{p}</code>
          </li>
        ))}
      </ul>
    </details>
  );
}

function filename(): string {
  const d = new Date().toISOString().slice(0, 10);
  return `freshet-export-${d}.freshet.json`;
}

export function ExportScrub(props: ExportScrubProps): JSX.Element {
  const hits = useMemo(() => sniff(props.bundle), [props.bundle]);
  const grouped = useMemo(() => groupHits(hits), [hits]);
  const json = useMemo(() => JSON.stringify(props.bundle, null, 2), [props.bundle]);
  const byteSize = useMemo(() => new Blob([json]).size, [json]);

  function ruleHits(i: number): GroupedHit[] {
    return grouped.filter((g) => g.scope === 'rule' && g.scopeIndex === i);
  }
  function templateHits(i: number): GroupedHit[] {
    return grouped.filter((g) => g.scope === 'template' && g.scopeIndex === i);
  }

  function handleDownload(): void {
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename();
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function handleCopy(): Promise<void> {
    await navigator.clipboard.writeText(json);
  }

  return (
    <div class="pj-export-scrub">
      <header class="pj-dialog-header">
        <h2>Scrub before share</h2>
      </header>

      <div class="pj-dialog-scroll">
      <aside class="pj-warn-banner" role="note">
        <span class="pj-warn-banner-icon" aria-hidden="true">⚠</span>
        <span>
          <strong>Once shared, this bundle can't be un-shared.</strong>{' '}
          Inspect every 🚩 flag below and decide what to include before you download or copy.
        </span>
      </aside>

      <section class="pj-scrub-section" aria-label="Rules">
        <h3>Rules ({props.rules.length})</h3>
        {props.rules.map((r, i) => {
          const rh = ruleHits(i);
          const hasVars = Object.keys(r.variables).length > 0;
          return (
            <div key={r.id} class="pj-scrub-row">
              <div class="pj-scrub-row-head">
                <span class="pj-scrub-row-title">
                  <strong>{r.name ?? r.hostPattern ?? '(unnamed rule)'}</strong>
                  <TemplatePill name={r.templateName} />
                </span>
                {hasVars ? (
                  <label class="pj-scrub-toggle">
                    <input
                      type="checkbox"
                      aria-label={`Strip variables for ${r.id}`}
                      checked={props.stripVariables.has(r.id)}
                      onChange={() => props.onToggleStripVariables(r.id)}
                    />
                    Strip variables ({Object.keys(r.variables).length})
                  </label>
                ) : null}
              </div>
              {rh.length > 0 ? (
                <div class="pj-scrub-flags">
                  {rh.map((g, k) => <FlagRow key={g.patternId + k} g={g} />)}
                </div>
              ) : null}
            </div>
          );
        })}
      </section>

      <section class="pj-scrub-section" aria-label="Templates">
        <h3>Templates ({props.templateNames.length})</h3>
        {props.templateNames.map((n, i) => {
          const th = templateHits(i);
          const hasSample = props.sampleJson[n] !== undefined;
          const sampleSize = hasSample ? new Blob([props.sampleJson[n]!]).size : 0;
          return (
            <div key={n} class="pj-scrub-row">
              <div class="pj-scrub-row-head">
                <span class="pj-scrub-row-title">
                  <TemplatePill name={n} />
                </span>
                {hasSample ? (
                  <label class="pj-scrub-toggle">
                    <input
                      type="checkbox"
                      aria-label={`Strip sample JSON for ${n}`}
                      checked={props.stripSampleJson.has(n)}
                      onChange={() => props.onToggleStripSampleJson(n)}
                    />
                    Strip sample JSON ({sampleSize} B)
                  </label>
                ) : null}
              </div>
              {th.length > 0 ? (
                <div class="pj-scrub-flags">
                  {th.map((g, k) => <FlagRow key={g.patternId + k} g={g} />)}
                </div>
              ) : null}
            </div>
          );
        })}
      </section>
      </div>

      <footer class="pj-dialog-footer">
        <span class="pj-scrub-size" aria-live="polite">
          Bundle: {props.bundle.rules.length} rule(s), {props.bundle.templates.length}{' '}
          template(s) · {byteSize} B · {grouped.length} flag(s)
        </span>
        <div class="pj-dialog-footer-actions">
          <button type="button" class="pj-btn" onClick={props.onBack}>
            Back
          </button>
          <button type="button" class="pj-btn" onClick={() => void handleCopy()}>
            Copy JSON
          </button>
          <button type="button" class="pj-btn" data-variant="primary" onClick={handleDownload}>
            ⬇ Download
          </button>
          <button type="button" class="pj-btn" onClick={props.onDone}>
            Done
          </button>
        </div>
      </footer>
    </div>
  );
}
