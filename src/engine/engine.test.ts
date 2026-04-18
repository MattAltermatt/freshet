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

describe('render — #when', () => {
  it('renders the true branch when equal', () => {
    const t = '{{#when status "UP"}}<green>{{/when}}';
    expect(render(t, { status: 'UP' }, {})).toBe('<green>');
  });
  it('renders nothing when unequal and no else', () => {
    const t = '{{#when status "UP"}}<green>{{/when}}';
    expect(render(t, { status: 'DOWN' }, {})).toBe('');
  });
  it('renders #else branch when unequal', () => {
    const t = '{{#when status "UP"}}<green>{{#else}}<red>{{/when}}';
    expect(render(t, { status: 'DOWN' }, {})).toBe('<red>');
  });
  it('supports @variable as the left-hand side', () => {
    const t = '{{#when @env "qa"}}[QA]{{/when}}';
    expect(render(t, {}, { env: 'qa' })).toBe('[QA]');
    expect(render(t, {}, { env: 'prod' })).toBe('');
  });
  it('interpolates inside the chosen branch', () => {
    const t = '{{#when on "y"}}id={{id}}{{/when}}';
    expect(render(t, { on: 'y', id: 7 }, {})).toBe('id=7');
  });
});

describe('render — #each', () => {
  it('iterates array elements', () => {
    const t = '{{#each items}}<li>{{this.name}}</li>{{/each}}';
    const json = { items: [{ name: 'a' }, { name: 'b' }] };
    expect(render(t, json, {})).toBe('<li>a</li><li>b</li>');
  });
  it('renders nothing for empty arrays', () => {
    expect(render('{{#each xs}}x{{/each}}', { xs: [] }, {})).toBe('');
  });
  it('renders nothing for missing arrays', () => {
    expect(render('{{#each xs}}x{{/each}}', {}, {})).toBe('');
  });
  it('supports {{this}} for primitive elements', () => {
    const t = '{{#each xs}}[{{this}}]{{/each}}';
    expect(render(t, { xs: ['a', 'b'] }, {})).toBe('[a][b]');
  });
  it('nests with #when inside each element', () => {
    const t = '{{#each xs}}{{#when this.on "y"}}{{this.id}}{{/when}}{{/each}}';
    const json = { xs: [{ id: 1, on: 'y' }, { id: 2, on: 'n' }, { id: 3, on: 'y' }] };
    expect(render(t, json, {})).toBe('13');
  });
});

describe('render — date helper', () => {
  it('formats an ISO timestamp with custom format', () => {
    process.env.TZ = 'UTC';
    const t = '{{date insertDate "yyyy-MM-dd"}}';
    expect(render(t, { insertDate: '2026-04-17T23:09:30Z' }, {})).toBe('2026-04-17');
  });
});
