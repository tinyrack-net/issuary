import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import type { FieldError } from 'react-hook-form';

type PinInputProps = {
  /** Number of digits (default: 6) */
  length?: number;
  /** Error state from react-hook-form */
  error?: FieldError;
  /** Whether the input is disabled */
  disabled?: boolean;
  /** Called when all digits are filled */
  onComplete?: (value: string) => void;
  /** Called when the value changes */
  onChange?: (value: string) => void;
  /** Current value (controlled) */
  value?: string;
  /** Auto focus the first input on mount */
  autoFocus?: boolean;
  /** Additional class name for the container */
  className?: string;
  /** Base test ID for E2E testing (each digit will have {testId}-{index}) */
  'data-testid'?: string;
};

export type PinInputRef = {
  focus: () => void;
  clear: () => void;
};

export const PinInput = forwardRef<PinInputRef, PinInputProps>(
  (
    {
      length = 6,
      error,
      disabled = false,
      onComplete,
      onChange,
      value = '',
      autoFocus = false,
      className = '',
      'data-testid': testId,
    },
    ref,
  ) => {
    const [digits, setDigits] = useState<string[]>(() =>
      value.split('').concat(Array(length).fill('')).slice(0, length),
    );
    const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

    // Sync internal state with controlled value
    useEffect(() => {
      const newDigits = value
        .split('')
        .concat(Array(length).fill(''))
        .slice(0, length);
      setDigits(newDigits);
    }, [value, length]);

    // Expose methods via ref
    useImperativeHandle(
      ref,
      () => ({
        focus: () => {
          inputRefs.current[0]?.focus();
        },
        clear: () => {
          setDigits(Array(length).fill(''));
          inputRefs.current[0]?.focus();
        },
      }),
      [length],
    );

    // Auto focus on mount
    useEffect(() => {
      if (autoFocus && !disabled) {
        inputRefs.current[0]?.focus();
      }
    }, [autoFocus, disabled]);

    const updateValue = useCallback(
      (newDigits: string[]) => {
        const newValue = newDigits.join('');
        onChange?.(newValue);

        if (newDigits.every((d) => d !== '') && newValue.length === length) {
          onComplete?.(newValue);
        }
      },
      [onChange, onComplete, length],
    );

    const handleChange = useCallback(
      (index: number, inputValue: string) => {
        // Only accept digits
        const digit = inputValue.replace(/\D/g, '').slice(-1);

        const newDigits = [...digits];
        newDigits[index] = digit;
        setDigits(newDigits);
        updateValue(newDigits);

        // Move to next input if digit was entered
        if (digit && index < length - 1) {
          inputRefs.current[index + 1]?.focus();
        }
      },
      [digits, length, updateValue],
    );

    const handleKeyDown = useCallback(
      (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
        switch (e.key) {
          case 'Backspace':
            e.preventDefault();
            if (digits[index]) {
              // Clear current digit
              const newDigits = [...digits];
              newDigits[index] = '';
              setDigits(newDigits);
              updateValue(newDigits);
            } else if (index > 0) {
              // Move to previous input and clear it
              const newDigits = [...digits];
              newDigits[index - 1] = '';
              setDigits(newDigits);
              updateValue(newDigits);
              inputRefs.current[index - 1]?.focus();
            }
            break;

          case 'ArrowLeft':
            e.preventDefault();
            if (index > 0) {
              inputRefs.current[index - 1]?.focus();
            }
            break;

          case 'ArrowRight':
            e.preventDefault();
            if (index < length - 1) {
              inputRefs.current[index + 1]?.focus();
            }
            break;

          case 'Delete':
            e.preventDefault();
            {
              const newDigits = [...digits];
              newDigits[index] = '';
              setDigits(newDigits);
              updateValue(newDigits);
            }
            break;
        }
      },
      [digits, length, updateValue],
    );

    const handlePaste = useCallback(
      (e: React.ClipboardEvent<HTMLInputElement>) => {
        e.preventDefault();
        const pastedData = e.clipboardData
          .getData('text')
          .replace(/\D/g, '')
          .slice(0, length);

        if (pastedData) {
          const newDigits = pastedData
            .split('')
            .concat(Array(length).fill(''))
            .slice(0, length);
          setDigits(newDigits);
          updateValue(newDigits);

          // Focus the next empty input or the last one
          const nextEmptyIndex = newDigits.indexOf('');
          const focusIndex =
            nextEmptyIndex === -1 ? length - 1 : nextEmptyIndex;
          inputRefs.current[focusIndex]?.focus();
        }
      },
      [length, updateValue],
    );

    const handleFocus = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
      e.target.select();
    }, []);

    return (
      <div className={className}>
        <div className="flex justify-center gap-1.5 sm:gap-2">
          {digits.map((digit, index) => (
            <input
              key={index}
              ref={(el) => {
                inputRefs.current[index] = el;
              }}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={1}
              value={digit}
              onChange={(e) => handleChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              onPaste={handlePaste}
              onFocus={handleFocus}
              disabled={disabled}
              autoComplete={index === 0 ? 'one-time-code' : 'off'}
              className={`input input-bordered h-12 w-10 text-center font-mono text-xl sm:h-14 sm:w-12 sm:text-2xl ${
                error ? 'input-error' : ''
              } ${disabled ? 'input-disabled' : ''}`}
              aria-label={`Digit ${index + 1} of ${length}`}
              data-testid={testId ? `${testId}-${index}` : undefined}
            />
          ))}
        </div>
        {error && (
          <p
            className="mt-2 text-center text-error text-sm"
            data-testid={testId ? `${testId}-error` : undefined}
          >
            {error.message}
          </p>
        )}
      </div>
    );
  },
);

PinInput.displayName = 'PinInput';
