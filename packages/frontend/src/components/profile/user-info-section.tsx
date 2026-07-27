import { TRCard } from '@tinyrack/ui/components/card';
import { TRText } from '@tinyrack/ui/components/text';
import { useTranslation } from 'react-i18next';

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-tinyrack-lg px-tinyrack-lg py-tinyrack-md">
      <TRText className="shrink-0" color="muted" variant="caption">
        {label}
      </TRText>
      <TRText truncate variant="bodySm" weight="medium">
        {value}
      </TRText>
    </div>
  );
}

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
      <TRCard.Header className="border-tinyrack-border border-b px-tinyrack-lg py-tinyrack-md">
        <TRCard.Title>{t('profile.account.title')}</TRCard.Title>
        <TRCard.Description>
          {t('profile.account.description')}
        </TRCard.Description>
      </TRCard.Header>
      <TRCard.Content className="divide-y divide-tinyrack-border p-0">
        <InfoRow label={t('profile.id.label')} value={user.sub} />
        <InfoRow label={t('profile.email.label')} value={user.email} />
      </TRCard.Content>
    </TRCard.Root>
  );
}
