import { TRCard } from '@tinyrack/ui/components/card';
import { useTranslation } from 'react-i18next';

interface UserInfoSectionProps {
  user: {
    sub: string;
    email: string;
  };
}

export function UserInfoSection({ user }: UserInfoSectionProps) {
  const { t } = useTranslation();

  return (
    <TRCard.Root variant="outlined">
      <TRCard.Header className="border-tinyrack-border border-b px-4 py-3">
        <TRCard.Title className="font-semibold text-tinyrack-md text-tinyrack-text">
          {t('profile.account.title')}
        </TRCard.Title>
        <TRCard.Description className="text-tinyrack-text-muted text-tinyrack-xs">
          {t('profile.account.description')}
        </TRCard.Description>
      </TRCard.Header>
      <TRCard.Content className="divide-y divide-tinyrack-border p-0">
        <div className="flex items-center justify-between gap-4 px-4 py-3">
          <span className="shrink-0 text-tinyrack-text-muted text-tinyrack-xs">
            {t('profile.id.label')}
          </span>
          <span className="truncate font-medium text-tinyrack-sm text-tinyrack-text">
            {user.sub}
          </span>
        </div>

        <div className="flex items-center justify-between gap-4 px-4 py-3">
          <span className="shrink-0 text-tinyrack-text-muted text-tinyrack-xs">
            {t('profile.email.label')}
          </span>
          <span className="truncate font-medium text-tinyrack-sm text-tinyrack-text">
            {user.email}
          </span>
        </div>
      </TRCard.Content>
    </TRCard.Root>
  );
}
