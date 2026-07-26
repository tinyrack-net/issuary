import { TRField } from '@tinyrack/ui/components/field';
import { TRInput } from '@tinyrack/ui/components/input';
import type { LucideIcon } from 'lucide-react';
import { useId } from 'react';
import type { FieldError } from 'react-hook-form';

type IconInputProps = {
  icon: LucideIcon;
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
    <TRField.Root className={className} uiSize="md">
      <TRField.Label htmlFor={inputId}>{label}</TRField.Label>
      <div
        className="tr-input-group"
        data-invalid={error ? '' : undefined}
        data-testid={error ? 'input-error-wrapper' : undefined}
        data-ui-size="md"
      >
        <span className="tr-input-group-adornment" data-side="start">
          <IconComponent aria-hidden className="size-5 opacity-70" />
        </span>
        <TRInput
          aria-describedby={describedBy}
          aria-invalid={error ? true : undefined}
          autoComplete={autoComplete}
          className="tr-input-group-input"
          data-invalid={error ? '' : undefined}
          id={inputId}
          placeholder={placeholder}
          ref={ref}
          type={type}
          {...props}
        />
      </div>
      {hint && !error && (
        <TRField.Description id={hintId}>{hint}</TRField.Description>
      )}
      {error && (
        <div className="tr-field-error" data-testid="field-error" id={errorId}>
          {error.message}
        </div>
      )}
    </TRField.Root>
  );
};
