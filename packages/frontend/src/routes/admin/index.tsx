import { useSuspenseQueries, useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, Link, redirect } from '@tanstack/react-router';
import { TRBadge } from '@tinyrack/ui/components/badge';
import { TRCard } from '@tinyrack/ui/components/card';
import { TRLinkButton } from '@tinyrack/ui/components/link-button';
import { useTranslation } from 'react-i18next';
import { AdminDisabledPanel } from '#frontend/features/admin/admin-disabled-panel.tsx';
import { AdminShell } from '#frontend/features/admin/admin-shell.tsx';
import { PageLayout } from '#frontend/features/layout/page-layout.tsx';
import { adminUsersQueryOptions } from '#frontend/queries/admin-users.ts';
import { appConfigQueryOptions } from '#frontend/queries/config.ts';
import type { SessionUser } from '#frontend/queries/session.ts';
export const Route = createFileRoute('/admin/')({
  component: AdminDashboard,
  beforeLoad: async ({ context }) => {
    if (!context.user) {
      throw redirect({
        to: '/login',
      });
    }
  },
});

function AdminDashboard() {
  const { t } = useTranslation();
  const user = Route.useRouteContext({ select: (context) => context.user });

  if (user?.role !== 'admin') {
    return (
      <PageLayout cardPadding maxWidth="md">
        <h1 className="mb-2 text-center font-bold text-2xl">
          {t('admin.accessRequired')}
        </h1>
        <p className="text-center text-tinyrack-text-muted">
          {t('admin.accessRequiredDescription')}
        </p>
      </PageLayout>
    );
  }

  return <AdminDashboardGate user={user} />;
}

function AdminDashboardGate({ user }: { user: SessionUser }) {
  const { data: config } = useSuspenseQuery(appConfigQueryOptions);
  if (!config.admin.enabled) {
    return <AdminDisabledPanel />;
  }
  return <AdminDashboardContent user={user} />;
}

function AdminDashboardContent({ user }: { user: SessionUser }) {
  const { t } = useTranslation();
  const [usersQuery, adminQuery, configQuery, databaseQuery] =
    useSuspenseQueries({
      queries: [
        adminUsersQueryOptions(),
        adminUsersQueryOptions({ pageSize: 1, role: 'admin' }),
        adminUsersQueryOptions({ managedBy: 'config', pageSize: 1 }),
        adminUsersQueryOptions({ managedBy: 'database', pageSize: 1 }),
      ],
    });
  const data = usersQuery.data;
  const configUsers = configQuery.data.pagination.total;
  const databaseUsers = databaseQuery.data.pagination.total;
  const admins = adminQuery.data.pagination.total;

  return (
    <AdminShell
      current="dashboard"
      description={t('admin.dashboardDescription')}
      title={t('admin.dashboardTitle')}
      user={user}
    >
      <div className="flex flex-col divide-y divide-tinyrack-border overflow-hidden rounded-tinyrack-lg border border-tinyrack-border bg-tinyrack-surface shadow-tinyrack-raised lg:flex-row lg:divide-x lg:divide-y-0">
        <MetricStat
          accent="bg-tinyrack-primary"
          hint={t('admin.metrics.totalUsersHint')}
          label={t('admin.metrics.totalUsers')}
          value={data.pagination.total}
        />
        <MetricStat
          accent="bg-tinyrack-success"
          hint={t('admin.metrics.adminsHint')}
          label={t('admin.metrics.admins')}
          value={admins}
        />
        <MetricStat
          accent="bg-tinyrack-info"
          hint={t('admin.metrics.databaseUsersHint')}
          label={t('admin.metrics.databaseUsers')}
          value={databaseUsers}
        />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.35fr_0.75fr]">
        <TRCard.Root
          className="overflow-hidden border-tinyrack-border shadow-tinyrack-raised"
          variant="outlined"
        >
          <TRCard.Content className="p-0">
            <div className="flex flex-col gap-4 border-tinyrack-border border-b p-6 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="mb-2 flex items-center gap-2">
                  <span className="h-2 w-2 rounded-tinyrack-full bg-tinyrack-primary" />
                  <span className="font-medium text-tinyrack-text-muted text-tinyrack-xs uppercase tracking-wide">
                    {t('admin.identityGraph')}
                  </span>
                </div>
                <TRCard.Title>{t('admin.users.title')}</TRCard.Title>
                <TRCard.Description className="mt-1 text-tinyrack-sm">
                  {t('admin.users.description')}
                </TRCard.Description>
              </div>
              <TRLinkButton
                intent="primary"
                render={<Link to="/admin/users" />}
                uiSize="sm"
              >
                {t('admin.users.open')}
              </TRLinkButton>
            </div>

            <div className="grid gap-0 divide-y divide-tinyrack-border md:grid-cols-2 md:divide-x md:divide-y-0">
              {data.users.slice(0, 4).map((managedUser) => (
                <div
                  className="group bg-tinyrack-surface p-5 transition hover:bg-tinyrack-surface-hover"
                  key={managedUser.sub}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-tinyrack-sm text-tinyrack-text">
                        {managedUser.email}
                      </p>
                      <p className="mt-1 truncate font-mono text-tinyrack-text-muted text-tinyrack-xs">
                        {managedUser.sub}
                      </p>
                    </div>
                    <TRBadge
                      uiSize="sm"
                      variant={
                        managedUser.role === 'admin' ? 'neutral' : undefined
                      }
                    >
                      {formatAdminRole(t, managedUser.role)}
                    </TRBadge>
                  </div>
                  <div className="mt-4 flex items-center justify-between text-xs">
                    <TRBadge uiSize="sm">
                      {formatManagedBy(t, managedUser.managed_by)}
                    </TRBadge>
                    <span className="text-tinyrack-text-muted">
                      {t('admin.users.verifiedLabel')}{' '}
                      {managedUser.email_verified
                        ? t('common.yes')
                        : t('common.no')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </TRCard.Content>
        </TRCard.Root>

        <TRCard.Root
          className="overflow-hidden border-tinyrack-border shadow-tinyrack-raised"
          variant="outlined"
        >
          <TRCard.Content>
            <TRBadge uiSize="sm" variant="neutral">
              {t('admin.policy.title')}
            </TRBadge>
            <TRCard.Title className="mt-3 text-tinyrack-xl">
              {t('admin.policy.heading')}
            </TRCard.Title>
            <TRCard.Description className="mt-1 text-tinyrack-sm">
              {t('admin.policy.description')}
            </TRCard.Description>
            <div className="mt-6 space-y-3">
              <PolicyRow
                label={t('admin.metrics.configUsers')}
                value={configUsers}
              />
              <PolicyRow
                label={t('admin.metrics.databaseUsers')}
                value={databaseUsers}
              />
              <PolicyRow
                label={t('admin.policy.configReadonly')}
                value={t('common.on')}
              />
            </div>
          </TRCard.Content>
        </TRCard.Root>
      </div>
    </AdminShell>
  );
}

function formatAdminRole(
  t: ReturnType<typeof useTranslation>['t'],
  role: SessionUser['role'],
) {
  return role === 'admin'
    ? t('admin.users.roleAdmin')
    : t('admin.users.roleUser');
}

function formatManagedBy(
  t: ReturnType<typeof useTranslation>['t'],
  managedBy: 'database' | 'config',
) {
  return managedBy === 'database'
    ? t('admin.users.sourceDatabase')
    : t('admin.users.sourceConfig');
}

function MetricStat({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: number;
  hint: string;
  accent: string;
}) {
  return (
    <div className="flex-1 p-6">
      <div className={`mb-4 h-1.5 w-16 rounded-tinyrack-full ${accent}`} />
      <div className="text-tinyrack-sm text-tinyrack-text-muted">{label}</div>
      <div className="mt-1 font-bold text-tinyrack-3xl text-tinyrack-text">
        {value}
      </div>
      <div className="mt-2 text-tinyrack-text-muted text-tinyrack-xs">
        {hint}
      </div>
    </div>
  );
}

function PolicyRow({
  label,
  value,
}: {
  label: string;
  value: number | string;
}) {
  return (
    <div className="flex items-center justify-between rounded-tinyrack-md border border-tinyrack-border bg-tinyrack-surface-muted px-4 py-3">
      <span className="text-tinyrack-text-muted">{label}</span>
      <TRBadge uiSize="sm" variant="neutral">
        {value}
      </TRBadge>
    </div>
  );
}
