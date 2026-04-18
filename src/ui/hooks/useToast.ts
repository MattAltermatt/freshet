import { useEffect, useState } from 'preact/hooks';

export type ToastVariant = 'success' | 'info' | 'danger';

export interface ToastInput {
  variant: ToastVariant;
  message: string;
  ttlMs?: number;             // default 2000 for success/info, 5000 for danger
  action?: { label: string; onClick: () => void };
}

export interface Toast extends ToastInput {
  id: string;
  createdAt: number;
}

type Listener = (toasts: Toast[]) => void;
const listeners = new Set<Listener>();
let state: Toast[] = [];

function emit(next: Toast[]): void {
  state = next;
  listeners.forEach((listener) => listener(state));
}

export function pushToastImpl(input: ToastInput): string {
  const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const toast: Toast = {
    ...input,
    id,
    createdAt: Date.now(),
    ttlMs: input.ttlMs ?? (input.variant === 'danger' ? 5000 : 2000),
  };
  emit([...state, toast]);
  if (toast.ttlMs && toast.ttlMs > 0) {
    setTimeout(() => dismissToastImpl(id), toast.ttlMs);
  }
  return id;
}

export function dismissToastImpl(id: string): void {
  emit(state.filter((t) => t.id !== id));
}

/** Dismiss all toasts immediately. Intended for test teardown and global cleanup. */
export function clearAllToasts(): void {
  emit([]);
}

export function useToast(): {
  toasts: Toast[];
  push: (input: ToastInput) => string;
  dismiss: (id: string) => void;
} {
  const [toasts, setToasts] = useState<Toast[]>(state);
  useEffect(() => {
    const listener: Listener = (next) => setToasts(next);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);
  return { toasts, push: pushToastImpl, dismiss: dismissToastImpl };
}
