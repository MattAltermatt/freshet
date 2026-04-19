import type { JSX } from 'preact';
import type { FreshetBundle } from '../../bundle/schema';
import type { SniffHit } from '../../bundle/sniff';

export interface ImportAppendModalProps {
  bundle: FreshetBundle;
  hits: SniffHit[];
  onBack: () => void;
  onCommit: () => void;
}

export function ImportAppendModal(props: ImportAppendModalProps): JSX.Element {
  return (
    <div>
      <h2>Just append: confirm</h2>
      <p>
        This will add {props.bundle.rules.length} rule(s) +{' '}
        {props.bundle.templates.length} template(s) without a review.
      </p>
      <ul>
        <li>Collisions auto-renamed (no replacements)</li>
        <li>Rules added INACTIVE</li>
        <li>Flagged items get a persistent "⚠ needs attention" badge until dismissed</li>
      </ul>
      {props.hits.length > 0 ? (
        <section aria-label="Flags">
          <strong>🚩 Flags that will carry over as badges:</strong>
          <ul>
            {props.hits.map((h) => (
              <li key={h.field + h.patternId}>
                Matched <code>{h.patternRegex}</code> on <code>{h.field}</code>. Matched text:{' '}
                <code>{h.matchedText}</code>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <div class="pj-dialog-footer">
        <button type="button" class="pj-btn" onClick={props.onBack}>
          Back
        </button>
        <button type="button" class="pj-btn" data-variant="primary" onClick={props.onCommit}>
          Append all
        </button>
      </div>
    </div>
  );
}
