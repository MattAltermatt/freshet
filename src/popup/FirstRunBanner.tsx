import type { JSX } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { useStorage } from '../ui/hooks/useStorage';
import type { Rule } from '../shared/types';

export const TRY_PAGE_URL = 'https://mattaltermatt.github.io/freshet/try/';

export interface FirstRunBannerProps {
  rules: Rule[];
}

/**
 * Welcome card shown in the popup until either (a) the user dismisses it or
 * (b) they create their own rule. Once dismissed it never reappears, even
 * across reinstall/restore — the dismissed flag is sticky in chrome.storage.local.
 *
 * We deliberately suppress the banner the moment the user has any non-example
 * rule — that signals they're past the first-run "what is this?" moment, so
 * the welcome nudge would be noise.
 *
 * The `loaded` gate keeps the banner from flashing on every popup open for
 * dismissed users: useStorage initializes synchronously with the fallback
 * `false`, then the chrome.storage.local.get callback resolves async — without
 * this gate, the banner renders for one frame before the read returns and
 * hides it. Wait for the read to complete before deciding whether to render.
 */
export function FirstRunBanner({ rules }: FirstRunBannerProps): JSX.Element | null {
  const [dismissed, setDismissed] = useStorage<'pj_first_run_dismissed', boolean>(
    'pj_first_run_dismissed',
    false,
  );
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    chrome.storage.local.get('pj_first_run_dismissed', () => setLoaded(true));
  }, []);

  if (!loaded) return null;
  const hasUserRules = rules.some((r) => !r.isExample);
  if (dismissed || hasUserRules) return null;

  const tryDemos = (): void => {
    void setDismissed(true);
    void chrome.tabs.create({ url: TRY_PAGE_URL });
    window.close();
  };

  return (
    <aside class="pj-first-run" role="region" aria-label="Welcome">
      <span class="pj-first-run__glyph" aria-hidden="true">
        <span class="pj-logo-brace">{'{'}</span>
        <span class="pj-logo-bracket">{'>'}</span>
      </span>
      <div class="pj-first-run__body">
        <p class="pj-first-run__title">Welcome to Freshet</p>
        <p class="pj-first-run__sub">Try it on a sample page to see what it does.</p>
      </div>
      <button
        type="button"
        class="pj-first-run__cta"
        onClick={tryDemos}
      >
        Try the demos →
      </button>
      <button
        type="button"
        class="pj-first-run__close"
        aria-label="Dismiss welcome"
        onClick={() => void setDismissed(true)}
      >
        ×
      </button>
    </aside>
  );
}
