import { describe, it, expect } from 'vitest';
import { render } from '../engine/engine';
import fs from 'node:fs';
import path from 'node:path';

const templatePath = path.resolve(__dirname, './pokemon.html');
const samplePath = path.resolve(__dirname, './pokemon.sample.json');
const template = fs.readFileSync(templatePath, 'utf8');
const sample = JSON.parse(fs.readFileSync(samplePath, 'utf8'));

describe('pokemon starter template', () => {
  const html = render(template, sample, {});

  it('renders the zero-padded dex id', () => {
    expect(html).toContain('#0025');
  });

  it('renders the capitalized name', () => {
    expect(html).toContain('>Pikachu</h1>');
  });

  it('renders type chips with data-type attribute for color hooks', () => {
    expect(html).toContain('data-type="electric"');
    expect(html).toContain('>electric</li>');
  });

  it('renders the official-artwork sprite URL via bracket access', () => {
    expect(html).toContain('https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/25.png');
  });

  it('converts pokeapi height (dm) and weight (hg) to m and kg', () => {
    expect(html).toContain('0.4 m');
    expect(html).toContain('6 kg');
  });

  it('iterates stats with width-based bars', () => {
    expect(html).toContain('data-stat="hp"');
    expect(html).toContain('width: 35%');
    expect(html).toContain('data-stat="speed"');
    expect(html).toContain('width: 90%');
  });

  it('humanizes the special-attack stat label', () => {
    expect(html).toContain('Special attack');
  });

  it('marks hidden abilities', () => {
    expect(html).toContain('Lightning rod');
    expect(html).toContain('>hidden</span>');
    expect(html).toContain('Static');
  });

  it('builds Bulbapedia link from the name (URL-from-ID demo)', () => {
    expect(html).toContain('href="https://bulbapedia.bulbagarden.net/wiki/Pikachu_(Pok');
  });
});
