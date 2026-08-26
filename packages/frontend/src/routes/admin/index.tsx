import { useSuspenseQueries, useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, Link, redirect } from '@tanstack/react-router';
import { TRBadge } from '@tinyrack/ui/components/badge';
import { TRCard } from '@tinyrack/ui/components/card';
import { TRLinkButton } from '@tinyrack/ui/components/link-button';
import { TRText } from '@tinyrack/ui/components/text';
import { NetworkIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { AdminGateScreen } from '#frontend/features/admin/admin-gate-screen.tsx';
import { AdminShell } from '#frontend/features/admin/admin-shell.tsx';
import { AdminStat } from '#frontend/features/admin/admin-stat.tsx';
import {
  formatAdminRole,
  formatManagedBy,
} from '#frontend/features/admin/format-admin-user.ts';
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
  const user = Route.useRouteContext({ select: (context) => context.user });

  if (user?.role !== 'admin') {
    return <AdminGateScreen reason="access-required" />;
  }

  return <AdminDashboardGate user={user} />;
}

function AdminDashboardGate({ user }: { user: SessionUser }) {
  const { data: config } = useSuspenseQuery(appConfigQueryOptions);
  if (!config.admin.enabled) {
    return <AdminGateScreen reason="console-disabled" />;
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
        <AdminStat
          accent="bg-tinyrack-primary"
          hint={t('admin.metrics.totalUsersHint')}
          label={t('admin.metrics.totalUsers')}
          value={data.pagination.total}
        />
        <AdminStat
          accent="bg-tinyrack-success"
          hint={t('admin.metrics.adminsHint')}
          label={t('admin.metrics.admins')}
          value={admins}
        />
        <AdminStat
          accent="bg-tinyrack-info"
          hint={t('admin.metrics.databaseUsersHint')}
          label={t('admin.metrics.databaseUsers')}
          value={databaseUsers}
        />
      </div>

      {/* 2:1 rather than the 1.35:0.75 arbitrary value — the same ratio to the eye. */}
      <div className="grid gap-tinyrack-xl xl:grid-cols-3">
        <TRCard.Root
          className="overflow-hidden border-tinyrack-border shadow-tinyrack-raised xl:col-span-2"
          variant="outlined"
        >
          <TRCard.Content className="p-0">
            <div className="flex flex-col gap-tinyrack-lg border-tinyrack-border border-b-tinyrack-default p-tinyrack-xl sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-col gap-tinyrack-sm">
                <div className="flex items-center gap-tinyrack-sm">
                  <NetworkIcon
                    aria-hidden
                    className="size-tinyrack-lg text-tinyrack-primary-foreground"
                  />
                  <TRText color="muted" variant="label">
                    {t('admin.identityGraph')}
                  </TRText>
                </div>
                <TRCard.Title>{t('admin.users.title')}</TRCard.Title>
                <TRCard.Description className="text-tinyrack-sm">
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

            <div className="grid divide-y divide-tinyrack-border [gap:0] md:grid-cols-2 md:divide-x md:divide-y-0">
              {data.users.slice(0, 4).map((managedUser) => (
                <Link
                  className="group flex flex-col gap-tinyrack-lg bg-tinyrack-surface p-tinyrack-lg transition hover:bg-tinyrack-surface-hover"
                  key={managedUser.sub}
                  to="/admin/users"
                >
                  <div className="flex items-start justify-between gap-tinyrack-lg">
                    <div className="flex min-w-0 flex-col gap-tinyrack-xs">
                      <TRText as="p" truncate variant="bodySm" weight="medium">
                        {managedUser.email}
                      </TRText>
                      {/*
                        Mono on a bare span: a font utility on `TRText` loses to
                        the component's own per-variant `font-family` rule.
                      */}
                      <TRText as="p" color="muted" truncate variant="caption">
                        <span className="font-tinyrack-mono">
                          {managedUser.sub}
                        </span>
                      </TRText>
                    </div>
                    {/* `shrink-0`: without it the tile squeezes the badge and
                        "User" wraps to two lines. */}
                    <TRBadge
                      className="shrink-0"
                      uiSize="md"
                      variant={
                        managedUser.role === 'admin' ? 'neutral' : undefined
                      }
                    >
                      {formatAdminRole(t, managedUser.role)}
                    </TRBadge>
                  </div>
                  <div className="flex items-center justify-between gap-tinyrack-sm">
                    <TRBadge uiSize="md">
                      {formatManagedBy(t, managedUser.managed_by)}
                    </TRBadge>
                    <TRText color="muted" variant="caption">
                      {t('admin.users.verifiedLabel')}{' '}
                      {managedUser.email_verified
                        ? t('common.yes')
                        : t('common.no')}
                    </TRText>
                  </div>
                </Link>
              ))}
            </div>
          </TRCard.Content>
        </TRCard.Root>

        <TRCard.Root
          className="overflow-hidden border-tinyrack-border shadow-tinyrack-raised"
          variant="outlined"
        >
          <TRCard.Content className="flex flex-col items-start gap-tinyrack-md">
            <TRBadge uiSize="md" variant="neutral">
              {t('admin.policy.title')}
            </TRBadge>
            <TRCard.Title className="text-tinyrack-xl">
              {t('admin.policy.heading')}
            </TRCard.Title>
            <TRCard.Description className="text-tinyrack-sm">
              {t('admin.policy.description')}
            </TRCard.Description>
            <div className="flex w-full flex-col gap-tinyrack-md">
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

function PolicyRow({
  label,
  value,
}: {
  label: string;
  value: number | string;
}) {
  return (
    <div className="flex items-center justify-between gap-tinyrack-sm rounded-tinyrack-md border border-tinyrack-border bg-tinyrack-surface-muted px-tinyrack-lg py-tinyrack-md">
      <TRText color="muted" variant="bodySm">
        {label}
      </TRText>
      <TRBadge uiSize="md" variant="neutral">
        {value}
      </TRBadge>
    </div>
  );
}
