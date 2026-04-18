import type { JSX } from 'preact';
import { Toast } from './Toast';
import { useToast } from '../hooks/useToast';

export function ToastHost(): JSX.Element {
  const { toasts, dismiss } = useToast();
  return (
    <div class="pj-toast-host" role="status" aria-live="polite" aria-atomic="false">
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} onDismiss={dismiss} />
      ))}
    </div>
  );
}
