import { TRButton } from '@tinyrack/ui/components/button';
import { TRCheckbox } from '@tinyrack/ui/components/checkbox';
import { CheckIcon, CopyIcon, TriangleAlertIcon } from 'lucide-react';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

export interface RecoveryCodesStepProps {
  recoveryCodes: string[];
  onConfirm: () => void;
  isLoading?: boolean;
  className?: string;
}

export function RecoveryCodesStep({
  recoveryCodes,
  onConfirm,
  isLoading = false,
  className = '',
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
      <p className="text-center text-tinyrack-text-muted text-tinyrack-xs">
        {t('setupTotp.recoveryCodes.description')}
      </p>

      <div
        className="grid grid-cols-2 gap-2 rounded-tinyrack-md bg-tinyrack-surface-muted p-3"
        data-testid="recovery-codes-grid"
      >
        {recoveryCodes.map((code) => (
          <code
            className="rounded-tinyrack-sm bg-tinyrack-surface px-2 py-1 text-center font-mono text-tinyrack-sm text-tinyrack-text"
            key={code}
          >
            {code}
          </code>
        ))}
      </div>

      <div className="flex items-start gap-2 rounded-tinyrack-md border border-tinyrack-warning-border bg-tinyrack-warning-surface p-2.5 text-tinyrack-on-warning">
        <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" />
        <p className="text-tinyrack-xs">
          {t('setupTotp.recoveryCodes.warning')}
        </p>
      </div>

      <TRButton
        appearance="outline"
        className="w-full gap-2"
        intent="neutral"
        onClick={handleCopy}
        type="button"
        uiSize="sm"
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
      </TRButton>

      {/* biome-ignore lint/a11y/noLabelWithoutControl: the label wraps TRCheckbox.Root, which renders the checkbox control */}
      <label className="flex cursor-pointer items-center gap-2">
        <TRCheckbox.Root
          checked={confirmed}
          data-testid="recovery-codes-confirm"
          disabled={isLoading}
          onCheckedChange={(checked) => setConfirmed(checked === true)}
          uiSize="sm"
        >
          <TRCheckbox.Indicator />
        </TRCheckbox.Root>
        <span className="text-tinyrack-sm text-tinyrack-text">
          {t('setupTotp.recoveryCodes.confirmCheckbox')}
        </span>
      </label>

      <TRButton
        className="w-full"
        data-testid="recovery-codes-submit"
        disabled={!confirmed || isLoading}
        intent="primary"
        loading={isLoading}
        onClick={onConfirm}
        type="button"
        uiSize="sm"
      >
        {t('setupTotp.recoveryCodes.confirm')}
      </TRButton>
    </div>
  );
}
