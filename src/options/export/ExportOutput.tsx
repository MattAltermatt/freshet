import type { JSX } from 'preact';
import { useMemo } from 'preact/hooks';
import type { FreshetBundle } from '../../bundle/schema';

export interface ExportOutputProps {
  bundle: FreshetBundle;
  onDone: () => void;
}

function filename(): string {
  const d = new Date().toISOString().slice(0, 10);
  return `freshet-export-${d}.freshet.json`;
}

export function ExportOutput(props: ExportOutputProps): JSX.Element {
  const json = useMemo(() => JSON.stringify(props.bundle, null, 2), [props.bundle]);

  function handleDownload(): void {
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename();
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function handleCopy(): Promise<void> {
    await navigator.clipboard.writeText(json);
  }

  return (
    <div class="pj-export-output">
      <h2>Export ready</h2>
      <p>
        {props.bundle.rules.length} rule(s), {props.bundle.templates.length} template(s).
      </p>
      <div class="pj-dialog-footer">
        <button type="button" class="pj-btn" data-variant="primary" onClick={handleDownload}>
          Download
        </button>
        <button type="button" class="pj-btn" onClick={() => void handleCopy()}>
          Copy JSON to clipboard
        </button>
        <button type="button" class="pj-btn" onClick={props.onDone}>
          Done
        </button>
      </div>
    </div>
  );
}
