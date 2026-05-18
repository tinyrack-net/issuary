import { useSuspenseQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '#admin/components/page-header.js';
import { adminSessionQueryOptions } from '#admin/queries/admin.js';

export function DashboardPage() {
  const { t } = useTranslation();
  const { data: session } = useSuspenseQuery(adminSessionQueryOptions);

  return (
    <section>
      <PageHeader
        subtitle={t('dashboard.subtitle')}
        title={t('dashboard.title')}
      />
      <div className="grid gap-4 md:grid-cols-3">
        <article className="card border border-base-300 bg-base-100 shadow-sm">
          <div className="card-body">
            <h2 className="font-semibold text-base-content/70 text-sm uppercase tracking-wide">
              {t('dashboard.currentAdmin')}
            </h2>
            <p className="font-semibold text-lg">{session.user.email}</p>
            <p className="text-base-content/60 text-sm">{session.user.sub}</p>
          </div>
        </article>
        <article className="card border border-base-300 bg-base-100 shadow-sm">
          <div className="card-body">
            <h2 className="font-semibold text-base-content/70 text-sm uppercase tracking-wide">
              {t('dashboard.sessionState')}
            </h2>
            <span className="badge badge-success w-fit">
              {t('dashboard.verifiedAdmin')}
            </span>
          </div>
        </article>
        <article className="card border border-base-300 bg-base-100 shadow-sm">
          <div className="card-body">
            <h2 className="font-semibold text-base-content/70 text-sm uppercase tracking-wide">
              {t('dashboard.managedBy')}
            </h2>
            <span className="badge badge-outline w-fit">
              {session.user.managed_by}
            </span>
          </div>
        </article>
      </div>
    </section>
  );
}
