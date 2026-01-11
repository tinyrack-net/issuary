import type { Icon } from '@phosphor-icons/react';
import { forwardRef } from 'react';
import type { FieldError } from 'react-hook-form';

type IconInputProps = {
  icon: Icon;
  type?: 'email' | 'password' | 'text';
  placeholder: string;
  autoComplete?: string;
  error?: FieldError;
  className?: string;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'className'>;

export const IconInput = forwardRef<HTMLInputElement, IconInputProps>(
  (
    {
      icon: IconComponent,
      type = 'text',
      placeholder,
      autoComplete,
      error,
      className = '',
      ...props
    },
    ref,
  ) => {
    return (
      <div className={className}>
        <label
          className={`input input-bordered flex items-center gap-2 ${
            error ? 'input-error' : ''
          }`}
        >
          <IconComponent className="size-5 opacity-70" />
          <input
            ref={ref}
            type={type}
            className="grow"
            placeholder={placeholder}
            autoComplete={autoComplete}
            {...props}
          />
        </label>
        {error && <p className="mt-1 text-error text-sm">{error.message}</p>}
      </div>
    );
  },
);

IconInput.displayName = 'IconInput';
