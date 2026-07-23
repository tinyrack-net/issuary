import { TrashIcon, WarningIcon } from '@phosphor-icons/react';
import { TRButton } from '@tinyrack/ui/components/button';
import { TRCard } from '@tinyrack/ui/components/card';
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

  if (!isDeletionEnabled) {
    return null;
  }

  return (
    <TRCard.Root className="border-danger/60 border-l-4" variant="outlined">
      <TRCard.Header className="border-border border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <WarningIcon className="size-4 text-danger" weight="fill" />
          <TRCard.Title className="font-semibold text-danger text-sm">
            {t('profile.dangerZone.title')}
          </TRCard.Title>
        </div>
        <TRCard.Description className="mt-0.5 text-muted-foreground text-xs">
          {t('profile.dangerZone.description')}
        </TRCard.Description>
      </TRCard.Header>
      <TRCard.Content className="px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="font-medium text-sm">
              {t('profile.deleteAccount.title')}
            </p>
            <p className="text-muted-foreground text-xs">
              {isConfigManaged
                ? t('profile.deleteAccount.configManaged')
                : t('profile.deleteAccount.description')}
            </p>
          </div>
          <TRButton
            appearance="outline"
            data-testid="profile-delete-account"
            disabled={isConfigManaged}
            intent="danger"
            onClick={onDeleteClick}
            type="button"
            uiSize="sm"
          >
            <TrashIcon className="size-4" weight="bold" />
            {t('profile.deleteAccount.button')}
          </TRButton>
        </div>
      </TRCard.Content>
    </TRCard.Root>
  );
}
