import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../../lib/cn';

interface ModalProps {
  title?: ReactNode;
  icon?: ReactNode;
  children: ReactNode;
  actions?: ReactNode;
  onClose?: () => void;
  /** When false, clicking the backdrop / pressing Escape does nothing. */
  dismissible?: boolean;
  wide?: boolean;
  className?: string;
}

/**
 * Port of Flutter's showDialog / AlertDialog. Rendered in a portal so it sits
 * above the app frame regardless of scroll position.
 */
export const Modal = ({
  title,
  icon,
  children,
  actions,
  onClose,
  dismissible = true,
  wide = false,
  className,
}: ModalProps) => {
  useEffect(() => {
    if (!dismissible) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dismissible, onClose]);

  return createPortal(
    <div
      className="modal-overlay"
      role="presentation"
      onMouseDown={(event) => {
        if (dismissible && event.target === event.currentTarget) onClose?.();
      }}
    >
      <div className={cn('modal', wide && 'modal--wide', className)} role="dialog" aria-modal="true">
        {icon && <div className="modal__icon">{icon}</div>}
        {title && <h2 className="modal__title">{title}</h2>}
        <div className="modal__body">{children}</div>
        {actions && <div className="modal__actions">{actions}</div>}
      </div>
    </div>,
    document.body,
  );
};
