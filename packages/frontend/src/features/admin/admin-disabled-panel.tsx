import { useTranslation } from 'react-i18next';
import { PageLayout } from '#frontend/features/layout/page-layout.tsx';

export function AdminDisabledPanel() {
  const { t } = useTranslation();

  return (
    <PageLayout cardPadding maxWidth="md">
      <h1 className="mb-2 text-center font-bold text-2xl">
        {t('admin.disabled')}
      </h1>
      <p className="text-center text-muted-foreground">
        {t('admin.disabledDescription')}
      </p>
    </PageLayout>
  );
}
