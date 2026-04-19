import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import type { ImportFlagEntry } from '../../storage/storage';

export interface NeedsAttentionProps {
  entry: ImportFlagEntry;
  onDismiss: () => void;
}

export function NeedsAttention(props: NeedsAttentionProps): JSX.Element {
  const [open, setOpen] = useState(false);
  return (
    <div class="pj-needs-attention">
      <button
        type="button"
        class="pj-needs-attention-badge"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        ⚠ needs attention ({props.entry.flags.length})
      </button>
      {open ? (
        <div class="pj-needs-attention-body">
          <p>Imported at: {props.entry.importedAt}</p>
          <ul>
            {props.entry.flags.map((f) => (
              <li key={f.field + f.pattern}>
                Matched <code>{f.pattern}</code> on <code>{f.field}</code>. Matched text:{' '}
                <code>{f.matchedText}</code>
              </li>
            ))}
          </ul>
          <button type="button" class="pj-btn" onClick={props.onDismiss}>
            Dismiss
          </button>
        </div>
      ) : null}
    </div>
  );
}
