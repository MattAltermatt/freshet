import type { KnownViewer } from '../shared/types';

export interface ViewerFingerprint {
  id: KnownViewer;
  displayName: string;
  extensionId: string;
  matches(doc: Document): boolean;
}

/**
 * Extension IDs + selectors verified from each viewer's open-source repo. See
 * `test/fixtures/conflicts/notes.md` for the source-of-truth links and the
 * update procedure when a viewer ships a DOM change.
 */
const FINGERPRINTS: readonly ViewerFingerprint[] = [
  {
    id: 'jsonview',
    displayName: 'JSONView',
    extensionId: 'gmegofmjomhknnokphhckolhcffdaihd',
    matches: (doc) => doc.querySelector('#json > ul.collapsible') !== null,
  },
  {
    id: 'json-formatter',
    displayName: 'JSON Formatter',
    extensionId: 'bcjindcccaagfpapjjmafapmmgkkhgoa',
    matches: (doc) => {
      const el = doc.body?.firstElementChild;
      return el?.classList.contains('blockInner') ?? false;
    },
  },
  {
    id: 'json-viewer-pro',
    displayName: 'JSON Viewer Pro',
    extensionId: 'gbmdgpbipfallnflgajpaliibnhdgobh',
    matches: (doc) => {
      for (const child of Array.from(doc.body?.children ?? [])) {
        if (child.classList.contains('CodeMirror')) return true;
      }
      return false;
    },
  },
];

export type ConflictReport =
  | { ok: true }
  | { ok: 'rescued'; rescuedJson: string }
  | {
      ok: false;
      viewer: KnownViewer;
      displayName: string;
      extensionId: string;
    }
  | {
      ok: false;
      viewer: 'unknown';
      displayName: 'Another JSON viewer';
      extensionId: null;
    };

function tryPreRescue(doc: Document): string | null {
  const pre = doc.body?.querySelector('pre');
  if (!pre) return null;
  const text = pre.textContent?.trim() ?? '';
  if (!text) return null;
  if (!text.startsWith('{') && !text.startsWith('[')) return null;
  try {
    JSON.parse(text);
    return text;
  } catch {
    return null;
  }
}

function matchFingerprint(doc: Document): ViewerFingerprint | null {
  for (const fp of FINGERPRINTS) {
    if (fp.matches(doc)) return fp;
  }
  return null;
}

function looksLikeUnknownViewer(doc: Document): boolean {
  if (!doc.body) return false;
  if (doc.body.querySelector('pre')) return false;
  // Any element whose class name hints at JSON handling.
  if (doc.body.querySelector('[class*="json" i]')) return true;
  // Or any element with a data-json* attribute.
  for (const el of Array.from(doc.body.querySelectorAll('*'))) {
    for (const attr of Array.from(el.attributes)) {
      if (attr.name.startsWith('data-json')) return true;
    }
  }
  return false;
}

/**
 * Pure core: takes a Document (either real `document` from the content script
 * or a `JSDOM(html).window.document` in tests) and reports whether another
 * JSON viewer is active. First match wins:
 *
 *   1. <pre> rescue — silent success path; returns the raw JSON text so the
 *      caller can render normally.
 *   2. Named viewer fingerprint.
 *   3. Unknown-viewer fallback (DOM looks mutated but we can't identify).
 *   4. Otherwise clean.
 */
export function detectConflict(doc: Document): ConflictReport {
  const rescued = tryPreRescue(doc);
  if (rescued !== null) return { ok: 'rescued', rescuedJson: rescued };

  const fp = matchFingerprint(doc);
  if (fp) {
    return {
      ok: false,
      viewer: fp.id,
      displayName: fp.displayName,
      extensionId: fp.extensionId,
    };
  }

  if (looksLikeUnknownViewer(doc)) {
    return {
      ok: false,
      viewer: 'unknown',
      displayName: 'Another JSON viewer',
      extensionId: null,
    };
  }

  return { ok: true };
}
