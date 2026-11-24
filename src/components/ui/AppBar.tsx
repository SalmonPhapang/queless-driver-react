import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { cn } from '../../lib/cn';

interface AppBarProps {
  title?: ReactNode;
  back?: boolean;
  onBack?: () => void;
  start?: ReactNode;
  actions?: ReactNode;
  bordered?: boolean;
  align?: 'center' | 'left';
}

/** Port of the Material AppBar used by every screen. */
export const AppBar = ({
  title,
  back = false,
  onBack,
  start,
  actions,
  bordered = false,
  align = 'center',
}: AppBarProps) => {
  const navigate = useNavigate();

  return (
    <header className={cn('appbar', bordered && 'appbar--bordered')}>
      <div className="appbar__side">
        {back && (
          <button
            type="button"
            className="icon-btn"
            aria-label="Back"
            onClick={() => (onBack ? onBack() : navigate(-1))}
          >
            <ArrowLeft size={21} />
          </button>
        )}
        {start}
      </div>
      {title != null && (
        <div className={cn('appbar__title', align === 'left' && 'appbar__title--left')}>{title}</div>
      )}
      <div className="appbar__side appbar__side--end">{actions}</div>
    </header>
  );
};
