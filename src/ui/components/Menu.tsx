import type { ComponentChildren, JSX } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';

export interface MenuItem {
  label: string;
  onSelect: () => void;
  icon?: ComponentChildren;
  /** Rendered to the right of the label — e.g. an "opens in new tab" arrow. */
  trailingIcon?: ComponentChildren;
  danger?: boolean;
}

export interface MenuProps {
  trigger: ComponentChildren;
  items: MenuItem[];
  align?: 'left' | 'right';
}

export function Menu({ trigger, items, align = 'right' }: MenuProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const onClick = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const rootNode = root.current?.getRootNode();
    const clickTarget: Document | ShadowRoot =
      rootNode instanceof ShadowRoot ? rootNode : document;

    document.addEventListener('keydown', onKey);
    clickTarget.addEventListener('click', onClick as EventListener);
    return () => {
      document.removeEventListener('keydown', onKey);
      clickTarget.removeEventListener('click', onClick as EventListener);
    };
  }, [open]);

  return (
    <div class="pj-menu" ref={root}>
      <div class="pj-menu-trigger" onClick={() => setOpen((v) => !v)}>
        {trigger}
      </div>
      {open && (
        <div class="pj-menu-list" role="menu" data-align={align}>
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              class={`pj-menu-item${item.danger ? ' pj-menu-item--danger' : ''}`}
              role="menuitem"
              onClick={() => {
                item.onSelect();
                setOpen(false);
              }}
            >
              {item.icon ? <span class="pj-menu-item-icon">{item.icon}</span> : null}
              <span class="pj-menu-item-label">{item.label}</span>
              {item.trailingIcon ? (
                <span class="pj-menu-item-trailing">{item.trailingIcon}</span>
              ) : null}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
