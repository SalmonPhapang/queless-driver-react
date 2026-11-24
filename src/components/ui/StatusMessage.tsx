import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import type { ComponentType } from 'react';
import { cn } from '../../lib/cn';
import { Button } from './Button';

export type StatusVariant = 'error' | 'warning' | 'info' | 'success';

export interface StatusMessageProps {
  variant?: StatusVariant;
  title?: string;
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
  onDismiss?: () => void;
  className?: string;
}

const ICONS: Record<StatusVariant, ComponentType<{ size?: number; className?: string }>> = {
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
  success: CheckCircle2,
};

/**
 * Inline, non-modal status message. Use this instead of a toast for load and
 * action failures on the golden-path screens.
 */
export const StatusMessage = ({
  variant = 'info',
  title,
  message,
  onRetry,
  retryLabel = 'Try again',
  onDismiss,
  className,
}: StatusMessageProps) => {
  const Icon = ICONS[variant];

  return (
    <div className={cn('status-message', `status-message--${variant}`, className)} role="alert">
      <Icon size={20} className="status-message__icon" />
      <div className="status-message__body">
        {title && <div className="status-message__title">{title}</div>}
        <div className="status-message__text">{message}</div>
        {onRetry && (
          <Button variant="outline" size="sm" className="status-message__retry" onClick={onRetry}>
            {retryLabel}
          </Button>
        )}
      </div>
      {onDismiss && (
        <button
          type="button"
          className="status-message__dismiss"
          aria-label="Dismiss"
          onClick={onDismiss}
        >
          <X size={18} />
        </button>
      )}
    </div>
  );
};
