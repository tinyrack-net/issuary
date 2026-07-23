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
      <TRCard.Header className="border-border border-b px-4 py-3">
        <TRCard.Title className="font-semibold text-sm">
          {t('profile.account.title')}
        </TRCard.Title>
        <TRCard.Description className="text-muted-foreground text-xs">
          {t('profile.account.description')}
        </TRCard.Description>
      </TRCard.Header>
      <TRCard.Content className="divide-y divide-border p-0">
        <div className="flex items-center justify-between gap-4 px-4 py-3">
          <span className="shrink-0 text-muted-foreground text-xs">
            {t('profile.id.label')}
          </span>
          <span className="truncate font-medium text-sm">{user.sub}</span>
        </div>

        <div className="flex items-center justify-between gap-4 px-4 py-3">
          <span className="shrink-0 text-muted-foreground text-xs">
            {t('profile.email.label')}
          </span>
          <span className="truncate font-medium text-sm">{user.email}</span>
        </div>
      </TRCard.Content>
    </TRCard.Root>
  );
}
