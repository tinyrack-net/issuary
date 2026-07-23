import { TROTPField } from '@tinyrack/ui/components/otp-field';
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import type { FieldError } from 'react-hook-form';
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
      <div className={className} ref={containerRef}>
        <TROTPField.Root
          disabled={disabled}
          length={length}
          onValueChange={handleValueChange}
          onValueComplete={handleValueComplete}
          uiSize="md"
          validationType="numeric"
          value={internalValue}
        >
          {Array.from({ length }, (_, index) => (
            <TROTPField.Input
              autoFocus={autoFocus && index === 0}
              key={index}
            />
          ))}
        </TROTPField.Root>
        {error && (
          <p
            className="mt-2 text-center text-danger text-sm"
            data-testid="pin-input-error"
          >
            {error.message}
          </p>
        )}
      </div>
    );
  },
);

export default PinInput;
