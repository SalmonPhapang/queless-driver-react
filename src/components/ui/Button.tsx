import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '../../lib/cn';

export type ButtonVariant = 'primary' | 'green' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'md' | 'sm' | 'xs';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  loading?: boolean;
  icon?: ReactNode;
  pill?: boolean;
}

/**
 * Port of the app's FilledButton / OutlinedButton / ElevatedButton styles:
 * black primary, white outline, green accent. `loading` disables the button
 * and swaps the label for a spinner, matching every Dart `_loading` button.
 */
export const Button = ({
  variant = 'primary',
  size = 'md',
  block = false,
  loading = false,
  icon,
  pill = false,
  className,
  disabled,
  children,
  type = 'button',
  ...rest
}: ButtonProps) => (
  <button
    type={type}
    className={cn(
      'btn',
      `btn--${variant}`,
      size !== 'md' && `btn--${size}`,
      block && 'btn--block',
      pill && 'btn--pill',
      className,
    )}
    disabled={disabled || loading}
    {...rest}
  >
    {loading ? <span className="btn__spinner" aria-hidden /> : icon}
    {!loading && children}
    {loading && <span>{children}</span>}
  </button>
);
