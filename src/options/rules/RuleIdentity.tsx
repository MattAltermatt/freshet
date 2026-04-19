import type { JSX } from 'preact';
import { TemplatePill } from '../../ui/components/TemplatePill';

/**
 * Just the fields RuleIdentity actually reads. Accepts both `Rule` (full
 * stored rule) and `BundleRule` (import/export DTO) without casting.
 */
export interface RuleIdentityShape {
  name?: string;
  hostPattern: string;
  pathPattern: string;
  templateName: string;
}

export interface RuleIdentityProps {
  rule: RuleIdentityShape;
  /** `'card'` gives more vertical breathing room; `'row'` tightens for list use. */
  density?: 'card' | 'row';
}

/**
 * Canonical display of a rule's identity — used by `RuleCard` and the URL
 * tester so both surfaces scan identically. Three rows, always in the same
 * positions so the eye never has to hunt:
 *
 *   **Name** (or ***hostname*** italic when name unset)   {template>
 *   host.example.com
 *   /path/pattern/**
 *
 * Row 1's right edge is always the TemplatePill. Rows 2 and 3 always hold the
 * host and path patterns in that order, even when row 1 is already showing
 * the hostname as a fallback — positional consistency beats avoiding the
 * duplication.
 */
export function RuleIdentity(props: RuleIdentityProps): JSX.Element {
  const { rule } = props;
  const density = props.density ?? 'card';
  const hasName = !!rule.name;
  const headerLabel = hasName
    ? rule.name!
    : rule.hostPattern || '(unnamed rule)';
  return (
    <div class={`pj-rule-identity pj-rule-identity--${density}`}>
      <div class="pj-rule-identity-header">
        <span
          class={`pj-rule-identity-primary${hasName ? '' : ' pj-rule-identity-primary--fallback'}`}
        >
          {headerLabel}
        </span>
        <TemplatePill name={rule.templateName} />
      </div>
      <code class="pj-rule-identity-host">{rule.hostPattern || '(any host)'}</code>
      <code class="pj-rule-identity-path">{rule.pathPattern || '(any path)'}</code>
    </div>
  );
}
