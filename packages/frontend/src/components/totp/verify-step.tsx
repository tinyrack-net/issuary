import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { TRButton } from '@tinyrack/ui/components/button';
import { useCallback, useMemo, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
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
    <div className={`flex flex-col gap-tinyrack-lg ${className}`}>
      <form
        className="flex flex-col gap-tinyrack-lg"
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

        <TRButton
          className="w-full"
          intent="primary"
          loading={isPending}
          loadingLabel={pendingText ?? t('setupTotp.verifying')}
          type="submit"
          uiSize="lg"
        >
          {submitLabel ?? t('setupTotp.verify')}
        </TRButton>
      </form>

      {onBack && (
        <TRButton
          appearance="ghost"
          className="w-full"
          data-testid="totp-verify-back"
          disabled={isPending}
          intent="neutral"
          onClick={onBack}
          type="button"
        >
          {backLabel ?? t('setupTotp.back')}
        </TRButton>
      )}
    </div>
  );
}
