import { useSuspenseQueries, useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, Link, redirect } from '@tanstack/react-router';
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
        <p className="text-center text-base-content/60">
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
      <div className="stats stats-vertical lg:stats-horizontal w-full overflow-hidden rounded-[1.5rem] border border-white/10 bg-white/[0.035] shadow-[0_24px_80px_rgba(0,0,0,0.24)] backdrop-blur-xl">
        <MetricStat
          accent="from-[#7170ff] to-[#9da3ff]"
          hint={t('admin.metrics.totalUsersHint')}
          label={t('admin.metrics.totalUsers')}
          value={data.pagination.total}
        />
        <MetricStat
          accent="from-emerald-400 to-teal-300"
          hint={t('admin.metrics.adminsHint')}
          label={t('admin.metrics.admins')}
          value={admins}
        />
        <MetricStat
          accent="from-sky-400 to-cyan-300"
          hint={t('admin.metrics.databaseUsersHint')}
          label={t('admin.metrics.databaseUsers')}
          value={databaseUsers}
        />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.35fr_0.75fr]">
        <section className="card overflow-hidden border border-white/10 bg-white/[0.035] shadow-[0_24px_80px_rgba(0,0,0,0.22)] backdrop-blur-xl">
          <div className="card-body p-0">
            <div className="flex flex-col gap-4 border-white/10 border-b p-6 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="mb-2 flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-[#7170ff] shadow-[0_0_18px_rgba(113,112,255,0.8)]" />
                  <span className="font-medium text-slate-500 text-xs uppercase tracking-[0.18em]">
                    {t('admin.identityGraph')}
                  </span>
                </div>
                <h2 className="card-title text-slate-100">
                  {t('admin.users.title')}
                </h2>
                <p className="mt-1 text-slate-400 text-sm">
                  {t('admin.users.description')}
                </p>
              </div>
              <Link
                className="btn btn-primary btn-sm border-0 bg-[#7170ff] text-white shadow-[0_14px_40px_rgba(113,112,255,0.32)] hover:bg-[#828fff]"
                to="/admin/users"
              >
                {t('admin.users.open')}
              </Link>
            </div>

            <div className="grid gap-0 divide-y divide-white/10 md:grid-cols-2 md:divide-x md:divide-y-0">
              {data.users.slice(0, 4).map((managedUser) => (
                <div
                  className="group bg-white/[0.015] p-5 transition hover:bg-white/[0.045]"
                  key={managedUser.sub}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-100 text-sm">
                        {managedUser.email}
                      </p>
                      <p className="mt-1 truncate font-mono text-slate-600 text-xs">
                        {managedUser.sub}
                      </p>
                    </div>
                    <span
                      className={
                        managedUser.role === 'admin'
                          ? 'badge badge-primary border-[#7170ff]/30 bg-[#7170ff]/20 text-[#c7c8ff]'
                          : 'badge badge-outline border-white/15 text-slate-400'
                      }
                    >
                      {formatAdminRole(t, managedUser.role)}
                    </span>
                  </div>
                  <div className="mt-4 flex items-center justify-between text-xs">
                    <span className="badge badge-ghost border-white/10 bg-white/[0.035] text-slate-400">
                      {formatManagedBy(t, managedUser.managed_by)}
                    </span>
                    <span className="text-slate-500">
                      {t('admin.users.verifiedLabel')}{' '}
                      {managedUser.email_verified
                        ? t('common.yes')
                        : t('common.no')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="card overflow-hidden border border-[#7170ff]/20 bg-[linear-gradient(145deg,rgba(113,112,255,0.18),rgba(255,255,255,0.035)_45%,rgba(16,185,129,0.10))] text-slate-100 shadow-[0_24px_80px_rgba(0,0,0,0.25)] backdrop-blur-xl">
          <div className="card-body">
            <div className="badge badge-primary badge-outline border-[#7170ff]/40 bg-[#7170ff]/10 text-[#c7c8ff]">
              {t('admin.policy.title')}
            </div>
            <h2 className="card-title mt-3 text-2xl tracking-[-0.03em]">
              {t('admin.policy.heading')}
            </h2>
            <p className="mt-1 text-slate-400 text-sm">
              {t('admin.policy.description')}
            </p>
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
          </div>
        </section>
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
    <div className="stat border-white/10 bg-transparent p-6">
      <div
        className={`mb-4 h-1.5 w-16 rounded-full bg-gradient-to-r ${accent}`}
      />
      <div className="stat-title text-slate-500">{label}</div>
      <div className="stat-value mt-1 text-slate-50 tracking-[-0.06em]">
        {value}
      </div>
      <div className="stat-desc mt-2 text-slate-500">{hint}</div>
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
    <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
      <span className="text-slate-300">{label}</span>
      <span className="badge badge-primary border-[#7170ff]/30 bg-[#7170ff]/20 text-[#d7d8ff]">
        {value}
      </span>
    </div>
  );
}
