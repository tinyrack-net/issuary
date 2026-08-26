import { TRButton } from '@tinyrack/ui/components/button';
import { TRCard } from '@tinyrack/ui/components/card';
import { TRText } from '@tinyrack/ui/components/text';
import { Trash2Icon, TriangleAlertIcon } from 'lucide-react';
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
    <TRCard.Root
      className="border-tinyrack-danger-border bg-tinyrack-danger-surface"
      variant="outlined"
    >
      <TRCard.Header className="border-tinyrack-danger-border border-b-tinyrack-default px-tinyrack-lg py-tinyrack-md">
        <div className="flex items-center gap-tinyrack-sm">
          <TriangleAlertIcon
            aria-hidden
            className="size-tinyrack-lg text-tinyrack-danger-foreground"
          />
          <TRCard.Title className="text-tinyrack-danger-foreground">
            {t('profile.dangerZone.title')}
          </TRCard.Title>
        </div>
        <TRCard.Description>
          {t('profile.dangerZone.description')}
        </TRCard.Description>
      </TRCard.Header>
      <TRCard.Content className="px-tinyrack-lg py-tinyrack-md">
        <div className="flex items-center justify-between gap-tinyrack-lg">
          <div className="flex min-w-0 flex-1 flex-col gap-tinyrack-3xs">
            <TRText as="p" variant="bodySm" weight="medium">
              {t('profile.deleteAccount.title')}
            </TRText>
            <TRText as="p" color="muted" variant="caption">
              {isConfigManaged
                ? t('profile.deleteAccount.configManaged')
                : t('profile.deleteAccount.description')}
            </TRText>
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
            <Trash2Icon aria-hidden className="size-tinyrack-lg" />
            {t('profile.deleteAccount.button')}
          </TRButton>
        </div>
      </TRCard.Content>
    </TRCard.Root>
  );
}
