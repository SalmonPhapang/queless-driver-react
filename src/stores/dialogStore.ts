import { create } from 'zustand';

export interface AppDialogConfig {
  title: string;
  message: string;
  icon?: 'success' | 'info' | 'warning';
  confirmLabel?: string;
  /** When false the dialog cannot be dismissed (barrierDismissible: false). */
  dismissible?: boolean;
  resolve: () => void;
}

interface DialogState {
  dialog: AppDialogConfig | null;
  open: (config: AppDialogConfig) => void;
  close: () => void;
}

/** Modal equivalent of UiService.showSuccessDialog / showDialog. */
export const useDialogStore = create<DialogState>((set, get) => ({
  dialog: null,
  open: (config) => set({ dialog: config }),
  close: () => {
    const dialog = get().dialog;
    set({ dialog: null });
    dialog?.resolve();
  },
}));
