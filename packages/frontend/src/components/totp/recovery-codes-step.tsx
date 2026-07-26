import { TRButton } from '@tinyrack/ui/components/button';
import { TRCheckbox } from '@tinyrack/ui/components/checkbox';
import { TRField } from '@tinyrack/ui/components/field';
import { TRToast } from '@tinyrack/ui/components/toast';
import { CopyIcon, TriangleAlertIcon } from 'lucide-react';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert } from '#frontend/components/ui/alert.tsx';

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
  const toast = TRToast.useToastManager();
  const [confirmed, setConfirmed] = useState(false);

  // The toast manager owns the dismissal timer, so this no longer keeps a
  // "copied" flag alive with its own setTimeout.
  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(recoveryCodes.join('\n'));
    toast.add({ title: t('setupTotp.recoveryCodes.copied'), type: 'success' });
  }, [recoveryCodes, toast, t]);

  return (
    <div className={`flex flex-col gap-tinyrack-lg ${className}`}>
      <p className="text-tinyrack-sm text-tinyrack-text-muted">
        {t('setupTotp.recoveryCodes.description')}
      </p>

      {/*
        Two columns so a full set of codes stays on one screen without
        scrolling — this is the only time the user will ever see them.
      */}
      <div
        className="grid grid-cols-2 gap-tinyrack-sm rounded-tinyrack-lg border border-tinyrack-border bg-tinyrack-surface p-tinyrack-lg"
        data-testid="recovery-codes-grid"
      >
        {recoveryCodes.map((code) => (
          <code
            className="rounded-tinyrack-sm bg-tinyrack-surface-muted px-tinyrack-sm py-tinyrack-3xs text-center font-tinyrack-mono text-tinyrack-sm text-tinyrack-text"
            key={code}
          >
            {code}
          </code>
        ))}
      </div>

      <Alert icon={TriangleAlertIcon} type="warning">
        {t('setupTotp.recoveryCodes.warning')}
      </Alert>

      <TRButton
        appearance="outline"
        className="w-full gap-tinyrack-sm"
        intent="neutral"
        onClick={handleCopy}
        type="button"
      >
        <CopyIcon aria-hidden className="size-4" />
        {t('setupTotp.recoveryCodes.copy')}
      </TRButton>

      {/*
        `TRField.Root` owns the label/control association, so the checkbox
        keeps its own focus ring instead of being swallowed by a wrapping
        `<label>` that had none.
      */}
      <TRField.Root>
        <div className="flex items-center gap-tinyrack-sm">
          <TRCheckbox.Root
            checked={confirmed}
            data-testid="recovery-codes-confirm"
            disabled={isLoading}
            onCheckedChange={(checked) => setConfirmed(checked === true)}
            uiSize="sm"
          >
            <TRCheckbox.Indicator />
          </TRCheckbox.Root>
          <TRField.Label className="cursor-pointer">
            {t('setupTotp.recoveryCodes.confirmCheckbox')}
          </TRField.Label>
        </div>
      </TRField.Root>

      <TRButton
        className="w-full"
        data-testid="recovery-codes-submit"
        disabled={!confirmed || isLoading}
        intent="primary"
        loading={isLoading}
        onClick={onConfirm}
        type="button"
        uiSize="lg"
      >
        {t('setupTotp.recoveryCodes.confirm')}
      </TRButton>
    </div>
  );
}
