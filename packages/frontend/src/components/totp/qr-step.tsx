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
    <div className={`space-y-3 ${className}`}>
      <p className="text-center text-tinyrack-text-muted text-tinyrack-xs">
        {t('setupTotp.qrDescription')}
      </p>

      <div className="flex justify-center">
        <img
          alt="TOTP QR Code"
          className="h-40 w-40 rounded-tinyrack-md border border-tinyrack-border"
          src={setupData.qr_code}
        />
      </div>

      <TRCollapsible.Root>
        <TRCollapsible.Trigger>
          {t('setupTotp.manualEntry')}
        </TRCollapsible.Trigger>
        <TRCollapsible.Panel>
          <code className="block break-all rounded-tinyrack-sm bg-tinyrack-surface-muted p-1.5 text-tinyrack-text text-tinyrack-xs">
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
        uiSize="sm"
      >
        {t('setupTotp.next')}
      </TRButton>

      {additionalActions}
    </div>
  );
}
