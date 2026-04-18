import type { JSX, Ref } from 'preact';
import { useId, useState } from 'preact/hooks';

export interface PatternFieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  examples: string[];
  placeholder?: string;
  hint?: string;
  error?: string | null;
  inputRef?: Ref<HTMLInputElement>;
}

export function PatternField({
  label,
  value,
  onChange,
  examples,
  placeholder,
  hint,
  error,
  inputRef,
}: PatternFieldProps): JSX.Element {
  const inputId = useId();
  const [showExamples, setShowExamples] = useState(false);
  return (
    <div class="pj-pattern-field">
      <div class="pj-pattern-label-row">
        <label for={inputId}>{label}</label>
        <button
          type="button"
          class="pj-link-btn"
          aria-expanded={showExamples}
          onClick={() => setShowExamples((v) => !v)}
        >
          {showExamples ? '▾ Hide examples' : '▸ Show examples'}
        </button>
      </div>
      <input
        id={inputId}
        type="text"
        class={error ? 'pj-invalid' : ''}
        placeholder={placeholder}
        value={value}
        onInput={(e) => onChange((e.target as HTMLInputElement).value)}
        {...(inputRef ? { ref: inputRef } : {})}
      />
      {error ? <div class="pj-field-err">{error}</div> : null}
      {hint ? <div class="pj-field-hint">{hint}</div> : null}
      {showExamples ? (
        <ul class="pj-examples">
          {examples.map((ex) => (
            <li key={ex}>
              <button type="button" class="pj-link-btn" onClick={() => onChange(ex)}>
                <code>{ex}</code>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
