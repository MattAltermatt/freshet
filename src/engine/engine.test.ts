import { describe, it, expect } from 'vitest';
import { render } from './engine';

describe('render — values and variables', () => {
  it('returns non-template text unchanged', () => {
    expect(render('<p>hello</p>', {}, {})).toBe('<p>hello</p>');
  });
  it('interpolates a dotted-path value', () => {
    expect(render('<p>{{id}}</p>', { id: 42 }, {})).toBe('<p>42</p>');
  });
  it('interpolates a variable', () => {
    expect(render('<p>{{@env}}</p>', {}, { env: 'qa' })).toBe('<p>qa</p>');
  });
  it('escapes HTML in values', () => {
    expect(render('<p>{{x}}</p>', { x: '<b>&' }, {})).toBe('<p>&lt;b&gt;&amp;</p>');
  });
  it('renders missing values as empty string', () => {
    expect(render('<p>[{{missing}}]</p>', {}, {})).toBe('<p>[]</p>');
  });
  it('triple-brace skips HTML escaping', () => {
    expect(render('<p>{{{x}}}</p>', { x: '<b>' }, {})).toBe('<p><b></p>');
  });
});
