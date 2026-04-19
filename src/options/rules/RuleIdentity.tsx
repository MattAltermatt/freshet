import type { JSX } from 'preact';
import type { Rule } from '../../shared/types';
import { TemplatePill } from '../../ui/components/TemplatePill';

export interface RuleIdentityProps {
  rule: Rule;
  /** `'card'` gives more vertical breathing room; `'row'` tightens for list use. */
  density?: 'card' | 'row';
}

/**
 * Canonical display of a rule's identity — used by `RuleCard` and the URL
 * tester so both surfaces scan identically:
 *
 *   NAME                                        (bold, row 1)
 *   host.example.com/path/pattern/**  {pill>   (subdued, row 2)
 *
 * When the rule has no name, the host pattern moves up to row 1 in its place
 * so the top line is never blank.
 */
export function RuleIdentity(props: RuleIdentityProps): JSX.Element {
  const { rule } = props;
  const density = props.density ?? 'card';
  const primary = rule.name ?? rule.hostPattern ?? '(unnamed rule)';
  const showHostOnSecondRow = !!rule.name; // if name was used on row 1, show host on row 2
  return (
    <div class={`pj-rule-identity pj-rule-identity--${density}`}>
      <div class="pj-rule-identity-primary">{primary}</div>
      <div class="pj-rule-identity-secondary">
        <code class="pj-rule-identity-pattern">
          {showHostOnSecondRow ? (
            <>
              <span class="pj-rule-identity-host">{rule.hostPattern || '(any host)'}</span>
              <span class="pj-rule-identity-slash" aria-hidden="true">/</span>
              <span class="pj-rule-identity-path">{rule.pathPattern || '(any path)'}</span>
            </>
          ) : (
            // Name absent → host is already on row 1; show just the path below.
            <span class="pj-rule-identity-path">{rule.pathPattern || '(any path)'}</span>
          )}
        </code>
        <TemplatePill name={rule.templateName} />
      </div>
    </div>
  );
}
