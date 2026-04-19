import type { JSX } from 'preact';
import { useEffect, useState } from 'preact/hooks';

const SHORTCUTS: Array<[string, string]> = [
  ['⌘⇧J', 'Toggle raw/rendered on a matched page'],
  ['⌘⇧C', "Copy current tab's URL"],
  ['⌘/', 'Focus URL tester (this page)'],
  ['⌘S', 'Disabled — your changes autosave'],
  ['?', 'Open this panel'],
];

function focusUrlTester(): void {
  const input = document.querySelector<HTMLInputElement>('.pj-url-input');
  if (input) {
    input.focus();
    input.select();
  }
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.matches('input, textarea, select')) return true;
  if (target.closest('.cm-content')) return true;
  if (target.isContentEditable) return true;
  return false;
}

export function ShortcutsFooter(): JSX.Element {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if ((e.metaKey || e.ctrlKey) && e.key === '/') {
        e.preventDefault();
        focusUrlTester();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault(); // autosave is live; block Save dialog
        return;
      }
      if (e.key === '?' && !isTypingTarget(e.target)) {
        setOpen((v) => !v);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  return (
    <footer class="pj-shortcuts">
      <div class="pj-shortcuts-bar">
        <button
          type="button"
          class="pj-shortcuts-toggle"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? '▾' : '▸'} Keyboard shortcuts
        </button>
        <nav class="pj-shortcuts-links" aria-label="Project links">
          <a
            href="https://mattaltermatt.github.io/freshet/"
            target="_blank"
            rel="noopener noreferrer"
          >
            Freshet site
            <span class="pj-ext-arrow" aria-hidden="true">↗</span>
          </a>
          <a
            href="https://github.com/MattAltermatt/freshet"
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub
            <span class="pj-ext-arrow" aria-hidden="true">↗</span>
          </a>
        </nav>
      </div>
      {open ? (
        <dl class="pj-shortcuts-body">
          {SHORTCUTS.map(([keys, desc]) => (
            <div class="pj-shortcut-row" key={keys}>
              <dt>
                <kbd>{keys}</kbd>
              </dt>
              <dd>{desc}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </footer>
  );
}
