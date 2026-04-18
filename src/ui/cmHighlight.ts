import { HighlightStyle } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';

/**
 * CodeMirror 6 syntax-highlight style keyed to our theme CSS variables so
 * colors follow light/dark. Applied alongside the language extension via
 * `syntaxHighlighting(pjHighlightStyle, { fallback: true })`.
 */
export const pjHighlightStyle = HighlightStyle.define([
  { tag: [t.keyword, t.controlKeyword, t.modifier], color: 'var(--pj-accent)', fontWeight: '600' },
  { tag: [t.propertyName, t.variableName], color: 'var(--pj-fg)' },
  { tag: [t.string, t.regexp], color: 'var(--pj-success)' },
  { tag: [t.number, t.bool, t.null, t.atom], color: 'var(--pj-accent-hover)' },
  { tag: [t.comment, t.lineComment, t.blockComment], color: 'var(--pj-fg-subtle)', fontStyle: 'italic' },
  { tag: [t.operator, t.punctuation, t.brace, t.bracket], color: 'var(--pj-fg-muted)' },
  { tag: [t.tagName], color: 'var(--pj-accent)' },
  { tag: [t.attributeName], color: 'var(--pj-accent-hover)' },
  { tag: [t.attributeValue], color: 'var(--pj-success)' },
  { tag: [t.function(t.variableName), t.function(t.propertyName)], color: 'var(--pj-accent-hover)' },
  { tag: [t.labelName], color: 'var(--pj-fg)' },
]);
