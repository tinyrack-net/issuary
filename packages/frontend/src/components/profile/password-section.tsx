import { GearIcon, InfoIcon, KeyIcon } from '@phosphor-icons/react';
import { TRButton } from '@tinyrack/ui/components/button';
import { TRTooltip } from '@tinyrack/ui/components/tooltip';
import { useTranslation } from 'react-i18next';

type PasswordModalType = 'set' | 'change' | 'remove' | null;

interface PasswordSectionProps {
  hasPassword: boolean;
  hasLinkedOAuth: boolean;
  isConfigManaged: boolean;
  hasSecondFactorOnly: boolean;
  onOpenModal: (type: PasswordModalType) => void;
}

export function PasswordSection({
  hasPassword,
  hasLinkedOAuth,
  isConfigManaged,
  hasSecondFactorOnly,
  onOpenModal,
}: PasswordSectionProps) {
  const { t } = useTranslation();

  return (
    <div className="flex items-center justify-between gap-4 p-4">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div
          className={`flex size-9 shrink-0 items-center justify-center rounded-tinyrack-md ${
            hasPassword
              ? 'bg-tinyrack-success-surface'
              : 'bg-tinyrack-surface-muted'
          }`}
        >
          <KeyIcon
            className={`size-4 ${
              hasPassword ? 'text-tinyrack-success' : 'text-tinyrack-text-muted'
            }`}
            weight="regular"
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-medium text-tinyrack-sm text-tinyrack-text">
            {t('profile.password.title')}
          </div>
          <div className="text-tinyrack-text-muted text-tinyrack-xs">
            {hasPassword
              ? t('profile.password.status.set')
              : t('profile.password.status.notSet')}
          </div>
          {isConfigManaged && (
            <div className="mt-0.5 flex items-center gap-1 text-tinyrack-text-muted text-tinyrack-xs opacity-40">
              <GearIcon className="size-3 shrink-0" weight="fill" />
              <span>{t('profile.password.configManaged')}</span>
            </div>
          )}
        </div>
      </div>
      {!isConfigManaged && (
        <div className="flex shrink-0 items-center gap-1">
          {hasPassword ? (
            <>
              <TRButton
                appearance="ghost"
                data-testid="profile-password-change"
                intent="primary"
                onClick={() => onOpenModal('change')}
                type="button"
                uiSize="sm"
              >
                {t('profile.password.change')}
              </TRButton>
              {hasLinkedOAuth ? (
                <TRButton
                  appearance="ghost"
                  data-testid="profile-password-remove"
                  intent="danger"
                  onClick={() => onOpenModal('remove')}
                  type="button"
                  uiSize="sm"
                >
                  {t('profile.password.remove')}
                </TRButton>
              ) : null}
              {!hasLinkedOAuth && hasSecondFactorOnly && (
                <TRTooltip.Root>
                  <TRTooltip.Trigger
                    render={
                      <TRButton
                        appearance="ghost"
                        disabled
                        type="button"
                        uiSize="sm"
                      >
                        {t('profile.password.remove')}
                      </TRButton>
                    }
                  />
                  <TRTooltip.Portal>
                    <TRTooltip.Positioner>
                      <TRTooltip.Popup className="max-w-64 rounded-tinyrack-md border border-tinyrack-border bg-tinyrack-surface p-3 text-tinyrack-text text-tinyrack-xs shadow-tinyrack-overlay">
                        <div className="flex items-start gap-2">
                          <InfoIcon className="size-4 shrink-0 text-tinyrack-warning" />
                          <div>
                            {t('profile.password.removeDisabledReason')}
                          </div>
                        </div>
                      </TRTooltip.Popup>
                    </TRTooltip.Positioner>
                  </TRTooltip.Portal>
                </TRTooltip.Root>
              )}
            </>
          ) : (
            <TRButton
              appearance="ghost"
              data-testid="profile-password-set"
              intent="primary"
              onClick={() => onOpenModal('set')}
              type="button"
              uiSize="sm"
            >
              {t('profile.password.set')}
            </TRButton>
          )}
        </div>
      )}
    </div>
  );
}
