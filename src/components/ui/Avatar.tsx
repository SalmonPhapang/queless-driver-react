import { cn } from '../../lib/cn';
import { initialsOf } from '../../lib/format';

interface AvatarProps {
  src?: string | null;
  name?: string | null;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

/** CircleAvatar equivalent: image when available, initials otherwise. */
export const Avatar = ({ src, name, size = 'md', className }: AvatarProps) => (
  <span className={cn('avatar', `avatar--${size}`, className)}>
    {src ? <img src={src} alt={name ?? 'Avatar'} /> : <span>{initialsOf(name)}</span>}
  </span>
);
