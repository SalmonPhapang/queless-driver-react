import { useDialogStore } from '../stores/dialogStore';
import { useToastStore } from '../stores/toastStore';

export interface SnackBarAction {
  label: string;
  onPressed: () => void;
}

export const UiService = {
  showSnackBar(
    message: string,
    options: {
      isError?: boolean;
      isSuccess?: boolean;
      duration?: number;
      action?: SnackBarAction;
    } = {},
  ): void {
    const kind = options.isError ? 'error' : options.isSuccess ? 'success' : 'info';
    useToastStore.getState().push({
      message,
      kind,
      duration: options.duration ?? 4000,
    });
  },

  showSuccess(message: string): void {
    UiService.showSnackBar(message, { isSuccess: true });
  },

  showError(message: string): void {
    UiService.showSnackBar(message, { isError: true });
  },

  showInfo(message: string, options: { duration?: number } = {}): void {
    UiService.showSnackBar(message, { duration: options.duration });
  },

  showSuccessDialog({
    title,
    message,
    icon = 'success',
  }: {
    title: string;
    message: string;
    icon?: 'success' | 'info' | 'warning';
  }): Promise<void> {
    return new Promise((resolve) => {
      useDialogStore.getState().open({
        title,
        message,
        icon,
        confirmLabel: 'OK',
        dismissible: false,
        resolve,
      });
    });
  },

  showLoading(message: string): void {
    useToastStore.getState().push({ message, kind: 'loading', duration: 0 });
  },

  hideSnackBar(): void {
    useToastStore.getState().clear();
  },
};
