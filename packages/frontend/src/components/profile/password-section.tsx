import { KeyIcon } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';

type PasswordModalType = 'set' | 'change' | 'remove' | null;

interface PasswordSectionProps {
  hasPassword: boolean;
  hasLinkedOAuth: boolean;
  isConfigManaged: boolean;
  onOpenModal: (type: PasswordModalType) => void;
}

export function PasswordSection({
  hasPassword,
  hasLinkedOAuth,
  isConfigManaged,
  onOpenModal,
}: PasswordSectionProps) {
  const { t } = useTranslation();

  return (
    <div className="mb-4">
      <h2 className="mb-2 font-semibold text-sm">
        {t('profile.password.title')}
      </h2>
      <p className="mb-3 text-base-content/60 text-xs">
        {t('profile.password.description')}
      </p>
      <div className="rounded-lg bg-base-200 p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <KeyIcon
              className={`size-4 ${
                hasPassword ? 'text-success' : 'text-base-content/50'
              }`}
              weight="regular"
            />
            <span className="text-sm">
              {hasPassword
                ? t('profile.password.status.set')
                : t('profile.password.status.notSet')}
            </span>
          </div>
          <div className="flex gap-1">
            {isConfigManaged ? (
              <span className="text-base-content/50 text-xs">
                {t('profile.password.configManaged')}
              </span>
            ) : hasPassword ? (
              <>
                <button
                  type="button"
                  className="btn btn-ghost btn-xs text-primary"
                  onClick={() => onOpenModal('change')}
                >
                  {t('profile.password.change')}
                </button>
                {hasLinkedOAuth && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-xs text-error"
                    onClick={() => onOpenModal('remove')}
                  >
                    {t('profile.password.remove')}
                  </button>
                )}
              </>
            ) : (
              <button
                type="button"
                className="btn btn-ghost btn-xs text-primary"
                onClick={() => onOpenModal('set')}
              >
                {t('profile.password.set')}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
