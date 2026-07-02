import type { Icon } from '@phosphor-icons/react';
import { useId } from 'react';
import type { FieldError } from 'react-hook-form';

type IconInputProps = {
  icon: Icon;
  type?: 'email' | 'password' | 'text';
  label: string;
  placeholder: string;
  hint?: string;
  autoComplete?: string;
  error?: FieldError;
  className?: string;
  ref?: React.Ref<HTMLInputElement>;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'className'>;

export const IconInput = ({
  icon: IconComponent,
  type = 'text',
  label,
  placeholder,
  hint,
  autoComplete,
  error,
  className = '',
  ref,
  ...props
}: IconInputProps) => {
  const generatedId = useId();
  const inputId = props.id ?? generatedId;
  const hintId = hint ? `${inputId}-hint` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;
  const describedBy = errorId ?? hintId;

  return (
    <div className={className}>
      <label className="mb-1.5 block font-medium text-sm" htmlFor={inputId}>
        {label}
      </label>
      <div
        className={`input input-bordered flex items-center gap-2 ${
          error ? 'input-error' : ''
        }`}
        data-testid={error ? 'input-error-wrapper' : undefined}
      >
        <IconComponent aria-hidden className="size-5 opacity-70" />
        <input
          aria-describedby={describedBy}
          aria-invalid={error ? true : undefined}
          autoComplete={autoComplete}
          className="grow"
          id={inputId}
          placeholder={placeholder}
          ref={ref}
          type={type}
          {...props}
        />
      </div>
      {hint && !error && (
        <p className="mt-1 text-base-content/55 text-xs" id={hintId}>
          {hint}
        </p>
      )}
      {error && (
        <p
          className="mt-1 text-error text-sm"
          data-testid="field-error"
          id={errorId}
        >
          {error.message}
        </p>
      )}
    </div>
  );
};
