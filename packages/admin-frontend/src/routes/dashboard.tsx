import { useSuspenseQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '#admin/components/page-header.js';
import { adminSessionQueryOptions } from '#admin/queries/admin.js';

export function DashboardPage() {
  const { t } = useTranslation();
  const { data: session } = useSuspenseQuery(adminSessionQueryOptions);

  return (
    <section className="space-y-6">
      <PageHeader
        subtitle={t('dashboard.subtitle')}
        title={t('dashboard.title')}
      />
      <div className="stats stats-vertical lg:stats-horizontal w-full border border-base-300 bg-base-100 shadow-sm">
        <article className="stat gap-2">
          <div className="stat-title font-semibold uppercase tracking-wide">
            {t('dashboard.currentAdmin')}
          </div>
          <div className="stat-value whitespace-normal break-all text-lg">
            {session.user.email}
          </div>
          <div className="stat-desc break-all font-mono text-xs">
            {session.user.sub}
          </div>
        </article>
        <article className="stat gap-2">
          <div className="stat-title font-semibold uppercase tracking-wide">
            {t('dashboard.sessionState')}
          </div>
          <div className="stat-value text-lg">
            <span className="badge badge-success badge-lg">
              {t('dashboard.verifiedAdmin')}
            </span>
          </div>
        </article>
        <article className="stat gap-2">
          <div className="stat-title font-semibold uppercase tracking-wide">
            {t('dashboard.managedBy')}
          </div>
          <div className="stat-value text-lg">
            <span className="badge badge-outline badge-lg">
              {session.user.managed_by}
            </span>
          </div>
        </article>
      </div>
    </section>
  );
}
