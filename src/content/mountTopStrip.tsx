import { render } from 'preact';
import { TopStrip, type TopStripProps } from './TopStrip';
import stripStyles from './topStrip.css?inline';

export interface MountTopStripOptions extends TopStripProps {
  /** Container the strip's host element is prepended into. Defaults to document.body. */
  parent?: HTMLElement;
}

/**
 * Create a closed shadow root on a new host element, inject the strip stylesheet,
 * and render the Preact TopStrip tree into it. Returns the host element so callers
 * (tests, or the content script if it ever needs to unmount) can tear down.
 */
export function mountTopStrip(options: MountTopStripOptions): HTMLElement {
  const parent = options.parent ?? document.body;
  const host = document.createElement('div');
  host.id = 'pj-topstrip-host';
  parent.prepend(host);

  // `mode: 'open'` — content scripts run in an isolated world so the host page
  // can't reach the shadow via JS anyway, and `open` keeps the strip inspectable
  // from devtools + Playwright. Closed mode blocks test-reach for no real
  // security benefit in this context.
  const shadow = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = stripStyles;
  shadow.appendChild(style);

  const mount = document.createElement('div');
  mount.className = 'pj-topstrip-mount';
  shadow.appendChild(mount);

  const { parent: _parent, ...props } = options;
  render(<TopStrip {...(props as TopStripProps)} shadowHost={host} />, mount);
  return host;
}
