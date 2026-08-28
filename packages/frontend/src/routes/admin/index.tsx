import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, redirect } from '@tanstack/react-router';
import { TRBadge } from '@tinyrack/ui/components/badge';
import { TRTable } from '@tinyrack/ui/components/table';
import { TRText } from '@tinyrack/ui/components/text';
import { useTranslation } from 'react-i18next';
import { AdminGateScreen } from '#frontend/features/admin/admin-gate-screen.tsx';
import { AdminShell } from '#frontend/features/admin/admin-shell.tsx';
import { adminOverviewQueryOptions } from '#frontend/queries/admin-console.ts';
import { appConfigQueryOptions } from '#frontend/queries/config.ts';
import type { SessionUser } from '#frontend/queries/session.ts';

export const Route = createFileRoute('/admin/')({
  component: AdminDashboard,
  beforeLoad: async ({ context }) => {
    if (!context.user) throw redirect({ to: '/login' });
  },
});

function AdminDashboard() {
  const user = Route.useRouteContext({ select: (context) => context.user });
  if (user?.role !== 'admin')
    return <AdminGateScreen reason="access-required" />;
  return <AdminDashboardGate user={user} />;
}

function AdminDashboardGate({ user }: { user: SessionUser }) {
  const { data: config } = useSuspenseQuery(appConfigQueryOptions);
  if (!config.admin.enabled)
    return <AdminGateScreen reason="console-disabled" />;
  return <AdminDashboardContent user={user} />;
}

function AdminDashboardContent({ user }: { user: SessionUser }) {
  const { t } = useTranslation();
  const { data } = useSuspenseQuery(adminOverviewQueryOptions);
  const metrics = [
    ['admin.overview.activeUsers', data.metrics.active_users],
    ['admin.overview.admins', data.metrics.admins],
    ['admin.overview.activeClients', data.metrics.active_clients],
    ['admin.overview.requiredTerms', data.metrics.required_terms],
  ];
  return (
    <AdminShell
      current="dashboard"
      title={t('admin.dashboardTitle')}
      user={user}
    >
      <div className="grid grid-cols-2 bg-tinyrack-surface lg:grid-cols-4">
        {metrics.map(([label, value]) => (
          <div
            className="flex flex-col gap-tinyrack-xs px-tinyrack-lg py-tinyrack-md"
            key={label}
          >
            <TRText color="muted" variant="label">
              {t(String(label))}
            </TRText>
            <TRText as="p" variant="headingLg">
              {value}
            </TRText>
          </div>
        ))}
      </div>
      <div className="grid gap-tinyrack-lg xl:grid-cols-2">
        <OverviewTable
          rows={[
            [t('admin.source.config'), data.users.source.config],
            [t('admin.source.database'), data.users.source.database],
          ]}
          title={t('admin.overview.userSource')}
        />
        <OverviewTable
          rows={[
            [
              t('admin.overview.emailVerified'),
              data.users.authentication.email_verified,
            ],
            [
              t('admin.overview.twoFactor'),
              data.users.authentication.two_factor,
            ],
            [
              t('admin.overview.unverified'),
              data.users.authentication.remaining,
            ],
          ]}
          title={t('admin.overview.authentication')}
        />
      </div>
      <section>
        <header className="bg-tinyrack-surface px-tinyrack-lg py-tinyrack-md">
          <TRText as="h2" variant="headingSm">
            {t('admin.overview.serviceStatus')}
          </TRText>
        </header>
        <TRTable.Root density="compact">
          <TRTable.Body>
            {Object.entries(data.status).map(([key, value]) => (
              <TRTable.Row key={key}>
                <TRTable.Cell>{t(`admin.status.${key}`)}</TRTable.Cell>
                <TRTable.Cell className="text-right">
                  <TRBadge
                    variant={
                      value === false || value === 'disabled'
                        ? 'neutral'
                        : 'success'
                    }
                  >
                    {typeof value === 'boolean'
                      ? t(value ? 'common.on' : 'common.off')
                      : t(`admin.statusValue.${value}`)}
                  </TRBadge>
                </TRTable.Cell>
              </TRTable.Row>
            ))}
          </TRTable.Body>
        </TRTable.Root>
      </section>
    </AdminShell>
  );
}

function OverviewTable({
  title,
  rows,
}: {
  title: string;
  rows: Array<[string, number]>;
}) {
  return (
    <section>
      <header className="bg-tinyrack-surface px-tinyrack-lg py-tinyrack-md">
        <TRText as="h2" variant="headingSm">
          {title}
        </TRText>
      </header>
      <TRTable.Root density="compact">
        <TRTable.Body>
          {rows.map(([label, value]) => (
            <TRTable.Row key={label}>
              <TRTable.Cell>{label}</TRTable.Cell>
              <TRTable.Cell className="text-right font-tinyrack-medium">
                {value}
              </TRTable.Cell>
            </TRTable.Row>
          ))}
        </TRTable.Body>
      </TRTable.Root>
    </section>
  );
}
