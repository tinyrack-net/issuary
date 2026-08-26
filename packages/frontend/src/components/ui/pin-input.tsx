import { TRField } from '@tinyrack/ui/components/field';
import { TROTPField } from '@tinyrack/ui/components/otp-field';
import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import type { FieldError } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

export type PinInputRef = {
  focus: () => void;
  clear: () => void;
};

type PinInputProps = {
  length?: number;
  error?: FieldError;
  disabled?: boolean;
  onComplete?: (value: string) => void;
  onChange?: (value: string) => void;
  value?: string;
  autoFocus?: boolean;
  className?: string;
};

export const PinInput = forwardRef<PinInputRef, PinInputProps>(
  function PinInput(
    {
      length = 6,
      error,
      disabled = false,
      onComplete,
      onChange,
      value: controlledValue,
      autoFocus = false,
      className = '',
    },
    ref,
  ) {
    const { t } = useTranslation();
    const otpId = useId();
    const containerRef = useRef<HTMLDivElement>(null);
    const [internalValue, setInternalValue] = useState(controlledValue ?? '');

    useEffect(() => {
      if (controlledValue !== undefined) {
        setInternalValue(controlledValue);
      }
    }, [controlledValue]);

    useImperativeHandle(
      ref,
      () => ({
        focus: () => {
          const firstInput = containerRef.current?.querySelector('input');
          firstInput?.focus();
        },
        clear: () => {
          setInternalValue('');
          const firstInput = containerRef.current?.querySelector('input');
          firstInput?.focus();
        },
      }),
      [],
    );

    const handleValueChange = useCallback(
      (newValue: string) => {
        setInternalValue(newValue);
        onChange?.(newValue);
      },
      [onChange],
    );

    const handleValueComplete = useCallback(
      (completedValue: string) => {
        onComplete?.(completedValue);
      },
      [onComplete],
    );

    return (
      <TRField.Root className={className} ref={containerRef}>
        {/*
          A real label, not `aria-label`: Base UI deliberately ignores
          `aria-label` on the first OTP input and warns to use a label instead,
          because that input is also the one password managers autofill.
          Visually hidden — the screen's own heading already says what the code
          is, so showing it twice would be noise.
        */}
        <TRField.Label className="sr-only" htmlFor={otpId}>
          {t('common.otp.label')}
        </TRField.Label>
        <TROTPField.Root
          disabled={disabled}
          /*
           * Base UI gives the first slot the root's own id and derives the
           * rest from it, so naming the root is what lets the label point at
           * a real input rather than at the wrapping group.
           */
          id={otpId}
          length={length}
          onValueChange={handleValueChange}
          onValueComplete={handleValueComplete}
          uiSize="md"
          validationType="numeric"
          value={internalValue}
        >
          {/*
            Each box is a separate input, so each needs to say which position
            it is. Two Base UI behaviours shape this: the first box ignores
            `aria-label` outright (it is the one password managers autofill, so
            it takes the field's own label), and on the rest an `aria-label`
            *replaces* the inherited field name rather than adding to it. So
            the field name is folded into the per-box string, and box one is
            left to the label above.
          */}
          {Array.from({ length }, (_, index) => (
            <TROTPField.Input
              aria-label={
                index === 0
                  ? undefined
                  : t('common.otp.digit', {
                      label: t('common.otp.label'),
                      position: index + 1,
                      total: length,
                    })
              }
              autoFocus={autoFocus && index === 0}
              key={index}
            />
          ))}
        </TROTPField.Root>
        {error && (
          <p
            className="mt-tinyrack-sm text-center text-tinyrack-danger-foreground text-tinyrack-sm"
            data-testid="pin-input-error"
          >
            {error.message}
          </p>
        )}
      </TRField.Root>
    );
  },
);

export default PinInput;
