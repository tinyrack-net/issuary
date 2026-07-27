import { TRField } from '@tinyrack/ui/components/field';
import { TRInput } from '@tinyrack/ui/components/input';
import { EyeIcon, EyeOffIcon, type LucideIcon } from 'lucide-react';
import { useId, useState } from 'react';
import type { FieldError } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

type AuthFieldProps = {
  /** Leading adornment glyph. */
  icon?: LucideIcon;
  type?: 'email' | 'password' | 'text';
  label: string;
  placeholder?: string;
  hint?: string;
  /** Rendered on the label row, e.g. a "Forgot password?" link. */
  labelAction?: React.ReactNode;
  autoComplete?: string;
  error?: FieldError;
  /**
   * Overrides the error node's test id. The auth screens share the default;
   * the profile modals each have their own, which e2e selects on.
   */
  errorTestId?: string;
  /**
   * Renders the label to assistive technology only. For fields whose purpose
   * is obvious from context — an inline rename inside a list row — where a
   * visible label would be noise but a missing one leaves a nameless textbox.
   */
  hideLabel?: boolean;
  className?: string;
  ref?: React.Ref<HTMLInputElement>;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'className'>;

/**
 * The auth surface's text input.
 *
 * Composes `TRInput.Group` so the icon, field, and reveal toggle read as one
 * control.
 *
 * Password fields get a reveal toggle. It is a real button in the tab order
 * with a state-dependent accessible name, and it never changes the field's
 * `name` or `autocomplete`, so password managers keep working.
 */
export function AuthField({
  icon: Icon,
  type = 'text',
  label,
  placeholder,
  hint,
  labelAction,
  autoComplete,
  error,
  errorTestId = 'field-error',
  hideLabel = false,
  className = '',
  ref,
  ...props
}: AuthFieldProps) {
  const { t } = useTranslation();
  const generatedId = useId();
  const [revealed, setRevealed] = useState(false);

  const inputId = props.id ?? generatedId;
  const hintId = hint ? `${inputId}-hint` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;
  const describedBy = errorId ?? hintId;

  const canReveal = type === 'password';
  const resolvedType = canReveal && revealed ? 'text' : type;

  return (
    <TRField.Root className={className}>
      {hideLabel ? (
        <TRField.Label className="sr-only" htmlFor={inputId}>
          {label}
        </TRField.Label>
      ) : (
        <div className="flex items-baseline justify-between gap-tinyrack-sm">
          <TRField.Label htmlFor={inputId}>{label}</TRField.Label>
          {labelAction}
        </div>
      )}
      <TRInput.Group
        data-invalid={error ? '' : undefined}
        data-testid={error ? 'input-error-wrapper' : undefined}
      >
        {Icon && (
          <TRInput.Adornment>
            <Icon aria-hidden className="size-5 opacity-70" />
          </TRInput.Adornment>
        )}
        <TRInput
          aria-describedby={describedBy}
          aria-invalid={error ? true : undefined}
          autoComplete={autoComplete}
          data-invalid={error ? '' : undefined}
          id={inputId}
          placeholder={placeholder}
          ref={ref}
          type={resolvedType}
          {...props}
        />
        {canReveal && (
          <TRInput.Action
            aria-label={
              revealed ? t('common.password.hide') : t('common.password.show')
            }
            onClick={() => setRevealed((value) => !value)}
          >
            {revealed ? (
              <EyeOffIcon aria-hidden className="size-4" />
            ) : (
              <EyeIcon aria-hidden className="size-4" />
            )}
          </TRInput.Action>
        )}
      </TRInput.Group>
      {hint && !error && (
        <TRField.Description id={hintId}>{hint}</TRField.Description>
      )}
      {/*
        Plain element rather than `TRField.Error`: that part renders from Base
        UI's own field validity, which nothing here drives — react-hook-form
        owns validation. The class is the design system's, so the styling is
        still the system's.
      */}
      {error && (
        <div className="tr-field-error" data-testid={errorTestId} id={errorId}>
          {error.message}
        </div>
      )}
    </TRField.Root>
  );
}
