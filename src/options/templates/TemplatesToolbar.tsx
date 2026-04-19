import type { JSX } from 'preact';
import { useRef, useState } from 'preact/hooks';
import { Button, useFocusTrap } from '../../ui';
import type { Rule, Templates } from '../../shared/types';

export interface TemplatesToolbarProps {
  templates: Templates;
  current: string | null;
  rules: Rule[];
  onSelect: (name: string) => void;
  onChange: (next: Templates) => void;
  onDeactivateRules: (ruleIds: string[]) => void;
}

function promptUnique(
  message: string,
  existing: Templates,
  defaultValue?: string,
): string | null {
  const raw = window.prompt(message, defaultValue);
  if (raw === null) return null;
  const name = raw.trim();
  if (!name) return null;
  if (existing[name] !== undefined) {
    window.alert(`"${name}" already exists — pick a different name.`);
    return null;
  }
  return name;
}

export function TemplatesToolbar({
  templates,
  current,
  rules,
  onSelect,
  onChange,
  onDeactivateRules,
}: TemplatesToolbarProps): JSX.Element {
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const confirmDialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap({
    containerRef: confirmDialogRef,
    active: confirmDelete !== null,
    onEscape: () => setConfirmDelete(null),
  });

  const doNew = (): void => {
    const name = promptUnique('New template name', templates);
    if (!name) return;
    onChange({ ...templates, [name]: '' });
    onSelect(name);
  };

  const doRename = (): void => {
    if (!current) return;
    const name = promptUnique(`Rename "${current}" to`, templates, current);
    if (!name || name === current) return;
    const next: Templates = {};
    for (const [k, v] of Object.entries(templates)) next[k === current ? name : k] = v;
    onChange(next);
    onSelect(name);
  };

  const doDuplicate = (): void => {
    if (!current) return;
    let name = `${current}-copy`;
    let n = 2;
    while (templates[name] !== undefined) name = `${current}-copy-${n++}`;
    onChange({ ...templates, [name]: templates[current]! });
    onSelect(name);
  };

  const doDelete = (): void => {
    if (current) setConfirmDelete(current);
  };

  const affectedRules =
    confirmDelete ? rules.filter((r) => r.templateName === confirmDelete) : [];

  const confirmDeleteCommit = (): void => {
    if (!confirmDelete) return;
    const next = { ...templates };
    delete next[confirmDelete];
    onChange(next);
    if (affectedRules.length > 0) {
      onDeactivateRules(affectedRules.map((r) => r.id));
    }
    const remaining = Object.keys(next);
    onSelect(remaining[0] ?? '');
    setConfirmDelete(null);
  };

  const templateNames = Object.keys(templates);

  return (
    <div class="pj-templates-toolbar">
      <label class="pj-templates-select">
        <span class="pj-visually-hidden">Template</span>
        <select
          value={current ?? ''}
          onChange={(e) => onSelect((e.target as HTMLSelectElement).value)}
          disabled={templateNames.length === 0}
        >
          {templateNames.length === 0 ? (
            <option value="">No templates — click New</option>
          ) : (
            templateNames.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))
          )}
        </select>
      </label>
      <Button onClick={doNew} title="Create a new empty template">
        + New
      </Button>
      <Button onClick={doRename} disabled={!current} title="Rename this template">
        Rename
      </Button>
      <Button
        onClick={doDuplicate}
        disabled={!current}
        title="Duplicate this template"
      >
        Duplicate
      </Button>
      <Button
        onClick={doDelete}
        disabled={!current}
        variant="danger"
        title="Delete this template"
      >
        Delete
      </Button>

      {confirmDelete ? (
        <div class="pj-modal-backdrop" onClick={() => setConfirmDelete(null)}>
          <div
            class="pj-modal"
            role="dialog"
            aria-modal="true"
            aria-label={`Delete template ${confirmDelete}`}
            ref={confirmDialogRef}
            onClick={(e) => e.stopPropagation()}
          >
            <header class="pj-modal-header">
              <h3>Delete template "{confirmDelete}"?</h3>
            </header>
            <div class="pj-modal-body">
              {affectedRules.length > 0 ? (
                <>
                  <p>
                    <strong>{affectedRules.length}</strong>{' '}
                    rule{affectedRules.length === 1 ? '' : 's'} use this template. Deleting
                    will <strong>deactivate</strong> {affectedRules.length === 1 ? 'it' : 'them'}:
                  </p>
                  <ul class="pj-affected-rules">
                    {affectedRules.map((r) => (
                      <li key={r.id}>
                        <code>
                          {r.hostPattern || '(any)'} · {r.pathPattern || '(any)'}
                        </code>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p>No rules reference this template.</p>
              )}
            </div>
            <footer class="pj-modal-footer">
              <Button variant="ghost" onClick={() => setConfirmDelete(null)}>
                Cancel
              </Button>
              <Button variant="danger" onClick={confirmDeleteCommit}>
                {affectedRules.length > 0
                  ? `Delete + deactivate ${affectedRules.length} rule${affectedRules.length === 1 ? '' : 's'}`
                  : 'Delete'}
              </Button>
            </footer>
          </div>
        </div>
      ) : null}
    </div>
  );
}
