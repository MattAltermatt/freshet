import { describe, it, expect } from 'vitest';
import { sniff } from './sniff';
import type { FreshetBundle } from './schema';

function mk(partial: Partial<FreshetBundle> = {}): FreshetBundle {
  return {
    bundleSchemaVersion: 1,
    exportedAt: '2026-04-19T00:00:00Z',
    appVersion: '1.0.0',
    templates: [],
    rules: [],
    ...partial,
  };
}

describe('sniff', () => {
  it('returns no hits on a clean bundle', () => {
    const hits = sniff(mk({ templates: [{ name: 't', source: 'x' }] }));
    expect(hits).toEqual([]);
  });

  it('flags KEY_SECRETY on rule.variables key `auth_token`', () => {
    const hits = sniff(
      mk({
        templates: [{ name: 't', source: 'x' }],
        rules: [
          {
            id: 'r',
            hostPattern: 'a',
            pathPattern: 'b',
            templateName: 't',
            active: true,
            variables: { auth_token: 'abc' },
          },
        ],
      }),
    );
    expect(hits).toHaveLength(1);
    expect(hits[0]?.patternId).toBe('KEY_SECRETY');
    expect(hits[0]?.field).toBe('rules[0].variables.auth_token');
    expect(hits[0]?.matchedText).toBe('auth_token');
  });

  it('flags BEARER_PREFIX on rule.variables value', () => {
    const hits = sniff(
      mk({
        templates: [{ name: 't', source: 'x' }],
        rules: [
          {
            id: 'r',
            hostPattern: 'a',
            pathPattern: 'b',
            templateName: 't',
            active: true,
            variables: { header: 'Bearer abc123' },
          },
        ],
      }),
    );
    const ids = hits.map((h) => h.patternId);
    expect(ids).toContain('BEARER_PREFIX');
  });

  it('flags JWT in sample JSON nested string value', () => {
    const sampleJson = JSON.stringify({
      resp: { auth: 'eyJhbGciOi.eyJzdWIi.signature' },
    });
    const hits = sniff(
      mk({ templates: [{ name: 't', source: 'x', sampleJson }], rules: [] }),
    );
    const ids = hits.map((h) => h.patternId);
    expect(ids).toContain('JWT');
    expect(hits.find((h) => h.patternId === 'JWT')?.field).toBe(
      'templates[0].sampleJson.resp.auth',
    );
  });

  it('does not throw on malformed sampleJson', () => {
    const hits = sniff(
      mk({
        templates: [{ name: 't', source: 'x', sampleJson: '{not valid' }],
      }),
    );
    expect(Array.isArray(hits)).toBe(true);
  });

  it('does not flag regular field names like `title` or `id`', () => {
    const sampleJson = JSON.stringify({ title: 'hi', id: 'x1' });
    const hits = sniff(
      mk({ templates: [{ name: 't', source: 'x', sampleJson }] }),
    );
    expect(hits).toEqual([]);
  });

  it('exports a readable patternRegex string on every hit', () => {
    const hits = sniff(
      mk({
        templates: [{ name: 't', source: 'x' }],
        rules: [
          {
            id: 'r',
            hostPattern: 'a',
            pathPattern: 'b',
            templateName: 't',
            active: true,
            variables: { api_key: 'x' },
          },
        ],
      }),
    );
    expect(hits[0]?.patternRegex).toMatch(/^\/.+\/[gimsuy]*$/);
  });
});
