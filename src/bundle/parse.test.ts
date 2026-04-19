import { describe, it, expect } from 'vitest';
import { parseBundle } from './parse';

const valid = JSON.stringify({
  bundleSchemaVersion: 1,
  exportedAt: '2026-04-19T00:00:00Z',
  appVersion: '1.0.0',
  templates: [{ name: 't', source: 'x' }],
  rules: [
    { id: 'r', hostPattern: 'a', pathPattern: 'b', templateName: 't', active: true },
  ],
});

describe('parseBundle', () => {
  it('parses a valid JSON string', () => {
    const r = parseBundle(valid);
    expect(r.ok).toBe(true);
  });

  it('returns a JSON parse error for malformed JSON', () => {
    const r = parseBundle('{ not valid');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]).toMatch(/JSON/);
  });

  it('returns validation errors for wrong schema', () => {
    const r = parseBundle('{"bundleSchemaVersion":99}');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join('\n')).toMatch(/bundleSchemaVersion/);
  });

  it('accepts arbitrary string for sampleJson (no re-parse)', () => {
    const withBadSample = JSON.stringify({
      bundleSchemaVersion: 1,
      exportedAt: 'x',
      appVersion: '1.0.0',
      templates: [{ name: 't', source: 'x', sampleJson: '{not json' }],
      rules: [],
    });
    const r = parseBundle(withBadSample);
    expect(r.ok).toBe(true);
  });
});
