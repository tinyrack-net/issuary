import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { useCallback, useMemo, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { SubmitButton } from '#frontend/components/auth/submit-button.tsx';
import {
  PinInput,
  type PinInputRef,
} from '#frontend/components/ui/pin-input.tsx';

export interface VerifyStepProps {
  onSubmit: (code: string) => Promise<void>;
  onBack?: (() => void) | undefined;
  isPending: boolean;
  invalidMessage?: string | undefined;
  submitLabel?: string | undefined;
  pendingText?: string | undefined;
  backLabel?: string | undefined;
  className?: string;
}

type VerifyFormValues = {
  code: string;
};

export function VerifyStep({
  onSubmit,
  onBack,
  isPending,
  invalidMessage,
  submitLabel,
  pendingText,
  backLabel,
  className = '',
}: VerifyStepProps) {
  const { t } = useTranslation();
  const pinInputRef = useRef<PinInputRef>(null);

  const verifySchema = useMemo(
    () =>
      z.object({
        code: z
          .string()
          .length(6, t('validation.totp.length'))
          .regex(/^\d{6}$/, t('validation.totp.digits')),
      }),
    [t],
  );

  const {
    setValue,
    setError,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<VerifyFormValues>({
    defaultValues: { code: '' },
    resolver: standardSchemaResolver(verifySchema),
  });

  const codeValue = watch('code');

  const handleFormSubmit = useCallback(
    async (values: VerifyFormValues) => {
      try {
        await onSubmit(values.code);
      } catch {
        setError('code', {
          type: 'manual',
          message: invalidMessage ?? t('setupTotp.error.invalid'),
        });
        setValue('code', '');
        pinInputRef.current?.focus();
      }
    },
    [invalidMessage, onSubmit, setError, setValue, t],
  );

  return (
    <div className={className}>
      <form
        className="flex flex-col gap-3"
        onSubmit={handleSubmit(handleFormSubmit)}
      >
        <PinInput
          autoFocus
          error={errors.code}
          length={6}
          onChange={(value) => setValue('code', value)}
          onComplete={() => handleSubmit(handleFormSubmit)()}
          ref={pinInputRef}
          value={codeValue}
        />

        <SubmitButton
          className="btn-sm mt-1"
          isPending={isPending}
          pendingText={pendingText ?? t('setupTotp.verifying')}
        >
          {submitLabel ?? t('setupTotp.verify')}
        </SubmitButton>
      </form>

      {onBack && (
        <div className="mt-3 text-center">
          <button
            className="btn btn-ghost btn-xs"
            data-testid="totp-verify-back"
            disabled={isPending}
            onClick={onBack}
            type="button"
          >
            {backLabel ?? t('setupTotp.back')}
          </button>
        </div>
      )}
    </div>
  );
}
