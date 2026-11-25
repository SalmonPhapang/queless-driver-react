import { create } from 'zustand';

export type ToastKind = 'info' | 'success' | 'error' | 'loading';

export interface Toast {
  id: number;
  message: string;
  kind: ToastKind;
  duration: number;
}

interface ToastState {
  toasts: Toast[];
  push: (toast: Omit<Toast, 'id'>) => number;
  dismiss: (id: number) => void;
  clear: () => void;
}

let nextId = 1;

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: (toast) => {
    const id = nextId++;
    set({ toasts: [{ ...toast, id }] });
    if (toast.duration > 0) {
      setTimeout(() => {
        set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
      }, toast.duration);
    }
    return id;
  },
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
  clear: () => set({ toasts: [] }),
}));
