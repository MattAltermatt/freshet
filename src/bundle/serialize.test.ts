import { describe, it, expect } from 'vitest';
import { buildBundle } from './serialize';
import type { Rule, Templates } from '../shared/types';

const rules: Rule[] = [
  {
    id: 'r1',
    name: '[qa] ghr',
    hostPattern: 'api.github.com',
    pathPattern: '/repos/**',
    templateName: 'github-repo',
    variables: { env: 'qa' },
    active: true,
    isExample: true,
    exampleUrl: 'https://example.com',
  },
];

const templates: Templates = { 'github-repo': '<div>{{name}}</div>' };

const sampleJson = { 'github-repo': '{"name":"demo"}' };

describe('buildBundle', () => {
  it('includes selected rules + selected templates + sample JSON by default', () => {
    const b = buildBundle({
      selectedRuleIds: ['r1'],
      selectedTemplateNames: ['github-repo'],
      rules,
      templates,
      sampleJson,
      appVersion: '1.0.0',
      stripSampleJson: new Set(),
      stripVariables: new Set(),
      exportedAt: '2026-04-19T00:00:00Z',
    });
    expect(b.bundleSchemaVersion).toBe(1);
    expect(b.templates).toHaveLength(1);
    expect(b.templates[0]?.sampleJson).toBe('{"name":"demo"}');
    expect(b.rules).toHaveLength(1);
    expect(b.rules[0]?.variables).toEqual({ env: 'qa' });
  });

  it('omits sampleJson when strip set includes the template name', () => {
    const b = buildBundle({
      selectedRuleIds: ['r1'],
      selectedTemplateNames: ['github-repo'],
      rules,
      templates,
      sampleJson,
      appVersion: '1.0.0',
      stripSampleJson: new Set(['github-repo']),
      stripVariables: new Set(),
      exportedAt: '2026-04-19T00:00:00Z',
    });
    expect(b.templates[0]?.sampleJson).toBeUndefined();
  });

  it('omits variables when strip set includes the rule id', () => {
    const b = buildBundle({
      selectedRuleIds: ['r1'],
      selectedTemplateNames: ['github-repo'],
      rules,
      templates,
      sampleJson,
      appVersion: '1.0.0',
      stripSampleJson: new Set(),
      stripVariables: new Set(['r1']),
      exportedAt: '2026-04-19T00:00:00Z',
    });
    expect(b.rules[0]?.variables).toBeUndefined();
  });

  it('strips isExample and exampleUrl from exported rules', () => {
    const b = buildBundle({
      selectedRuleIds: ['r1'],
      selectedTemplateNames: ['github-repo'],
      rules,
      templates,
      sampleJson,
      appVersion: '1.0.0',
      stripSampleJson: new Set(),
      stripVariables: new Set(),
      exportedAt: '2026-04-19T00:00:00Z',
    });
    expect((b.rules[0] as unknown as Record<string, unknown>).isExample).toBeUndefined();
    expect((b.rules[0] as unknown as Record<string, unknown>).exampleUrl).toBeUndefined();
  });

  it('preserves selected order of rules', () => {
    const moreRules: Rule[] = [
      { ...rules[0]!, id: 'rA' },
      { ...rules[0]!, id: 'rB' },
      { ...rules[0]!, id: 'rC' },
    ];
    const b = buildBundle({
      selectedRuleIds: ['rC', 'rA'],
      selectedTemplateNames: ['github-repo'],
      rules: moreRules,
      templates,
      sampleJson,
      appVersion: '1.0.0',
      stripSampleJson: new Set(),
      stripVariables: new Set(),
      exportedAt: '2026-04-19T00:00:00Z',
    });
    expect(b.rules.map((r) => r.id)).toEqual(['rC', 'rA']);
  });
});
