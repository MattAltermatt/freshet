import type { JSX } from 'preact';
import { useMemo } from 'preact/hooks';
import { json } from '@codemirror/lang-json';
import { syntaxHighlighting } from '@codemirror/language';
import { CodeMirrorBox, pjHighlightStyle } from '../../ui';

export interface SampleJsonEditorProps {
  value: string;
  onChange: (v: string) => void;
  minHeight?: string;
}

export function SampleJsonEditor({
  value,
  onChange,
  minHeight = '160px',
}: SampleJsonEditorProps): JSX.Element {
  const extensions = useMemo(
    () => [json(), syntaxHighlighting(pjHighlightStyle, { fallback: true })],
    [],
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
