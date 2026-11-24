import { cn } from '../../lib/cn';

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label: string;
}

/** Port of Flutter's Switch.adaptive. */
export const Switch = ({ checked, onChange, disabled = false, label }: SwitchProps) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    className={cn('switch', checked && 'switch--on')}
    disabled={disabled}
    onClick={() => onChange(!checked)}
  />
);
