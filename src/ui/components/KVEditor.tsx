import type { JSX } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';

export interface KVEditorProps {
  value: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
  addLabel?: string;
}

interface Row {
  id: number;
  key: string;
  value: string;
}

function toRows(value: Record<string, string>, nextId: () => number): Row[] {
  return Object.entries(value).map(([k, v]) => ({ id: nextId(), key: k, value: v }));
}

function toObject(rows: Row[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const r of rows) if (r.key) out[r.key] = r.value;
  return out;
}

function shallowEqual(a: Record<string, string>, b: Record<string, string>): boolean {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  for (const k of aKeys) if (a[k] !== b[k]) return false;
  return true;
}

export function KVEditor({
  value,
  onChange,
  addLabel = '+ Add variable',
}: KVEditorProps): JSX.Element {
  const idRef = useRef(0);
  const next = () => ++idRef.current;

  const [rows, setRows] = useState<Row[]>(() => toRows(value, next));
  const lastEmittedRef = useRef<Record<string, string>>(toObject(rows));

  // Re-sync from prop only when the prop diverges from our last emission
  // (avoids clobbering the user's in-flight dup-key typing).
  useEffect(() => {
    if (!shallowEqual(value, lastEmittedRef.current)) {
      setRows(toRows(value, next));
      lastEmittedRef.current = value;
    }
  }, [value]);

  const dupKeys = useMemo(() => {
    const seen = new Set<string>();
    const dup = new Set<string>();
    for (const r of rows) {
      if (!r.key) continue;
      if (seen.has(r.key)) dup.add(r.key);
      else seen.add(r.key);
    }
    return dup;
  }, [rows]);

  const commit = (nextRows: Row[]): void => {
    setRows(nextRows);
    const obj = toObject(nextRows);
    // Only emit when there are no duplicate keys; otherwise user state is in-flight.
    const hasDup = (() => {
      const seen = new Set<string>();
      for (const r of nextRows) {
        if (!r.key) continue;
        if (seen.has(r.key)) return true;
        seen.add(r.key);
      }
      return false;
    })();
    if (!hasDup && !shallowEqual(obj, lastEmittedRef.current)) {
      lastEmittedRef.current = obj;
      onChange(obj);
    }
  };

  const update = (idx: number, patch: Partial<Row>): void => {
    commit(rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };

  const remove = (idx: number): void => {
    commit(rows.filter((_, i) => i !== idx));
  };

  const add = (): void => {
    commit([...rows, { id: next(), key: '', value: '' }]);
  };

  return (
    <div class="pj-kv-editor">
      {rows.map((r, i) => (
        <div class="pj-kv-row" key={r.id}>
          <input
            type="text"
            placeholder="key"
            value={r.key}
            class={`pj-kv-key${dupKeys.has(r.key) ? ' pj-invalid' : ''}`}
            onInput={(e) => update(i, { key: (e.target as HTMLInputElement).value })}
          />
          <span class="pj-kv-eq">=</span>
          <input
            type="text"
            placeholder="value"
            value={r.value}
            class="pj-kv-value"
            onInput={(e) => update(i, { value: (e.target as HTMLInputElement).value })}
          />
          <button
            type="button"
            class="pj-kv-remove"
            aria-label={`remove ${r.key || 'blank'}`}
            onClick={() => remove(i)}
          >
            ✕
          </button>
          {dupKeys.has(r.key) ? <div class="pj-kv-err">duplicate key</div> : null}
        </div>
      ))}
      <button type="button" class="pj-kv-add" onClick={add}>
        {addLabel}
      </button>
    </div>
  );
}
