import type { JSX } from 'preact';

export interface TemplatePillProps {
  name: string;
  /** Optional click handler — renders as a button; otherwise a span. */
  onClick?: () => void;
  title?: string;
}

/**
 * Brand-flavored display of a template name. Renders as `{name>` with the
 * bracket glyphs in accent-strong and the name in the inherited foreground.
 * Signals "this is the transform" in text-dense surfaces (rule cards, URL
 * tester, popup) without competing with actual authoring affordances.
 */
export function TemplatePill(props: TemplatePillProps): JSX.Element {
  const inner = (
    <>
      <span class="pj-tpl-pill-bracket" aria-hidden="true">{'{'}</span>
      <span class="pj-tpl-pill-name">{props.name}</span>
      <span class="pj-tpl-pill-bracket" aria-hidden="true">{'>'}</span>
    </>
  );
  const title = props.title ?? `Template: ${props.name}`;
  if (props.onClick) {
    return (
      <button
        type="button"
        class="pj-tpl-pill pj-tpl-pill--button"
        onClick={props.onClick}
        title={title}
      >
        {inner}
      </button>
    );
  }
  return (
    <span class="pj-tpl-pill" title={title}>
      {inner}
    </span>
  );
}
