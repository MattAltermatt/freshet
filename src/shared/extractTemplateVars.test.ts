import { describe, it, expect } from 'vitest';
import { extractTemplateVars } from './extractTemplateVars';

describe('extractTemplateVars', () => {
  it('returns an empty list for an empty template', () => {
    expect(extractTemplateVars('')).toEqual([]);
  });

  it('returns an empty list for templates without vars refs', () => {
    expect(extractTemplateVars('<p>{{ name }}</p>')).toEqual([]);
  });

  it('picks up dot-access inside output tags', () => {
    expect(extractTemplateVars('<p>{{ vars.apiKey }}</p>')).toEqual(['apiKey']);
  });

  it('picks up dot-access inside control tags', () => {
    expect(
      extractTemplateVars('{% if vars.showHeader %}<h1/>{% endif %}'),
    ).toEqual(['showHeader']);
  });

  it('deduplicates and sorts', () => {
    const body = '{{ vars.b }}{{ vars.a }}{% if vars.b %}y{% endif %}';
    expect(extractTemplateVars(body)).toEqual(['a', 'b']);
  });

  it('handles filter chains after the var', () => {
    expect(extractTemplateVars('{{ vars.created | date: "yyyy" }}')).toEqual([
      'created',
    ]);
  });

  it('ignores partial word boundaries', () => {
    expect(extractTemplateVars('{{ myvars.foo }}')).toEqual([]);
    expect(extractTemplateVars('{{ vars.}}')).toEqual([]);
  });
});
