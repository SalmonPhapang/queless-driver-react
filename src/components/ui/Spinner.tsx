import { cn } from '../../lib/cn';

interface SpinnerProps {
  size?: 'sm' | 'md';
  light?: boolean;
  className?: string;
}

export const Spinner = ({ size = 'md', light = false, className }: SpinnerProps) => (
  <span
    className={cn('spinner', size === 'sm' && 'spinner--sm', light && 'spinner--light', className)}
    role="status"
    aria-label="Loading"
  />
);

export const LoadingScreen = () => (
  <div className="loading-screen">
    <Spinner />
  </div>
);
