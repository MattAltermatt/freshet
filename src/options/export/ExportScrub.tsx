import type { JSX } from 'preact';
import { useMemo } from 'preact/hooks';
import type { Rule } from '../../shared/types';
import { sniff, type SniffHit } from '../../bundle/sniff';
import type { FreshetBundle } from '../../bundle/schema';

export interface ExportScrubProps {
  rules: Rule[];
  templateNames: string[];
  sampleJson: Record<string, string>;
  stripSampleJson: Set<string>;
  stripVariables: Set<string>;
  onToggleStripSampleJson: (name: string) => void;
  onToggleStripVariables: (ruleId: string) => void;
  onBack: () => void;
  onNext: () => void;
}

function buildPreviewBundle(props: ExportScrubProps): FreshetBundle {
  return {
    bundleSchemaVersion: 1,
    exportedAt: '',
    appVersion: '',
    templates: props.templateNames.map((n) => ({
      name: n,
      source: '',
      ...(props.stripSampleJson.has(n) || props.sampleJson[n] === undefined
        ? {}
        : { sampleJson: props.sampleJson[n]! }),
    })),
    rules: props.rules.map((r) => ({
      id: r.id,
      hostPattern: r.hostPattern,
      pathPattern: r.pathPattern,
      templateName: r.templateName,
      active: r.active,
      ...(r.name ? { name: r.name } : {}),
      ...(props.stripVariables.has(r.id) ? {} : { variables: r.variables }),
    })),
  };
}

function hitsForRule(hits: SniffHit[], ruleIdx: number): SniffHit[] {
  return hits.filter((h) => h.field.startsWith(`rules[${ruleIdx}].`));
}

function hitsForTemplate(hits: SniffHit[], tmplIdx: number): SniffHit[] {
  return hits.filter((h) => h.field.startsWith(`templates[${tmplIdx}].`));
}

export function ExportScrub(props: ExportScrubProps): JSX.Element {
  const hits = useMemo(() => sniff(buildPreviewBundle(props)), [props]);

  return (
    <div class="pj-export-scrub">
      <h2>Scrub before share</h2>
      <p class="pj-warn">⚠ Once shared, assume this can't be un-shared.</p>

      <section aria-label="Rules">
        <h3>Rules</h3>
        {props.rules.map((r, i) => {
          const rh = hitsForRule(hits, i);
          return (
            <div key={r.id} class="pj-scrub-row">
              <div>
                <strong>{r.name ?? r.hostPattern}</strong>
                {Object.keys(r.variables).length > 0 ? (
                  <label>
                    <input
                      type="checkbox"
                      aria-label={`Strip variables for ${r.id}`}
                      checked={props.stripVariables.has(r.id)}
                      onChange={() => props.onToggleStripVariables(r.id)}
                    />
                    Strip variables
                  </label>
                ) : null}
              </div>
              {rh.map((h) => (
                <div class="pj-sniff-flag" key={h.field + h.patternId}>
                  🚩 Matched <code>{h.patternRegex}</code> on <code>{h.field}</code>.
                  Matched text: <code>{h.matchedText}</code>
                </div>
              ))}
            </div>
          );
        })}
      </section>

      <section aria-label="Templates">
        <h3>Templates</h3>
        {props.templateNames.map((n, i) => {
          const th = hitsForTemplate(hits, i);
          const hasSample = props.sampleJson[n] !== undefined;
          return (
            <div key={n} class="pj-scrub-row">
              <div>
                <strong>{n}</strong>
                {hasSample ? (
                  <label>
                    <input
                      type="checkbox"
                      aria-label={`Strip sample JSON for ${n}`}
                      checked={props.stripSampleJson.has(n)}
                      onChange={() => props.onToggleStripSampleJson(n)}
                    />
                    Strip sample JSON
                  </label>
                ) : null}
              </div>
              {th.map((h) => (
                <div class="pj-sniff-flag" key={h.field + h.patternId}>
                  🚩 Matched <code>{h.patternRegex}</code> on <code>{h.field}</code>.
                  Matched text: <code>{h.matchedText}</code>
                </div>
              ))}
            </div>
          );
        })}
      </section>

      <footer class="pj-dialog-footer">
        <button type="button" class="pj-btn" onClick={props.onBack}>Back</button>
        <button type="button" class="pj-btn" data-variant="primary" onClick={props.onNext}>
          Next: Output
        </button>
      </footer>
    </div>
  );
}
