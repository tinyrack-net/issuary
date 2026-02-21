import { GearIcon, InfoIcon, KeyIcon } from '@phosphor-icons/react';
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
          className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${
            hasPassword ? 'bg-success/10' : 'bg-base-200'
          }`}
        >
          <KeyIcon
            className={`size-4 ${
              hasPassword ? 'text-success' : 'text-base-content/50'
            }`}
            weight="regular"
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-medium text-sm">
            {t('profile.password.title')}
          </div>
          <div className="text-base-content/60 text-xs">
            {hasPassword
              ? t('profile.password.status.set')
              : t('profile.password.status.notSet')}
          </div>
          {isConfigManaged && (
            <div className="mt-0.5 flex items-center gap-1 text-base-content/40 text-xs">
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
              <button
                className="btn btn-ghost btn-xs text-primary"
                onClick={() => onOpenModal('change')}
                type="button"
              >
                {t('profile.password.change')}
              </button>
              {hasLinkedOAuth ? (
                <button
                  className="btn btn-ghost btn-xs text-error"
                  onClick={() => onOpenModal('remove')}
                  type="button"
                >
                  {t('profile.password.remove')}
                </button>
              ) : null}
              {!hasLinkedOAuth && hasSecondFactorOnly && (
                <div className="dropdown dropdown-end">
                  <button
                    className="btn btn-disabled btn-ghost btn-xs cursor-not-allowed text-base-content/30"
                    type="button"
                  >
                    {t('profile.password.remove')}
                  </button>
                  <div className="dropdown-content z-50 w-64 rounded-xl border border-base-200 bg-base-100 p-4 shadow-lg">
                    <div className="flex items-start gap-2">
                      <InfoIcon className="size-4 shrink-0 text-warning" />
                      <div className="text-xs">
                        {t('profile.password.removeDisabledReason')}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <button
              className="btn btn-ghost btn-xs text-primary"
              onClick={() => onOpenModal('set')}
              type="button"
            >
              {t('profile.password.set')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
