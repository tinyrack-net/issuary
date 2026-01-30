import { CheckIcon, CopyIcon, WarningIcon } from '@phosphor-icons/react';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

export interface RecoveryCodesStepProps {
  recoveryCodes: string[];
  onConfirm: () => void;
  isLoading?: boolean;
  className?: string;
  'data-testid'?: string;
}

export function RecoveryCodesStep({
  recoveryCodes,
  onConfirm,
  isLoading = false,
  className = '',
  'data-testid': testId,
}: RecoveryCodesStepProps) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const handleCopy = useCallback(async () => {
    const text = recoveryCodes.join('\n');
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [recoveryCodes]);

  return (
    <div className={`space-y-3 ${className}`}>
      <p className="text-center text-base-content/60 text-xs">
        {t('setupTotp.recoveryCodes.description')}
      </p>

      <div
        className="grid grid-cols-2 gap-2 rounded-lg bg-base-200 p-3"
        data-testid={testId ? `${testId}-codes` : undefined}
      >
        {recoveryCodes.map((code, index) => (
          <code
            key={code}
            className="rounded bg-base-300 px-2 py-1 text-center font-mono text-sm"
            data-testid={testId ? `${testId}-code-${index}` : undefined}
          >
            {code}
          </code>
        ))}
      </div>

      <div className="flex items-start gap-2 rounded-lg bg-warning/10 p-2.5 text-warning">
        <WarningIcon className="mt-0.5 size-4 shrink-0" weight="fill" />
        <p className="text-xs">{t('setupTotp.recoveryCodes.warning')}</p>
      </div>

      <button
        type="button"
        className="btn btn-sm btn-outline btn-block gap-2"
        onClick={handleCopy}
        data-testid={testId ? `${testId}-copy-btn` : undefined}
      >
        {copied ? (
          <>
            <CheckIcon className="size-4" />
            {t('setupTotp.recoveryCodes.copied')}
          </>
        ) : (
          <>
            <CopyIcon className="size-4" />
            {t('setupTotp.recoveryCodes.copy')}
          </>
        )}
      </button>

      <label className="flex cursor-pointer items-center gap-2">
        <input
          type="checkbox"
          className="checkbox checkbox-sm"
          checked={confirmed}
          onChange={(event) => setConfirmed(event.target.checked)}
          disabled={isLoading}
          data-testid={testId ? `${testId}-confirm-checkbox` : undefined}
        />
        <span className="text-sm">
          {t('setupTotp.recoveryCodes.confirmCheckbox')}
        </span>
      </label>

      <button
        type="button"
        className="btn btn-sm btn-primary btn-block"
        onClick={onConfirm}
        disabled={!confirmed || isLoading}
        data-testid={testId ? `${testId}-confirm-btn` : undefined}
      >
        {isLoading ? (
          <span className="loading loading-spinner loading-sm" />
        ) : (
          t('setupTotp.recoveryCodes.confirm')
        )}
      </button>
    </div>
  );
}
