import { describe, it, expect } from 'vitest';
import { validateBundle, type FreshetBundle } from './schema';

const mkBundle = (override: Partial<FreshetBundle> = {}): unknown => ({
  bundleSchemaVersion: 1,
  exportedAt: '2026-04-19T00:00:00Z',
  appVersion: '1.0.0',
  templates: [{ name: 't1', source: '<div>{{x}}</div>' }],
  rules: [
    {
      id: 'r1',
      hostPattern: 'api.x.com',
      pathPattern: '/**',
      templateName: 't1',
      active: true,
    },
  ],
  ...override,
});

describe('validateBundle', () => {
  it('accepts a minimal valid bundle', () => {
    const r = validateBundle(mkBundle());
    expect(r.ok).toBe(true);
  });

  it('rejects wrong schema version', () => {
    const r = validateBundle(mkBundle({ bundleSchemaVersion: 2 as 1 }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]).toMatch(/bundleSchemaVersion/);
  });

  it('rejects rule referencing non-existent template', () => {
    const r = validateBundle(
      mkBundle({
        rules: [
          {
            id: 'r1',
            hostPattern: 'api.x.com',
            pathPattern: '/**',
            templateName: 'missing',
            active: true,
          },
        ],
      }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join('\n')).toMatch(/templateName.*missing/);
  });

  it('rejects duplicate template names', () => {
    const r = validateBundle(
      mkBundle({
        templates: [
          { name: 'dup', source: 'a' },
          { name: 'dup', source: 'b' },
        ],
        rules: [],
      }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join('\n')).toMatch(/duplicate/i);
  });

  it('keeps sampleJson as string (never parsed)', () => {
    const r = validateBundle(
      mkBundle({
        templates: [{ name: 't1', source: 'x', sampleJson: '{"unterminated' }],
        rules: [],
      }),
    );
    expect(r.ok).toBe(true);
  });

  it('drops unknown top-level keys', () => {
    const r = validateBundle({ ...(mkBundle() as object), unknownKey: 'x' });
    expect(r.ok).toBe(true);
  });
});
