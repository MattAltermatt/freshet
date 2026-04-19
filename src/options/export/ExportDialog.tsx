import type { JSX } from 'preact';
import { useMemo, useState } from 'preact/hooks';
import type { Rule, Templates } from '../../shared/types';
import { ExportPicker } from './ExportPicker';
import { ExportScrub } from './ExportScrub';
import { buildBundle } from '../../bundle/serialize';

export interface ExportDialogProps {
  rules: Rule[];
  templates: Templates;
  sampleJson: Record<string, string>;
  appVersion: string;
  onClose: () => void;
}

type Step = 'pick' | 'scrub';

export function ExportDialog(props: ExportDialogProps): JSX.Element {
  const [step, setStep] = useState<Step>('pick');
  const [selectedRuleIds, setSelectedRuleIds] = useState<string[]>([]);
  const [selectedTemplateNames, setSelectedTemplateNames] = useState<string[]>([]);
  const [stripSampleJson, setStripSampleJson] = useState<Set<string>>(new Set());
  const [stripVariables, setStripVariables] = useState<Set<string>>(new Set());

  function goToScrub(ruleIds: string[], templateNames: string[]): void {
    setSelectedRuleIds(ruleIds);
    setSelectedTemplateNames(templateNames);
    setStep('scrub');
  }

  // Rebuild the bundle live as the scrub toggles change so the download button
  // and the byte-size readout stay in sync with the user's current stripping
  // choices. Cheap — it's all in-memory JSON assembly.
  const liveBundle = useMemo(
    () =>
      step === 'scrub'
        ? buildBundle({
            selectedRuleIds,
            selectedTemplateNames,
            rules: props.rules,
            templates: props.templates,
            sampleJson: props.sampleJson,
            appVersion: props.appVersion,
            stripSampleJson,
            stripVariables,
            exportedAt: new Date().toISOString(),
          })
        : null,
    [
      step,
      selectedRuleIds,
      selectedTemplateNames,
      props.rules,
      props.templates,
      props.sampleJson,
      props.appVersion,
      stripSampleJson,
      stripVariables,
    ],
  );

  return (
    <div class="pj-modal-backdrop" role="dialog" aria-modal="true">
      <div class="pj-modal pj-modal--export">
        {step === 'pick' ? (
          <ExportPicker
            rules={props.rules}
            templates={Object.keys(props.templates)}
            onCancel={props.onClose}
            onNext={goToScrub}
          />
        ) : null}
        {step === 'scrub' && liveBundle ? (
          <ExportScrub
            rules={props.rules.filter((r) => selectedRuleIds.includes(r.id))}
            templateNames={selectedTemplateNames}
            sampleJson={props.sampleJson}
            stripSampleJson={stripSampleJson}
            stripVariables={stripVariables}
            onToggleStripSampleJson={(n) =>
              setStripSampleJson((prev) => {
                const next = new Set(prev);
                if (next.has(n)) next.delete(n);
                else next.add(n);
                return next;
              })
            }
            onToggleStripVariables={(id) =>
              setStripVariables((prev) => {
                const next = new Set(prev);
                if (next.has(id)) next.delete(id);
                else next.add(id);
                return next;
              })
            }
            bundle={liveBundle}
            onBack={() => setStep('pick')}
            onDone={props.onClose}
          />
        ) : null}
      </div>
    </div>
  );
}
