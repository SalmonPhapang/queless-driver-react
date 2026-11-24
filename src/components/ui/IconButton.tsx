import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '../../lib/cn';

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  badge?: number;
  children: ReactNode;
}

/** Icon-only action button with an optional notification badge. */
export const IconButton = ({ label, badge, className, children, ...rest }: IconButtonProps) => (
  <button type="button" className={cn('icon-btn', className)} aria-label={label} title={label} {...rest}>
    {children}
    {badge != null && badge > 0 && <span className="icon-btn__badge">{badge}</span>}
  </button>
);
