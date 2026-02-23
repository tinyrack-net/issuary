import type { Icon } from '@phosphor-icons/react';
import type { FieldError } from 'react-hook-form';

type IconInputProps = {
  icon: Icon;
  type?: 'email' | 'password' | 'text';
  placeholder: string;
  autoComplete?: string;
  error?: FieldError;
  className?: string;
  ref?: React.Ref<HTMLInputElement>;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'className'>;

export const IconInput = ({
  icon: IconComponent,
  type = 'text',
  placeholder,
  autoComplete,
  error,
  className = '',
  ref,
  ...props
}: IconInputProps) => {
  return (
    <div className={className}>
      <label
        className={`input input-bordered flex items-center gap-2 ${
          error ? 'input-error' : ''
        }`}
        data-testid={error ? 'input-error-wrapper' : undefined}
      >
        <IconComponent className="size-5 opacity-70" />
        <input
          autoComplete={autoComplete}
          className="grow"
          placeholder={placeholder}
          ref={ref}
          type={type}
          {...props}
        />
      </label>
      {error && (
        <p className="mt-1 text-error text-sm" data-testid="field-error">
          {error.message}
        </p>
      )}
    </div>
  );
};
