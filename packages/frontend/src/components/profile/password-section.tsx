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
          <div className="truncate text-base-content/60 text-xs">
            {hasPassword
              ? t('profile.password.status.set')
              : t('profile.password.status.notSet')}
          </div>
        </div>
      </div>
      <div className="flex shrink-0 gap-1">
        {isConfigManaged ? (
          <span className="max-w-32 text-right text-base-content/50 text-xs">
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
  );
}
