import { Trash, Warning } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';

interface DangerZoneSectionProps {
  isConfigManaged: boolean;
  isDeletionEnabled: boolean;
  onDeleteClick: () => void;
}

export function DangerZoneSection({
  isConfigManaged,
  isDeletionEnabled,
  onDeleteClick,
}: DangerZoneSectionProps) {
  const { t } = useTranslation();

  // Don't render if deletion is disabled
  if (!isDeletionEnabled) {
    return null;
  }

  return (
    <div className="rounded-xl border border-error/30 bg-error/5">
      <div className="border-error/30 border-b p-4">
        <div className="flex items-center gap-2">
          <Warning className="size-5 text-error" weight="fill" />
          <h2 className="font-semibold text-error">
            {t('profile.dangerZone.title')}
          </h2>
        </div>
        <p className="mt-1 text-base-content/60 text-sm">
          {t('profile.dangerZone.description')}
        </p>
      </div>
      <div className="p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1">
            <p className="font-medium">{t('profile.deleteAccount.title')}</p>
            <p className="text-base-content/60 text-sm">
              {isConfigManaged
                ? t('profile.deleteAccount.configManaged')
                : t('profile.deleteAccount.description')}
            </p>
          </div>
          <button
            type="button"
            className="btn btn-error btn-outline btn-sm gap-2"
            onClick={onDeleteClick}
            disabled={isConfigManaged}
          >
            <Trash className="size-4" weight="bold" />
            {t('profile.deleteAccount.button')}
          </button>
        </div>
      </div>
    </div>
  );
}
