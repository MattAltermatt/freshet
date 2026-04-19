import { describe, it, expect } from 'vitest';
import { applyImport } from './commit';
import type { FreshetBundle } from '../../bundle/schema';
import type { Rule, Templates } from '../../shared/types';

const bundle: FreshetBundle = {
  bundleSchemaVersion: 1,
  exportedAt: 'x',
  appVersion: '1',
  templates: [{ name: 'foo', source: '<div>new</div>', sampleJson: '{"a":1}' }],
  rules: [
    {
      id: 'rA',
      name: 'imp',
      hostPattern: 'a',
      pathPattern: 'b',
      templateName: 'foo',
      active: true,
    },
  ],
};

describe('applyImport — append mode', () => {
  it('appends rule to end inactive + auto-renames colliding template', () => {
    const existingRules: Rule[] = [
      {
        id: 'rExist',
        hostPattern: 'c',
        pathPattern: 'd',
        templateName: 'foo',
        variables: {},
        active: true,
      },
    ];
    const existingTemplates: Templates = { foo: '<div>old</div>' };
    const existingSample = { foo: '{"old":true}' };

    const result = applyImport({
      plan: {
        bundle,
        mode: 'append',
        skipRuleIds: new Set(),
        skipTemplateNames: new Set(),
        templateCollisionResolution: new Map(),
        ruleCollisionResolution: new Map(),
        templateRenameMap: new Map(),
      },
      existingRules,
      existingTemplates,
      existingSample,
      now: '2026-04-19T00:00:00Z',
    });

    expect(Object.keys(result.templates).sort()).toEqual(['foo', 'foo-2']);
    expect(result.templates['foo']).toBe('<div>old</div>');
    expect(result.templates['foo-2']).toBe('<div>new</div>');
    expect(result.sample['foo-2']).toBe('{"a":1}');
    expect(result.rules).toHaveLength(2);
    expect(result.rules[1]?.active).toBe(false);
    expect(result.rules[1]?.templateName).toBe('foo-2');
  });

  it('writes flagsDelta keyed by rule id / resolved template name', () => {
    const bundleWithFlag: FreshetBundle = {
      ...bundle,
      rules: [
        {
          id: 'rFlag',
          hostPattern: 'a',
          pathPattern: 'b',
          templateName: 'foo',
          active: true,
          variables: { auth_token: 'abc' },
        },
      ],
    };
    const result = applyImport({
      plan: {
        bundle: bundleWithFlag,
        mode: 'append',
        skipRuleIds: new Set(),
        skipTemplateNames: new Set(),
        templateCollisionResolution: new Map(),
        ruleCollisionResolution: new Map(),
        templateRenameMap: new Map(),
      },
      existingRules: [],
      existingTemplates: {},
      existingSample: {},
      now: '2026-04-19T00:00:00Z',
    });
    expect(result.flagsDelta['rFlag']).toBeDefined();
    expect(result.flagsDelta['rFlag']?.flags[0]?.pattern).toMatch(/token/);
  });
});
