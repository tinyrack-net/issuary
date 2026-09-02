import { useSuspenseQuery } from '@tanstack/react-query';
import { TRBadge } from '@tinyrack/ui/components/badge';
import { TRTable } from '@tinyrack/ui/components/table';
import { TRText } from '@tinyrack/ui/components/text';
import { useTranslation } from 'react-i18next';
import {
  createRouteLoaderData,
  RouteHydrationBoundary,
} from '#frontend/libs/route-module.tsx';
import { getRouteRuntime } from '#frontend/libs/route-runtime.ts';
import {
  adminOverviewQueryOptions,
  createAdminOverviewQueryOptions,
} from '#frontend/queries/admin-console.ts';
import type { Route } from './+types/route.js';

function AdminDashboard() {
  const { t } = useTranslation();
  const { data } = useSuspenseQuery(adminOverviewQueryOptions);
  const metrics = [
    ['admin.overview.activeUsers', data.metrics.active_users],
    ['admin.overview.admins', data.metrics.admins],
    ['admin.overview.activeClients', data.metrics.active_clients],
    ['admin.overview.requiredTerms', data.metrics.required_terms],
  ];
  return (
    <>
      {/* tinyrack-check-ignore-next-line components/no-native-text -- Structural metrics grid; AdminStat owns visible typography. */}
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
    </>
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

export async function loader({ context }: Route.LoaderArgs) {
  const runtime = getRouteRuntime(context);
  await runtime.queryClient.ensureQueryData(
    createAdminOverviewQueryOptions(runtime.api),
  );
  return createRouteLoaderData(runtime.queryClient, {});
}

export default function AdminDashboardRoute({
  loaderData,
}: Route.ComponentProps) {
  return (
    <RouteHydrationBoundary state={loaderData.dehydratedState}>
      <AdminDashboard />
    </RouteHydrationBoundary>
  );
}
