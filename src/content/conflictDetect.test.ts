import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';
import { detectConflict } from './conflictDetect';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.resolve(__dirname, '../../test/fixtures/conflicts');

function docFromHtml(html: string): Document {
  return new JSDOM(html).window.document;
}

function docFromFixture(name: string): Document {
  return docFromHtml(readFileSync(path.join(FIXTURES, name), 'utf8'));
}

describe('detectConflict', () => {
  it('returns ok=true on a clean non-JSON page', () => {
    const doc = docFromHtml('<!doctype html><body><p>hello</p></body>');
    expect(detectConflict(doc)).toEqual({ ok: true });
  });

  it('rescues Chrome native <pre>-wrapped JSON', () => {
    const doc = docFromHtml(
      '<!doctype html><body><pre>{"a":1,"b":"x"}</pre></body>',
    );
    const r = detectConflict(doc);
    expect(r).toEqual({ ok: 'rescued', rescuedJson: '{"a":1,"b":"x"}' });
  });

  it('rescues arrays in <pre>', () => {
    const doc = docFromHtml('<!doctype html><body><pre>[1,2,3]</pre></body>');
    const r = detectConflict(doc);
    expect(r).toEqual({ ok: 'rescued', rescuedJson: '[1,2,3]' });
  });

  it('does not rescue malformed <pre> content; falls through', () => {
    const doc = docFromHtml('<!doctype html><body><pre>{not-json</pre></body>');
    const r = detectConflict(doc);
    expect(r).toEqual({ ok: true });
  });

  it('fingerprints JSONView from the captured fixture', () => {
    const doc = docFromFixture('jsonview.html');
    const r = detectConflict(doc);
    expect(r.ok).toBe(false);
    if (r.ok === false) {
      expect(r.viewer).toBe('jsonview');
      expect(r.displayName).toBe('JSONView');
      expect(r.extensionId).toMatch(/^[a-p]{32}$/);
    }
  });

  it('fingerprints JSON Formatter from the captured fixture', () => {
    const doc = docFromFixture('json-formatter.html');
    const r = detectConflict(doc);
    expect(r.ok).toBe(false);
    if (r.ok === false) expect(r.viewer).toBe('json-formatter');
  });

  it('fingerprints JSON Viewer Pro from the captured fixture', () => {
    const doc = docFromFixture('json-viewer-pro.html');
    const r = detectConflict(doc);
    expect(r.ok).toBe(false);
    if (r.ok === false) expect(r.viewer).toBe('json-viewer-pro');
  });

  it('falls back to unknown viewer when no fingerprint matches but DOM looks mutated', () => {
    const doc = docFromHtml(
      '<!doctype html><body><div class="json-tree"><div class="json-key">a</div></div></body>',
    );
    const r = detectConflict(doc);
    expect(r.ok).toBe(false);
    if (r.ok === false) {
      expect(r.viewer).toBe('unknown');
      expect(r.displayName).toBe('Another JSON viewer');
      expect(r.extensionId).toBeNull();
    }
  });

  it('<pre> rescue wins over fingerprint when both are present', () => {
    const doc = docFromHtml(
      '<!doctype html><body><pre>{"ok":true}</pre><div id="json"><ul class="obj collapsible"></ul></div></body>',
    );
    const r = detectConflict(doc);
    expect(r).toEqual({ ok: 'rescued', rescuedJson: '{"ok":true}' });
  });
});
