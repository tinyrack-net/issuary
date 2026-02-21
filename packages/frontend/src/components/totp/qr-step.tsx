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
    <div className={`space-y-3 ${className}`}>
      <p className="text-center text-base-content/60 text-xs">
        {t('setupTotp.qrDescription')}
      </p>

      <div className="flex justify-center">
        <img
          alt="TOTP QR Code"
          className="h-40 w-40 rounded-lg border"
          src={setupData.qr_code}
        />
      </div>

      <div className="collapse-arrow collapse bg-base-200">
        <input type="checkbox" />
        <div className="collapse-title font-medium text-xs">
          {t('setupTotp.manualEntry')}
        </div>
        <div className="collapse-content">
          <code className="block break-all rounded bg-base-300 p-1.5 text-xs">
            {setupData.secret}
          </code>
        </div>
      </div>

      <button
        className="btn btn-sm btn-primary btn-block"
        onClick={onNext}
        type="button"
      >
        {t('setupTotp.next')}
      </button>

      {additionalActions}
    </div>
  );
}
