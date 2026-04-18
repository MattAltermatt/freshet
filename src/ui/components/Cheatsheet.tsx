import type { JSX } from 'preact';
import { useState } from 'preact/hooks';

const ROWS: Array<[string, string]> = [
  ['Interpolation (escaped)', '{{ path.to.value }}'],
  ['Raw (no escape)', '{{ html | raw }}'],
  ['Rule variable', '{{ vars.env }}'],
  ['Conditional', '{% if status == "ok" %}…{% else %}…{% endif %}'],
  ['Loop', '{% for item in items %}{{ item.name }}{% endfor %}'],
  ['Date', '{{ ts | date: "yyyy-MM-dd" }}'],
  ['Link (URL-safe)', '{{ "https://h/{{id}}" | link }}'],
  ['Number', '{{ n | num }}'],
];

export interface CheatsheetProps {
  defaultOpen?: boolean;
}

export function Cheatsheet({ defaultOpen = false }: CheatsheetProps = {}): JSX.Element {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <aside class="pj-cheatsheet" data-open={open}>
      <button
        type="button"
        class="pj-cheatsheet-toggle"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? '×' : '?'} Cheatsheet
      </button>
      {open ? (
        <dl class="pj-cheatsheet-body">
          {ROWS.map(([label, code]) => (
            <div class="pj-cheatsheet-row" key={label}>
              <dt>{label}</dt>
              <dd>
                <code>{code}</code>
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
    </aside>
  );
}
