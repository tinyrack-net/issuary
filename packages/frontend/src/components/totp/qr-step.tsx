import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { TotpSetupData } from './types.js';

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
    <div className={className}>
      <p className="mb-4 text-center text-base-content/60 text-sm">
        {t('setupTotp.qrDescription')}
      </p>

      <div className="mb-4 flex justify-center">
        <img
          src={setupData.qr_code}
          alt="TOTP QR Code"
          className="h-48 w-48 rounded-lg border"
        />
      </div>

      <div className="collapse-arrow collapse mb-4 bg-base-200">
        <input type="checkbox" />
        <div className="collapse-title font-medium text-sm">
          {t('setupTotp.manualEntry')}
        </div>
        <div className="collapse-content">
          <code className="block break-all rounded bg-base-300 p-2 text-xs">
            {setupData.secret}
          </code>
        </div>
      </div>

      <button
        type="button"
        className="btn btn-primary btn-block"
        onClick={onNext}
      >
        {t('setupTotp.next')}
      </button>

      {additionalActions}
    </div>
  );
}
