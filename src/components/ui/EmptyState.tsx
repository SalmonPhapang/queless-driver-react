import type { ReactNode } from 'react';

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  text?: string;
  action?: ReactNode;
  className?: string;
}

export const EmptyState = ({ icon, title, text, action, className }: EmptyStateProps) => (
  <div className={className ?? 'empty'}>
    <div className="empty__icon">{icon}</div>
    <div className="empty__title">{title}</div>
    {text && <p className="empty__text">{text}</p>}
    {action && <div className="mt-16">{action}</div>}
  </div>
);
