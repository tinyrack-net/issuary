import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { TotpSetupData } from './types.js';

export interface QrStepProps {
  setupData: TotpSetupData;
  onNext: () => void;
  additionalActions?: ReactNode;
  className?: string;
  'data-testid'?: string;
}

export function QrStep({
  setupData,
  onNext,
  additionalActions,
  className = '',
  'data-testid': testId,
}: QrStepProps) {
  const { t } = useTranslation();

  return (
    <div className={`space-y-3 ${className}`}>
      <p className="text-center text-base-content/60 text-xs">
        {t('setupTotp.qrDescription')}
      </p>

      <div className="flex justify-center">
        <img
          src={setupData.qr_code}
          alt="TOTP QR Code"
          className="h-40 w-40 rounded-lg border"
          data-testid={testId ? `${testId}-qr-code` : undefined}
        />
      </div>

      <div className="collapse-arrow collapse bg-base-200">
        <input type="checkbox" />
        <div className="collapse-title font-medium text-xs">
          {t('setupTotp.manualEntry')}
        </div>
        <div className="collapse-content">
          <code
            className="block break-all rounded bg-base-300 p-1.5 text-xs"
            data-testid={testId ? `${testId}-secret` : undefined}
          >
            {setupData.secret}
          </code>
        </div>
      </div>

      <button
        type="button"
        className="btn btn-sm btn-primary btn-block"
        onClick={onNext}
        data-testid={testId ? `${testId}-next-btn` : undefined}
      >
        {t('setupTotp.next')}
      </button>

      {additionalActions}
    </div>
  );
}
