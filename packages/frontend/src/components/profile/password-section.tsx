import { TRButton } from '@tinyrack/ui/components/button';
import { TRText } from '@tinyrack/ui/components/text';
import { TRTooltip } from '@tinyrack/ui/components/tooltip';
import { InfoIcon, KeyRoundIcon, SettingsIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { SecurityRow } from '#frontend/components/profile/security-row.tsx';

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
    <SecurityRow
      actions={
        isConfigManaged ? undefined : hasPassword ? (
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
                    <TRTooltip.Popup className="max-w-tinyrack-measure-lg rounded-tinyrack-md border border-tinyrack-border bg-tinyrack-surface p-tinyrack-md text-tinyrack-text text-tinyrack-xs shadow-tinyrack-overlay">
                      <div className="flex items-start gap-tinyrack-sm">
                        <InfoIcon
                          aria-hidden
                          className="size-tinyrack-lg shrink-0 text-tinyrack-warning-foreground"
                        />
                        <TRText variant="caption">
                          {t('profile.password.removeDisabledReason')}
                        </TRText>
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
        )
      }
      active={hasPassword}
      icon={KeyRoundIcon}
      note={
        isConfigManaged ? (
          <div className="flex items-center gap-tinyrack-xs">
            <SettingsIcon aria-hidden className="size-tinyrack-md shrink-0" />
            <TRText as="span" color="muted" variant="caption">
              {t('profile.password.configManaged')}
            </TRText>
          </div>
        ) : undefined
      }
      status={
        hasPassword
          ? t('profile.password.status.set')
          : t('profile.password.status.notSet')
      }
      title={t('profile.password.title')}
    />
  );
}
