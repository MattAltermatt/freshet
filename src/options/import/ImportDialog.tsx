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
      <div class="pj-modal pj-modal--import">
        {step === 'input' ? (
          <ImportInput onCancel={props.onClose} onParsed={handleParsed} />
        ) : null}
        {step === 'mode' && bundle ? (
          <div class="pj-import-mode">
            <header class="pj-dialog-header">
              <h2>Ready to review</h2>
              <p class="pj-dialog-subtitle">
                Bundle from{' '}
                <strong>{bundle.exportedBy ?? '(unlabeled)'}</strong>, exported{' '}
                {bundle.exportedAt.slice(0, 10)}. Contains{' '}
                <strong>{bundle.rules.length}</strong> rule(s) +{' '}
                <strong>{bundle.templates.length}</strong> template(s).
              </p>
            </header>

            {hits.length > 0 ? (
              <aside class="pj-warn-banner" role="note">
                <span class="pj-warn-banner-icon" aria-hidden="true">⚠</span>
                <span>
                  <strong>{hits.length} secret-sniff flag{hits.length === 1 ? '' : 's'}.</strong>{' '}
                  Review the details below, then choose a mode.
                </span>
              </aside>
            ) : null}

            {hits.length > 0 ? (
              <section class="pj-import-mode-flags" aria-label="Flags">
                <ul>
                  {hits.map((h) => (
                    <li key={h.field + h.patternId}>
                      🚩 Matched <code>{h.patternRegex}</code> on <code>{h.field}</code>.
                      Matched text: <code>{h.matchedText}</code>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            <footer class="pj-dialog-footer">
              <span class="pj-import-mode-hint">
                <strong>Review & pick</strong> lets you inspect each item and resolve collisions.{' '}
                <strong>Just append</strong> auto-renames collisions and imports everything at once.
              </span>
              <div class="pj-dialog-footer-actions">
                <button type="button" class="pj-btn" onClick={() => setStep('append')}>
                  Just append all
                </button>
                <button
                  type="button"
                  class="pj-btn"
                  data-variant="primary"
                  onClick={() => setStep('review')}
                >
                  Review &amp; pick
                </button>
              </div>
            </footer>
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
