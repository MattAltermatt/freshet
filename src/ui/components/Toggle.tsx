import type { JSX } from 'preact';
import { useId } from 'preact/hooks';

interface ToggleProps {
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}

export function Toggle({ label, checked, onChange, disabled }: ToggleProps): JSX.Element {
  const labelId = useId();
  return (
    <label class="pj-toggle" for={labelId}>
      <button
        id={labelId}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        class={`pj-toggle__track${checked ? ' pj-toggle__track--on' : ''}`}
      >
        <span class="pj-toggle__thumb" />
      </button>
      <span class="pj-toggle__label">{label}</span>
    </label>
  );
}
