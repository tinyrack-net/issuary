import { TrashIcon, WarningIcon } from '@phosphor-icons/react';
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
    <div className="rounded-xl border border-base-200 border-l-4 border-l-error/60">
      <div className="border-base-200 border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <WarningIcon className="size-4 text-error" weight="fill" />
          <h2 className="font-semibold text-error text-sm">
            {t('profile.dangerZone.title')}
          </h2>
        </div>
        <p className="mt-0.5 text-base-content/60 text-xs">
          {t('profile.dangerZone.description')}
        </p>
      </div>
      <div className="px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="font-medium text-sm">
              {t('profile.deleteAccount.title')}
            </p>
            <p className="text-base-content/60 text-xs">
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
            <TrashIcon className="size-4" weight="bold" />
            {t('profile.deleteAccount.button')}
          </button>
        </div>
      </div>
    </div>
  );
}
