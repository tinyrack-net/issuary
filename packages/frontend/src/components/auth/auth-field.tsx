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
  className?: string;
  ref?: React.Ref<HTMLInputElement>;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'className'>;

/**
 * The auth surface's text input.
 *
 * Built on the `tr-input-group` contract from `@tinyrack/ui`'s input CSS,
 * which supports a leading adornment and a trailing action but has no React
 * export yet — worth proposing upstream as `TRInput.Group`.
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
    <TRField.Root className={className} uiSize="md">
      <div className="flex items-baseline justify-between gap-tinyrack-sm">
        <TRField.Label htmlFor={inputId}>{label}</TRField.Label>
        {labelAction}
      </div>
      <div
        className="tr-input-group"
        data-invalid={error ? '' : undefined}
        data-testid={error ? 'input-error-wrapper' : undefined}
        data-ui-size="md"
      >
        {Icon && (
          <span className="tr-input-group-adornment" data-side="start">
            <Icon aria-hidden className="size-5 opacity-70" />
          </span>
        )}
        <TRInput
          aria-describedby={describedBy}
          aria-invalid={error ? true : undefined}
          autoComplete={autoComplete}
          className="tr-input-group-input"
          data-invalid={error ? '' : undefined}
          id={inputId}
          placeholder={placeholder}
          ref={ref}
          type={resolvedType}
          {...props}
        />
        {canReveal && (
          <button
            aria-label={
              revealed ? t('common.password.hide') : t('common.password.show')
            }
            className="tr-input-group-action"
            onClick={() => setRevealed((value) => !value)}
            tabIndex={-1}
            type="button"
          >
            {revealed ? (
              <EyeOffIcon aria-hidden className="size-4" />
            ) : (
              <EyeIcon aria-hidden className="size-4" />
            )}
          </button>
        )}
      </div>
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
        <div className="tr-field-error" data-testid="field-error" id={errorId}>
          {error.message}
        </div>
      )}
    </TRField.Root>
  );
}
