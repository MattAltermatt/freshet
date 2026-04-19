import { describe, it, expect } from 'vitest';
import { nextAvailableName, detectCollisions } from './collide';
import type { FreshetBundle } from './schema';
import type { Rule, Templates } from '../shared/types';

describe('nextAvailableName', () => {
  it('returns name-2 when base already exists', () => {
    expect(nextAvailableName('github-repo', new Set(['github-repo']))).toBe('github-repo-2');
  });

  it('skips past name-2, name-3 to find the first free', () => {
    expect(nextAvailableName('x', new Set(['x', 'x-2', 'x-3']))).toBe('x-4');
  });

  it('returns base unchanged when no collision', () => {
    expect(nextAvailableName('fresh', new Set([]))).toBe('fresh');
  });
});

describe('detectCollisions', () => {
  const existingRules: Rule[] = [
    {
      id: 'existing-1',
      hostPattern: 'a',
      pathPattern: 'b',
      templateName: 'foo',
      variables: {},
      active: true,
    },
  ];
  const existingTemplates: Templates = { foo: '<div></div>' };

  const bundle: FreshetBundle = {
    bundleSchemaVersion: 1,
    exportedAt: '2026-04-19T00:00:00Z',
    appVersion: '1.0.0',
    templates: [{ name: 'foo', source: '<div>new</div>' }],
    rules: [
      {
        id: 'existing-1', // id collision
        hostPattern: 'a',
        pathPattern: 'b',
        templateName: 'foo',
        active: true,
      },
    ],
  };

  it('detects template name collision', () => {
    const c = detectCollisions(bundle, existingRules, existingTemplates);
    expect(c.templateCollisions).toHaveLength(1);
    expect(c.templateCollisions[0]?.name).toBe('foo');
    expect(c.templateCollisions[0]?.proposedRename).toBe('foo-2');
  });

  it('detects rule id collision', () => {
    const c = detectCollisions(bundle, existingRules, existingTemplates);
    expect(c.ruleIdCollisions).toHaveLength(1);
    expect(c.ruleIdCollisions[0]?.id).toBe('existing-1');
  });

  it('flags pattern overlap for rules with different ids but same pattern', () => {
    const b = { ...bundle, rules: [{ ...bundle.rules[0]!, id: 'different' }] };
    const c = detectCollisions(b, existingRules, existingTemplates);
    expect(c.rulePatternOverlaps).toHaveLength(1);
  });
});
