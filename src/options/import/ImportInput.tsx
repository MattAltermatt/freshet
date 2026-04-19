import type { JSX } from 'preact';
import { useRef, useState } from 'preact/hooks';
import { parseBundle } from '../../bundle/parse';
import type { FreshetBundle } from '../../bundle/schema';

export interface ImportInputProps {
  onCancel: () => void;
  onParsed: (bundle: FreshetBundle) => void;
}

async function readFile(f: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsText(f);
  });
}

export function ImportInput(props: ImportInputProps): JSX.Element {
  const [text, setText] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);

  async function handleFile(f: File): Promise<void> {
    const t = await readFile(f);
    setText(t);
    setErrors([]);
  }

  function handleNext(): void {
    const r = parseBundle(text);
    if (!r.ok) {
      setErrors(r.errors);
      return;
    }
    props.onParsed(r.bundle);
  }

  function handleDrop(e: DragEvent): void {
    e.preventDefault();
    const f = e.dataTransfer?.files[0];
    if (f) void handleFile(f);
  }

  return (
    <div class="pj-import-input">
      <h2>Import a bundle</h2>
      <p>You can import a Freshet bundle three ways:</p>
      <ul>
        <li>
          Drag a <code>.freshet.json</code> file onto this window
        </li>
        <li>Click "Choose file…" to pick one from disk</li>
        <li>Paste bundle JSON directly into the box below</li>
      </ul>
      <div
        class="pj-drop-zone"
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
      >
        <button type="button" class="pj-btn" onClick={() => fileInput.current?.click()}>
          Choose file…
        </button>
        <input
          ref={fileInput}
          type="file"
          accept=".json,.freshet.json,application/json"
          hidden
          onChange={(e) => {
            const f = (e.target as HTMLInputElement).files?.[0];
            if (f) void handleFile(f);
          }}
        />
      </div>
      <textarea
        placeholder="Paste bundle JSON here"
        value={text}
        onInput={(e) => setText((e.target as HTMLTextAreaElement).value)}
        rows={8}
      />
      {errors.length > 0 ? (
        <div class="pj-errors" role="alert">
          {errors.map((err) => (
            <div key={err}>{err}</div>
          ))}
        </div>
      ) : null}
      <div class="pj-dialog-footer">
        <button type="button" class="pj-btn" onClick={props.onCancel}>
          Cancel
        </button>
        <button
          type="button"
          class="pj-btn"
          data-variant="primary"
          onClick={handleNext}
          disabled={!text.trim()}
        >
          Next: Review
        </button>
      </div>
    </div>
  );
}
