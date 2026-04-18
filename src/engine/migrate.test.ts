import { describe, it, expect } from 'vitest';
import { migrateTemplate } from './migrate';

describe('migrateTemplate — v1 → v2 (Liquid)', () => {
  it('leaves pure text unchanged', () => {
    expect(migrateTemplate('<p>hello</p>')).toBe('<p>hello</p>');
  });
  it('leaves plain inline expressions unchanged', () => {
    expect(migrateTemplate('<p>{{id}} {{user.name}}</p>')).toBe('<p>{{id}} {{user.name}}</p>');
  });
  it('rewrites triple-brace to | raw', () => {
    expect(migrateTemplate('<p>{{{html}}}</p>')).toBe('<p>{{ html | raw }}</p>');
    expect(migrateTemplate('<p>{{{user.bio}}}</p>')).toBe('<p>{{ user.bio | raw }}</p>');
  });
  it('rewrites {{@var}} to {{ vars.var }}', () => {
    expect(migrateTemplate('<p>{{@env}} / {{@adminHost}}</p>'))
      .toBe('<p>{{ vars.env }} / {{ vars.adminHost }}</p>');
  });
  it('rewrites bare #when to {% if == %}', () => {
    expect(migrateTemplate('{{#when status "UP"}}<g>{{/when}}'))
      .toBe('{% if status == "UP" %}<g>{% endif %}');
  });
  it('rewrites #when + #else', () => {
    expect(migrateTemplate('{{#when x "y"}}<g>{{#else}}<r>{{/when}}'))
      .toBe('{% if x == "y" %}<g>{% else %}<r>{% endif %}');
  });
  it('rewrites #when on @variable', () => {
    expect(migrateTemplate('{{#when @env "qa"}}[QA]{{/when}}'))
      .toBe('{% if vars.env == "qa" %}[QA]{% endif %}');
  });
  it('rewrites #when with dotted-path LHS', () => {
    expect(migrateTemplate('{{#when user.role "admin"}}X{{/when}}'))
      .toBe('{% if user.role == "admin" %}X{% endif %}');
  });
  it('rewrites #each + {{this}}', () => {
    expect(migrateTemplate('{{#each xs}}[{{this}}]{{/each}}'))
      .toBe('{% for item in xs %}[{{ item }}]{% endfor %}');
  });
  it('rewrites #each + {{this.field}}', () => {
    expect(migrateTemplate('{{#each users}}{{this.name}};{{/each}}'))
      .toBe('{% for item in users %}{{ item.name }};{% endfor %}');
  });
  it('rewrites nested #each + #when', () => {
    const input = '{{#each xs}}{{#when this.on "y"}}{{this.id}}{{/when}}{{/each}}';
    const expected = '{% for item in xs %}{% if item.on == "y" %}{{ item.id }}{% endif %}{% endfor %}';
    expect(migrateTemplate(input)).toBe(expected);
  });
  it('rewrites date helper', () => {
    expect(migrateTemplate('{{date ts}}')).toBe('{{ ts | date }}');
    expect(migrateTemplate('{{date ts "yyyy-MM-dd"}}')).toBe('{{ ts | date: "yyyy-MM-dd" }}');
  });
  it('rewrites num helper', () => {
    expect(migrateTemplate('{{num stars}}')).toBe('{{ stars | num }}');
    expect(migrateTemplate('{{num stats.forks}}')).toBe('{{ stats.forks | num }}');
  });
  it('rewrites link helper (preserving inner tokens)', () => {
    expect(migrateTemplate('{{link "https://h/{{id}}"}}')).toBe('{{ "https://h/{{id}}" | link }}');
    expect(migrateTemplate('{{link "https://{{@host}}/u/{{id}}"}}'))
      .toBe('{{ "https://{{ vars.host }}/u/{{id}}" | link }}');
  });
  it('migrates a realistic mixed template', () => {
    const input = '<p>{{@adminHost}}</p>{{#when status "UP"}}<g>{{/when}}{{#each items}}<li>{{this.name}}</li>{{/each}}{{date ts}}';
    const expected = '<p>{{ vars.adminHost }}</p>{% if status == "UP" %}<g>{% endif %}{% for item in items %}<li>{{ item.name }}</li>{% endfor %}{{ ts | date }}';
    expect(migrateTemplate(input)).toBe(expected);
  });
});
