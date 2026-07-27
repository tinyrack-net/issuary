import { useTranslation } from 'react-i18next';
import { AdminStat } from '#frontend/features/admin/admin-stat.tsx';

type AdminUsersSummaryProps = {
  active: number;
  config: number;
  database: number;
};

/** Counts for the page currently in view, not the whole directory. */
export function AdminUsersSummary({
  active,
  config,
  database,
}: AdminUsersSummaryProps) {
  const { t } = useTranslation();
  const hint = t('admin.users.currentPage');

  return (
    <div className="flex flex-col overflow-hidden rounded-tinyrack-lg border border-tinyrack-border bg-tinyrack-surface shadow-tinyrack-raised lg:flex-row lg:divide-x lg:divide-tinyrack-border">
      <AdminStat
        hint={hint}
        label={t('admin.users.activeOnPage')}
        value={active}
      />
      <AdminStat
        hint={hint}
        label={t('admin.users.configOnPage')}
        value={config}
      />
      <AdminStat
        hint={hint}
        label={t('admin.users.databaseOnPage')}
        value={database}
      />
    </div>
  );
}
