import { create } from 'zustand';

export type ToastKind = 'info' | 'success' | 'error' | 'loading';

export interface Toast {
  id: number;
  message: string;
  kind: ToastKind;
  /** Milliseconds; 0 = persistent (loading). */
  duration: number;
}

interface ToastState {
  toasts: Toast[];
  push: (toast: Omit<Toast, 'id'>) => number;
  dismiss: (id: number) => void;
  clear: () => void;
}

let nextId = 1;

/** Port of lib/services/ui_service.dart's snackbar layer. */
export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: (toast) => {
    const id = nextId++;
    // UiService calls hideCurrentSnackBar() before every snackbar, so only
    // the newest toast is ever visible.
    set({ toasts: [{ ...toast, id }] });
    if (toast.duration > 0) {
      window.setTimeout(() => {
        set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
      }, toast.duration);
    }
    return id;
  },
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
  clear: () => set({ toasts: [] }),
}));
