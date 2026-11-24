import { createPortal } from 'react-dom';
import { AlertCircle, CheckCircle2, Info, Loader2 } from 'lucide-react';
import { useToastStore } from '../stores/toastStore';

const ICONS = {
  info: Info,
  success: CheckCircle2,
  error: AlertCircle,
  loading: Loader2,
} as const;

/** Renders UiService toasts (snackbars) above every screen. */
export const ToastHost = () => {
  const toasts = useToastStore((state) => state.toasts);

  if (toasts.length === 0) return null;

  return createPortal(
    <div className="toast-host" aria-live="polite">
      {toasts.map((toast) => {
        const Icon = ICONS[toast.kind];
        return (
          <div key={toast.id} className={`toast toast--${toast.kind}`}>
            <Icon
              size={17}
              className={toast.kind === 'loading' ? 'toast__icon spinner-icon' : 'toast__icon'}
            />
            <span>{toast.message}</span>
          </div>
        );
      })}
    </div>,
    document.body,
  );
};
