import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import type { Rule, Templates } from '../../shared/types';
import { ExportPicker } from './ExportPicker';
import { ExportScrub } from './ExportScrub';
import { ExportOutput } from './ExportOutput';
import { buildBundle } from '../../bundle/serialize';
import type { FreshetBundle } from '../../bundle/schema';

export interface ExportDialogProps {
  rules: Rule[];
  templates: Templates;
  sampleJson: Record<string, string>;
  appVersion: string;
  onClose: () => void;
}

type Step = 'pick' | 'scrub' | 'output';

export function ExportDialog(props: ExportDialogProps): JSX.Element {
  const [step, setStep] = useState<Step>('pick');
  const [selectedRuleIds, setSelectedRuleIds] = useState<string[]>([]);
  const [selectedTemplateNames, setSelectedTemplateNames] = useState<string[]>([]);
  const [stripSampleJson, setStripSampleJson] = useState<Set<string>>(new Set());
  const [stripVariables, setStripVariables] = useState<Set<string>>(new Set());
  const [bundle, setBundle] = useState<FreshetBundle | null>(null);

  function goToScrub(ruleIds: string[], templateNames: string[]): void {
    setSelectedRuleIds(ruleIds);
    setSelectedTemplateNames(templateNames);
    setStep('scrub');
  }

  function goToOutput(): void {
    const b = buildBundle({
      selectedRuleIds,
      selectedTemplateNames,
      rules: props.rules,
      templates: props.templates,
      sampleJson: props.sampleJson,
      appVersion: props.appVersion,
      stripSampleJson,
      stripVariables,
      exportedAt: new Date().toISOString(),
    });
    setBundle(b);
    setStep('output');
  }

  return (
    <div class="pj-modal-backdrop" role="dialog" aria-modal="true">
      <div class="pj-modal">
        {step === 'pick' ? (
          <ExportPicker
            rules={props.rules}
            templates={Object.keys(props.templates)}
            onCancel={props.onClose}
            onNext={goToScrub}
          />
        ) : null}
        {step === 'scrub' ? (
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
            onBack={() => setStep('pick')}
            onNext={goToOutput}
          />
        ) : null}
        {step === 'output' && bundle ? (
          <ExportOutput bundle={bundle} onDone={props.onClose} />
        ) : null}
      </div>
    </div>
  );
}
