import { describe, it, expect } from 'vitest';
import { sanitize } from './sanitize';

describe('sanitize', () => {
  it('removes <script> tags including content', () => {
    expect(sanitize('<p>ok</p><script>alert(1)</script>')).toBe('<p>ok</p>');
  });
  it('removes <script> tags with attributes', () => {
    expect(sanitize('<script src="x.js"></script><p>ok</p>')).toBe('<p>ok</p>');
  });
  it('removes inline event handlers', () => {
    expect(sanitize('<button onclick="bad()">x</button>')).toBe('<button>x</button>');
    expect(sanitize('<img onerror="y">')).toBe('<img>');
  });
  it('removes unquoted inline event handlers', () => {
    expect(sanitize('<img onerror=alert(1)>')).toBe('<img>');
    expect(sanitize('<div onclick=bad>x</div>')).toBe('<div>x</div>');
  });
  it('removes inline handlers with slash separator (bypass attempt)', () => {
    // `<img/onerror=...>` is valid HTML — `/` is an allowed attribute
    // separator, so the sanitizer must strip handlers introduced that way.
    expect(sanitize('<img/onerror=alert(1)>')).not.toContain('onerror');
    expect(sanitize('<img/onerror="alert(1)">')).not.toContain('onerror');
    expect(sanitize("<img/onerror='alert(1)'>")).not.toContain('onerror');
    expect(sanitize('<svg/onload=alert(1)>')).not.toContain('onload');
  });
  it('neutralizes data: URLs in href/src', () => {
    expect(sanitize('<a href="data:text/html,x">x</a>')).toBe('<a href="about:blank">x</a>');
  });
  it('removes <iframe>, <link>, <object>, <embed>', () => {
    expect(sanitize('<p>a</p><iframe src="x"></iframe>')).toBe('<p>a</p>');
    expect(sanitize('<link rel="import" href="x">')).toBe('');
    expect(sanitize('<object data="x"></object>')).toBe('');
    expect(sanitize('<embed src="x">')).toBe('');
  });
  it('neutralizes javascript: URLs in href/src', () => {
    expect(sanitize('<a href="javascript:bad()">x</a>')).toBe('<a href="about:blank">x</a>');
    expect(sanitize('<a href="JavaScript:bad()">x</a>')).toBe('<a href="about:blank">x</a>');
  });
  it('leaves safe HTML alone', () => {
    const safe = '<div class="row"><a href="https://x.com/?q=1">link</a></div>';
    expect(sanitize(safe)).toBe(safe);
  });
});
