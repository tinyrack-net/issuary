import { TRToast } from '@tinyrack/ui/components/toast';
import { XIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/**
 * Transient, non-blocking confirmation that something succeeded.
 *
 * The rule for reaching for this instead of an inline `Alert`: **if dismissing
 * it loses information the user still needs, it is not a toast.** So this
 * carries "we re-sent the email", "codes copied" — and never a validation
 * error, a session-expiry countdown, or anything gating a decision. Those stay
 * inline next to the thing they describe, where a screen reader meets them in
 * document order.
 */
export function Toaster() {
  const { t } = useTranslation();
  const { toasts } = TRToast.useToastManager();

  return (
    <TRToast.Portal>
      <TRToast.Viewport position="block-start-center">
        {toasts.map((toast) => (
          <TRToast.Root key={toast.id} toast={toast} variant="success">
            <TRToast.Content>
              <TRToast.Title />
              <TRToast.Description />
            </TRToast.Content>
            <TRToast.Close aria-label={t('common.dismiss')}>
              <XIcon aria-hidden className="size-4" />
            </TRToast.Close>
          </TRToast.Root>
        ))}
      </TRToast.Viewport>
    </TRToast.Portal>
  );
}
