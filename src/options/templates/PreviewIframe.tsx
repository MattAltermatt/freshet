import type { JSX } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import { render as renderTemplate } from '../../engine/engine';
import { useDebounce } from '../../ui';
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

    let html: string;
    if (jsonError) {
      html = `<pre style="color:#b91c1c;font-family:ui-monospace,Menlo,monospace;padding:8px">Sample JSON parse error: ${escapeHtml(
        jsonError,
      )}</pre>`;
    } else {
      try {
        html = renderTemplate(debouncedTpl, data, vars);
      } catch (err) {
        html = `<pre style="color:#b91c1c;font-family:ui-monospace,Menlo,monospace;padding:8px">Template error: ${escapeHtml(
          (err as Error).message,
        )}</pre>`;
      }
    }

    if (frame.current) frame.current.srcdoc = html;
  }, [debouncedTpl, debouncedJson, vars]);

  return (
    <iframe
      class="pj-preview-iframe"
      sandbox="allow-same-origin"
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
