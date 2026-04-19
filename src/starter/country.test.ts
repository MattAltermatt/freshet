import { describe, it, expect } from 'vitest';
import { render } from '../engine/engine';
import fs from 'node:fs';
import path from 'node:path';

const templatePath = path.resolve(__dirname, './country.html');
const samplePath = path.resolve(__dirname, './country.sample.json');
const template = fs.readFileSync(templatePath, 'utf8');
const sample = JSON.parse(fs.readFileSync(samplePath, 'utf8'));

describe('country starter template', () => {
  const html = render(template, sample, {});

  it('handles array-root JSON via items[0] assignment', () => {
    // Top-level JSON is `[ {Japan} ]` — template's first line `{% assign c = items[0] %}`
    // must work for the rest of the template to find anything.
    expect(html).toContain('>Japan</h1>');
  });

  it('renders the flag emoji from the JSON', () => {
    expect(html).toContain('🇯🇵');
  });

  it('renders capital, population (compacted), and area', () => {
    expect(html).toContain('>Tokyo</span>');
    expect(html).toContain('126M');
    expect(html).toContain('378k');
  });

  it('iterates the languages object via 2-tuple form', () => {
    expect(html).toContain('JPN');
    expect(html).toContain('Japanese');
  });

  it('iterates the currencies object surfacing name + symbol', () => {
    expect(html).toContain('JPY');
    expect(html).toContain('Japanese yen');
    expect(html).toContain('¥');
  });

  it('renders region, subregion, and continent chips', () => {
    expect(html).toContain('>Asia</li>');
    expect(html).toContain('>Eastern Asia</li>');
  });

  it('renders timezone chips', () => {
    expect(html).toContain('UTC+09:00');
  });

  it('builds Wikipedia link from c.name.common (URL-from-ID demo)', () => {
    expect(html).toContain('href="https://en.wikipedia.org/wiki/Japan"');
  });

  it('iterates nativeName entries showing language code + native name', () => {
    expect(html).toContain('日本');
  });
});
