import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { useCallback, useMemo, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod/v4';
import { SubmitButton } from '@/components/auth/submit-button.js';
import { PinInput, type PinInputRef } from '@/components/ui/pin-input.js';

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
        onSubmit={handleSubmit(handleFormSubmit)}
        className="flex flex-col gap-3"
      >
        <PinInput
          ref={pinInputRef}
          length={6}
          value={codeValue}
          onChange={(value) => setValue('code', value)}
          onComplete={() => handleSubmit(handleFormSubmit)()}
          error={errors.code}
          autoFocus
        />

        <SubmitButton
          isPending={isPending}
          pendingText={t('setupTotp.verifying')}
          className="btn-sm mt-1"
        >
          {t('setupTotp.verify')}
        </SubmitButton>
      </form>

      <div className="mt-3 text-center">
        <button
          type="button"
          className="btn btn-ghost btn-xs"
          onClick={onBack}
          disabled={isPending}
        >
          {t('setupTotp.back')}
        </button>
      </div>
    </div>
  );
}
