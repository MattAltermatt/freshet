import type { JSX } from 'preact';
import type { ConflictEntry } from '../shared/types';

export interface ConflictSectionProps {
  host: string;
  entry: ConflictEntry;
  onDismiss: () => void;
  onSkipHost: () => void;
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffSec = Math.max(0, Math.round((now - then) / 1000));
  if (diffSec < 30) return 'just now';
  if (diffSec < 90) return '1 min ago';
  const mins = Math.round(diffSec / 60);
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  const days = Math.round(hrs / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

function disableUrl(entry: ConflictEntry): string {
  if (entry.extensionId) return `chrome://extensions/?id=${entry.extensionId}`;
  return 'chrome://extensions/';
}

function disableLinkLabel(entry: ConflictEntry): string {
  if (entry.extensionId) return `Open ${entry.displayName} settings →`;
  return 'Open Chrome extensions →';
}

export function ConflictSection(props: ConflictSectionProps): JSX.Element {
  const { entry } = props;
  const headline = entry.extensionId
    ? `${entry.displayName} is formatting this page. Freshet can't render over it.`
    : `Another JSON viewer is formatting this page. Freshet can't render over it.`;

  return (
    <section class="pj-conflict" aria-label="Another viewer is active">
      <header class="pj-conflict-head">
        <span class="pj-conflict-icon" aria-hidden="true">⚠</span>
        <strong>Another viewer is active</strong>
      </header>
      <p class="pj-conflict-body">{headline}</p>
      {!entry.extensionId ? (
        <p class="pj-conflict-hint">Look for an extension that formats JSON.</p>
      ) : null}
      <a
        class="pj-btn pj-btn--accent pj-conflict-disable"
        href={disableUrl(entry)}
        target="_blank"
        rel="noopener noreferrer"
      >
        {disableLinkLabel(entry)}
      </a>
      <div class="pj-conflict-secondary">
        <button type="button" class="pj-btn" onClick={props.onSkipHost}>
          Skip this host
        </button>
        <button type="button" class="pj-btn" onClick={props.onDismiss}>
          Dismiss
        </button>
      </div>
      <p class="pj-conflict-when">Detected {relativeTime(entry.detectedAt)}</p>
    </section>
  );
}
