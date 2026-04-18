import type { JSX } from 'preact';
import type { Toast as ToastModel } from '../hooks/useToast';

interface ToastProps {
  toast: ToastModel;
  onDismiss: (id: string) => void;
}

export function Toast({ toast, onDismiss }: ToastProps): JSX.Element {
  return (
    <div class={`pj-toast pj-toast--${toast.variant}`}>
      <span class="pj-toast__message">{toast.message}</span>
      {toast.action && (
        <button
          type="button"
          class="pj-toast__action"
          onClick={() => {
            toast.action!.onClick();
            onDismiss(toast.id);
          }}
        >
          {toast.action.label}
        </button>
      )}
    </div>
  );
}
