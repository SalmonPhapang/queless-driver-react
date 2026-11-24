import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

export type BadgeTone = 'green' | 'orange' | 'red' | 'blue' | 'gray';

interface BadgeProps {
  tone?: BadgeTone;
  solid?: boolean;
  children: ReactNode;
  className?: string;
}

export const Badge = ({ tone = 'gray', solid = false, children, className }: BadgeProps) => (
  <span
    className={cn(
      'badge',
      solid ? `badge--solid-${tone === 'orange' ? 'red' : tone}` : `badge--${tone}`,
      className,
    )}
  >
    {children}
  </span>
);
