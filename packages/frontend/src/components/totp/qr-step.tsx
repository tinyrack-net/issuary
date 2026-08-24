import { TRButton } from '@tinyrack/ui/components/button';
import { TRCollapsible } from '@tinyrack/ui/components/collapsible';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { TotpSetupData } from '#frontend/features/totp/use-totp-setup.ts';

export interface QrStepProps {
  setupData: TotpSetupData;
  onNext: () => void;
  additionalActions?: ReactNode;
  className?: string;
}

export function QrStep({
  setupData,
  onNext,
  additionalActions,
  className = '',
}: QrStepProps) {
  const { t } = useTranslation();

  return (
    <div className={`flex flex-col gap-tinyrack-lg ${className}`}>
      <p className="text-center text-tinyrack-sm text-tinyrack-text-muted">
        {t('setupTotp.qrDescription')}
      </p>

      {/*
        The QR sits on its own light surface with padding for the quiet zone.
        Rendered straight onto the canvas it inherited the dark theme's
        background, and scanners need the margin and the contrast to lock on.
      */}
      <div className="flex justify-center">
        <div className="rounded-tinyrack-lg border border-tinyrack-border bg-tinyrack-surface p-tinyrack-lg">
          <img
            alt="TOTP QR Code"
            className="block size-tinyrack-measure-sm"
            src={setupData.qr_code}
          />
        </div>
      </div>

      <TRCollapsible.Root>
        <TRCollapsible.Trigger>
          {t('setupTotp.manualEntry')}
        </TRCollapsible.Trigger>
        <TRCollapsible.Panel>
          <code className="mt-tinyrack-xs block break-all rounded-tinyrack-sm bg-tinyrack-surface-muted p-tinyrack-sm text-tinyrack-sm text-tinyrack-text">
            {setupData.secret}
          </code>
        </TRCollapsible.Panel>
      </TRCollapsible.Root>

      <TRButton
        className="w-full"
        data-testid="totp-qr-next"
        intent="primary"
        onClick={onNext}
        type="button"
        uiSize="lg"
      >
        {t('setupTotp.next')}
      </TRButton>

      {additionalActions}
    </div>
  );
}
