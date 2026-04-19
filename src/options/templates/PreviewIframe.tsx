import type { JSX } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import { render as renderTemplate } from '../../engine/engine';
import { useDebounce, useStorage } from '../../ui';
import { resolveTheme, type ThemePreference } from '../../ui/theme';
import type { Variables } from '../../shared/types';

export interface PreviewIframeProps {
  template: string;
  sampleJsonText: string;
  vars: Variables;
}

export function PreviewIframe({
  template,
  sampleJsonText,
  vars,
}: PreviewIframeProps): JSX.Element {
  const frame = useRef<HTMLIFrameElement>(null);
  const debouncedTpl = useDebounce(template, 250);
  const debouncedJson = useDebounce(sampleJsonText, 250);
  const [settings] = useStorage<'settings', { themePreference: ThemePreference }>(
    'settings',
    { themePreference: 'system' },
  );
  const theme = resolveTheme(settings.themePreference);

  useEffect(() => {
    let data: unknown = {};
    let jsonError: string | null = null;
    if (debouncedJson.trim()) {
      try {
        data = JSON.parse(debouncedJson);
      } catch (err) {
        jsonError = (err as Error).message;
      }
    }

    let body: string;
    if (jsonError) {
      body = `<pre style="color:#b91c1c;font-family:ui-monospace,Menlo,monospace;padding:8px">Sample JSON parse error: ${escapeHtml(
        jsonError,
      )}</pre>`;
    } else {
      try {
        body = renderTemplate(debouncedTpl, data, vars);
      } catch (err) {
        body = `<pre style="color:#b91c1c;font-family:ui-monospace,Menlo,monospace;padding:8px">Template error: ${escapeHtml(
          (err as Error).message,
        )}</pre>`;
      }
    }

    // Wrap in a doc with data-theme so templates that ship light + dark
    // variants render in the user's chosen Freshet theme inside the preview.
    const doc = `<!doctype html><html data-theme="${theme}"><body>${body}</body></html>`;
    if (frame.current) frame.current.srcdoc = doc;
  }, [debouncedTpl, debouncedJson, vars, theme]);

  return (
    <iframe
      class="pj-preview-iframe"
      // Empty sandbox: no script exec, no same-origin access to storage /
      // cookies. The preview only renders HTML; any stray on* handler that
      // slips past `sanitize()` can't reach extension APIs from a sandboxed
      // null-origin iframe.
      sandbox=""
      ref={frame}
      title="Template preview"
    />
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
