import { TRButton } from '@tinyrack/ui/components/button';
import { TRCode } from '@tinyrack/ui/components/code';
import { TRCollapsible } from '@tinyrack/ui/components/collapsible';
import { TRText } from '@tinyrack/ui/components/text';
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
    /* tinyrack-check-ignore-next-line components/no-native-text -- Structural setup stack; copy uses TRText/TRCode and QR is an approved image. */
    <div className={`flex flex-col gap-tinyrack-lg ${className}`}>
      <TRText align="center" as="p" color="muted" variant="bodySm">
        {t('setupTotp.qrDescription')}
      </TRText>

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
          <TRCode className="mt-tinyrack-xs block break-all rounded-tinyrack-sm bg-tinyrack-surface-muted p-tinyrack-sm">
            {setupData.secret}
          </TRCode>
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
