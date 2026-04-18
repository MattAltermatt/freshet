import type { JSX } from 'preact';
import { useMemo } from 'preact/hooks';
import { autocompletion } from '@codemirror/autocomplete';
import { syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language';
import { CodeMirrorBox } from '../../ui';
import { liquid } from './liquidMode';
import { liquidCompletions, walkJsonPaths } from './liquidCompletions';

export interface TemplateEditorProps {
  value: string;
  onChange: (v: string) => void;
  sampleJson: unknown;
  ruleVars: string[];
  minHeight?: string;
}

export function TemplateEditor({
  value,
  onChange,
  sampleJson,
  ruleVars,
  minHeight = '400px',
}: TemplateEditorProps): JSX.Element {
  const source = useMemo(
    () => liquidCompletions({ sampleJsonPaths: walkJsonPaths(sampleJson), ruleVars }),
    [sampleJson, ruleVars],
  );
  const extensions = useMemo(
    () => [
      liquid,
      syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
      autocompletion({ override: [source] }),
    ],
    [source],
  );
  return (
    <CodeMirrorBox
      value={value}
      onChange={onChange}
      extensions={extensions}
      minHeight={minHeight}
    />
  );
}
