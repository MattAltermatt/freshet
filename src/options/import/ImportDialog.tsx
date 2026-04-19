import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import type { FreshetBundle } from '../../bundle/schema';
import type { Rule, Templates } from '../../shared/types';
import { ImportInput } from './ImportInput';
import { ImportReview } from './ImportReview';
import { ImportAppendModal } from './ImportAppendModal';
import { sniff, type SniffHit } from '../../bundle/sniff';

export interface ImportPlan {
  bundle: FreshetBundle;
  mode: 'review' | 'append';
  skipRuleIds: Set<string>;
  skipTemplateNames: Set<string>;
  templateCollisionResolution: Map<string, 'rename' | 'replace' | 'skip'>;
  ruleCollisionResolution: Map<string, 'replace' | 'skip' | 'keepBoth'>;
  templateRenameMap: Map<string, string>;
}

export interface ImportDialogProps {
  existingRules: Rule[];
  existingTemplates: Templates;
  onCommit: (plan: ImportPlan) => Promise<void>;
  onClose: () => void;
}

type Step = 'input' | 'mode' | 'review' | 'append';

export function ImportDialog(props: ImportDialogProps): JSX.Element {
  const [step, setStep] = useState<Step>('input');
  const [bundle, setBundle] = useState<FreshetBundle | null>(null);
  const [hits, setHits] = useState<SniffHit[]>([]);

  function handleParsed(b: FreshetBundle): void {
    setBundle(b);
    setHits(sniff(b));
    setStep('mode');
  }

  return (
    <div class="pj-modal-backdrop" role="dialog" aria-modal="true">
      <div class="pj-modal">
        {step === 'input' ? (
          <ImportInput onCancel={props.onClose} onParsed={handleParsed} />
        ) : null}
        {step === 'mode' && bundle ? (
          <div>
            <h2>Ready to review</h2>
            <p>
              Bundle from: <strong>{bundle.exportedBy ?? '(unlabeled)'}</strong>, exported{' '}
              {bundle.exportedAt}
            </p>
            <p>
              Contains {bundle.rules.length} rule(s) + {bundle.templates.length} template(s).
            </p>
            {hits.length > 0 ? (
              <section aria-label="Flags">
                <strong>🚩 Secret-sniff flags ({hits.length}):</strong>
                <ul>
                  {hits.map((h) => (
                    <li key={h.field + h.patternId}>
                      Matched <code>{h.patternRegex}</code> on <code>{h.field}</code>.
                      Matched text: <code>{h.matchedText}</code>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
            <div class="pj-dialog-footer">
              <button
                type="button"
                class="pj-btn"
                data-variant="primary"
                onClick={() => setStep('review')}
              >
                Review & pick
              </button>
              <button type="button" class="pj-btn" onClick={() => setStep('append')}>
                Just append all
              </button>
            </div>
          </div>
        ) : null}
        {step === 'review' && bundle ? (
          <ImportReview
            bundle={bundle}
            hits={hits}
            existingRules={props.existingRules}
            existingTemplates={props.existingTemplates}
            onBack={() => setStep('mode')}
            onCommit={(plan) => {
              void props.onCommit({ ...plan, mode: 'review' });
            }}
          />
        ) : null}
        {step === 'append' && bundle ? (
          <ImportAppendModal
            bundle={bundle}
            hits={hits}
            onBack={() => setStep('mode')}
            onCommit={() => {
              void props.onCommit({
                bundle,
                mode: 'append',
                skipRuleIds: new Set(),
                skipTemplateNames: new Set(),
                templateCollisionResolution: new Map(),
                ruleCollisionResolution: new Map(),
                templateRenameMap: new Map(),
              });
            }}
          />
        ) : null}
      </div>
    </div>
  );
}
