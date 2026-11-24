import { AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import { useDialogStore } from '../stores/dialogStore';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';

const ICON_CONFIG = {
  success: { Icon: CheckCircle2, color: 'var(--success)', background: 'var(--success-soft)' },
  info: { Icon: Info, color: 'var(--info)', background: 'var(--info-soft)' },
  warning: { Icon: AlertTriangle, color: 'var(--warning)', background: 'var(--warning-soft)' },
} as const;

/** Host for UiService.showSuccessDialog — the app's themed modal. */
export const DialogHost = () => {
  const dialog = useDialogStore((state) => state.dialog);
  const close = useDialogStore((state) => state.close);

  if (!dialog) return null;

  const { Icon, color, background } = ICON_CONFIG[dialog.icon ?? 'success'];

  return (
    <Modal
      dismissible={dialog.dismissible ?? false}
      onClose={close}
      icon={
        <div
          style={{
            width: '100%',
            height: '100%',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background,
            color,
          }}
        >
          <Icon size={30} />
        </div>
      }
      title={dialog.title}
      actions={
        <Button variant="primary" onClick={close}>
          {dialog.confirmLabel ?? 'OK'}
        </Button>
      }
    >
      <p>{dialog.message}</p>
    </Modal>
  );
};
