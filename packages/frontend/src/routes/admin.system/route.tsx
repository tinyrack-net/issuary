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
  adminSystemQueryOptions,
  createAdminSystemQueryOptions,
} from '#frontend/queries/admin-console.ts';
import type { Route } from './+types/route.js';

function AdminSystemPage() {
  const { t } = useTranslation();
  const { data } = useSuspenseQuery(adminSystemQueryOptions);
  return (
    <>
      <div className="flex flex-col items-start justify-between gap-tinyrack-md bg-tinyrack-surface px-tinyrack-lg py-tinyrack-md sm:flex-row sm:items-center">
        <div>
          <TRText as="h1" variant="headingMd">
            {t('admin.system.title')}
          </TRText>
          <TRText as="p" color="muted" variant="bodySm">
            {t('admin.system.readonly')}
          </TRText>
        </div>
        <div className="flex shrink-0 gap-tinyrack-sm">
          <TRBadge variant="success">
            {t(`admin.statusValue.${data.health.database}`)}
          </TRBadge>
          <TRBadge
            variant={data.health.email === 'disabled' ? 'neutral' : 'success'}
          >
            {t(`admin.statusValue.${data.health.email}`)}
          </TRBadge>
        </div>
      </div>
      {/* tinyrack-check-ignore-next-line components/no-native-text -- Structural system-card grid; cards own visible typography. */}
      <div className="grid gap-tinyrack-lg xl:grid-cols-2">
        {data.sections.map((section) => (
          <section key={section.id}>
            <header className="bg-tinyrack-surface px-tinyrack-lg py-tinyrack-md">
              <TRText as="h2" variant="headingSm">
                {t(`admin.system.section.${section.id}`)}
              </TRText>
            </header>
            <TRTable.Root density="compact">
              <TRTable.Body>
                {Object.entries(section.values).map(([key, value]) => (
                  <TRTable.Row key={key}>
                    <TRTable.Cell className="text-tinyrack-text-muted">
                      {t(`admin.system.key.${key}`)}
                    </TRTable.Cell>
                    <TRTable.Cell className="text-right">
                      <SystemValue value={value} />
                    </TRTable.Cell>
                  </TRTable.Row>
                ))}
              </TRTable.Body>
            </TRTable.Root>
          </section>
        ))}
      </div>
    </>
  );
}

function SystemValue({
  value,
}: {
  value: boolean | number | string | string[];
}) {
  const { t } = useTranslation();
  if (typeof value === 'boolean')
    return (
      <TRBadge variant={value ? 'success' : 'neutral'}>
        {t(value ? 'common.on' : 'common.off')}
      </TRBadge>
    );
  if (Array.isArray(value))
    return (
      <TRText as="span" variant="bodySm">
        {value.length > 0 ? value.join(', ') : t('common.none')}
      </TRText>
    );
  return (
    <TRText as="span" variant="bodySm">
      {value}
    </TRText>
  );
}

export async function loader({ context }: Route.LoaderArgs) {
  const runtime = getRouteRuntime(context);
  await runtime.queryClient.ensureQueryData(
    createAdminSystemQueryOptions(runtime.api),
  );
  return createRouteLoaderData(runtime.queryClient, {});
}

export default function AdminSystemRoute({ loaderData }: Route.ComponentProps) {
  return (
    <RouteHydrationBoundary state={loaderData.dehydratedState}>
      <AdminSystemPage />
    </RouteHydrationBoundary>
  );
}
