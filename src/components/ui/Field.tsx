import { useId } from 'react';
import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

interface FieldShellProps {
  label?: string;
  error?: string | null;
  hint?: string;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
}

const FieldShell = ({ label, error, hint, htmlFor, children, className }: FieldShellProps) => (
  <div className={cn('field', className)}>
    {label && (
      <label className="field__label" htmlFor={htmlFor}>
        {label}
      </label>
    )}
    {children}
    {error ? (
      <span className="field__error">{error}</span>
    ) : hint ? (
      <span className="field__hint">{hint}</span>
    ) : null}
  </div>
);

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string | null;
  hint?: string;
  icon?: ReactNode;
  suffix?: ReactNode;
  wrapClassName?: string;
}

/** Port of the Material TextField / TextFormField. */
export const TextField = ({
  label,
  error,
  hint,
  icon,
  suffix,
  className,
  wrapClassName,
  id,
  readOnly,
  ...rest
}: TextFieldProps) => {
  const autoId = useId();
  const inputId = id ?? autoId;
  return (
    <FieldShell label={label} error={error} hint={hint} htmlFor={inputId} className={wrapClassName}>
      <div
        className={cn(
          'field__control',
          error && 'field__control--error',
          readOnly && 'field__control--readonly',
        )}
      >
        {icon && <span className="field__icon">{icon}</span>}
        <input
          id={inputId}
          className={cn('field__input', className)}
          readOnly={readOnly}
          aria-invalid={!!error}
          {...rest}
        />
        {suffix && <span className="field__suffix">{suffix}</span>}
      </div>
    </FieldShell>
  );
};

interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string | null;
  hint?: string;
}

export const TextArea = ({ label, error, hint, className, id, ...rest }: TextAreaProps) => {
  const autoId = useId();
  const inputId = id ?? autoId;
  return (
    <FieldShell label={label} error={error} hint={hint} htmlFor={inputId}>
      <div className={cn('field__control', error && 'field__control--error')}>
        <textarea id={inputId} className={cn('field__input', className)} {...rest} />
      </div>
    </FieldShell>
  );
};

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface SelectFieldProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  error?: string | null;
  hint?: string;
  disabled?: boolean;
  readOnly?: boolean;
  id?: string;
  className?: string;
}

/** Port of DropdownButtonFormField. */
export const SelectField = ({
  label,
  value,
  onChange,
  options,
  placeholder = 'Select an option',
  error,
  hint,
  disabled = false,
  readOnly = false,
  id,
  className,
}: SelectFieldProps) => {
  const autoId = useId();
  const selectId = id ?? autoId;
  return (
    <FieldShell label={label} error={error} hint={hint} htmlFor={selectId}>
      <div
        className={cn(
          'field__control',
          error && 'field__control--error',
          (disabled || readOnly) && 'field__control--readonly',
        )}
      >
        <select
          id={selectId}
          className={cn('field__input', className)}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled || readOnly}
        >
          <option value="" disabled>
            {placeholder}
          </option>
          {options.map((option) => (
            <option key={option.value} value={option.value} disabled={option.disabled}>
              {option.label}
            </option>
          ))}
        </select>
        <span className="field__select-caret" aria-hidden>
          ▾
        </span>
      </div>
    </FieldShell>
  );
};
