import { describe, it, expect } from 'vitest';
import { render } from './engine';
import fs from 'node:fs';
import path from 'node:path';

process.env.TZ = 'UTC';
const fxDir = path.resolve(__dirname, '../../test/fixtures/internal-user');

describe('internal-user fixture', () => {
  it('renders exactly the expected HTML', () => {
    const input = JSON.parse(fs.readFileSync(path.join(fxDir, 'input.json'), 'utf8'));
    const template = fs.readFileSync(path.join(fxDir, 'template.html'), 'utf8').trim();
    const expected = fs.readFileSync(path.join(fxDir, 'expected.html'), 'utf8').trim();
    const actual = render(template, input, {
      adminHost: 'qa-admin.server.com',
      env: 'qa',
    }).trim();
    expect(actual).toBe(expected);
  });
});
