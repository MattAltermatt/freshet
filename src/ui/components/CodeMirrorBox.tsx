import type { JSX } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import { EditorState, type Extension } from '@codemirror/state';
import { EditorView, lineNumbers, keymap, drawSelection } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';

export interface CodeMirrorBoxProps {
  value: string;
  onChange: (next: string) => void;
  extensions?: Extension[];
  minHeight?: string;
  readOnly?: boolean;
}

export function CodeMirrorBox({
  value,
  onChange,
  extensions = [],
  minHeight = '200px',
  readOnly = false,
}: CodeMirrorBoxProps): JSX.Element {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const suppressEmit = useRef(false);

  // Mount once.
  useEffect(() => {
    if (!host.current) return;
    const theme = EditorView.theme({
      '&': {
        height: '100%',
        minHeight,
        backgroundColor: 'var(--pj-bg-elevated)',
        color: 'var(--pj-fg)',
        border: '1px solid var(--pj-border)',
        borderRadius: 'var(--pj-radius)',
      },
      '.cm-scroller': {
        fontFamily: 'var(--pj-font-mono)',
        fontSize: 'var(--pj-font-size-md)',
      },
      '.cm-gutters': {
        backgroundColor: 'var(--pj-bg-subtle)',
        color: 'var(--pj-fg-subtle)',
        border: 0,
      },
      '.cm-activeLine': { backgroundColor: 'transparent' },
      '.cm-activeLineGutter': { backgroundColor: 'transparent' },
      '.cm-selectionBackground': {
        backgroundColor: 'var(--pj-selection-inactive)',
      },
      '&.cm-focused .cm-selectionBackground, ::selection': {
        backgroundColor: 'var(--pj-selection)',
      },
      '.cm-cursor, .cm-dropCursor': {
        borderLeftColor: 'var(--pj-fg)',
        borderLeftWidth: '2px',
      },
    });
    const updater = EditorView.updateListener.of((u) => {
      if (!u.docChanged) return;
      if (suppressEmit.current) return;
      onChangeRef.current(u.state.doc.toString());
    });
    const base: Extension[] = [
      lineNumbers(),
      history(),
      keymap.of([...defaultKeymap, ...historyKeymap]),
      drawSelection(),
      theme,
      updater,
    ];
    if (readOnly) base.push(EditorState.readOnly.of(true));
    view.current = new EditorView({
      state: EditorState.create({
        doc: value,
        extensions: [...base, ...extensions],
      }),
      parent: host.current,
    });
    return () => view.current?.destroy();
    // Extensions + mount only once; value sync handled in the other effect.
  }, []);

  // Sync value prop → editor doc.
  useEffect(() => {
    const v = view.current;
    if (!v) return;
    const current = v.state.doc.toString();
    if (current !== value) {
      suppressEmit.current = true;
      v.dispatch({ changes: { from: 0, to: current.length, insert: value } });
      suppressEmit.current = false;
    }
  }, [value]);

  return <div class="pj-cm-box" ref={host} style={{ minHeight }} />;
}
