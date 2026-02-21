import { SubmitButton } from '@frontend/components/auth/submit-button.js';
import {
  PinInput,
  type PinInputRef,
} from '@frontend/components/ui/pin-input.js';
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { useCallback, useMemo, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

export interface VerifyStepProps {
  onSubmit: (code: string) => Promise<void>;
  onBack: () => void;
  isPending: boolean;
  className?: string;
}

type VerifyFormValues = {
  code: string;
};

export function VerifyStep({
  onSubmit,
  onBack,
  isPending,
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
          message: t('setupTotp.error.invalid'),
        });
        setValue('code', '');
        pinInputRef.current?.focus();
      }
    },
    [onSubmit, setError, setValue, t],
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
          pendingText={t('setupTotp.verifying')}
        >
          {t('setupTotp.verify')}
        </SubmitButton>
      </form>

      <div className="mt-3 text-center">
        <button
          className="btn btn-ghost btn-xs"
          disabled={isPending}
          onClick={onBack}
          type="button"
        >
          {t('setupTotp.back')}
        </button>
      </div>
    </div>
  );
}
