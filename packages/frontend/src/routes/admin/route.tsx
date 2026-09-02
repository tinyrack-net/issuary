import { useTranslation } from 'react-i18next';
import {
  data,
  isRouteErrorResponse,
  Outlet,
  redirect,
  useLocation,
} from 'react-router';
import { AdminGateScreen } from '#frontend/features/admin/admin-gate-screen.tsx';
import {
  type AdminSection,
  AdminShell,
} from '#frontend/features/admin/admin-shell.tsx';
import {
  createRouteLoaderData,
  RouteHydrationBoundary,
} from '#frontend/libs/route-module.tsx';
import type { RouteRuntime } from '#frontend/libs/route-runtime.ts';
import { getRouteRuntime } from '#frontend/libs/route-runtime.ts';
import type { Route } from './+types/route.js';

export const middleware: Route.MiddlewareFunction[] = [
  async ({ context }, next) => {
    assertAdminAccess(getRouteRuntime(context));
    return next();
  },
];

export function assertAdminAccess(runtime: RouteRuntime): void {
  if (!runtime.session.user) throw redirect('/login');
  if (runtime.session.user.role !== 'admin') {
    throw data('access-required', { status: 403 });
  }
  if (!runtime.config.admin.enabled) {
    throw data('console-disabled', { status: 404 });
  }
}

const SECTION_BY_PATH: Record<string, AdminSection> = {
  '/admin': 'dashboard',
  '/admin/clients': 'clients',
  '/admin/settings': 'settings',
  '/admin/system': 'system',
  '/admin/terms': 'terms',
  '/admin/users': 'users',
};

const TITLE_BY_SECTION: Record<AdminSection, string> = {
  dashboard: 'admin.dashboardTitle',
  clients: 'admin.clients.title',
  settings: 'admin.settings.title',
  system: 'admin.system.title',
  terms: 'admin.terms.title',
  users: 'admin.users.title',
};

function AdminLayout({
  user,
}: {
  user: NonNullable<ReturnType<typeof getRouteRuntime>['session']['user']>;
}) {
  const { t } = useTranslation();
  const location = useLocation();

  const section = SECTION_BY_PATH[location.pathname] ?? 'dashboard';
  return (
    <AdminShell
      current={section}
      title={t(TITLE_BY_SECTION[section])}
      user={user}
    >
      <Outlet />
    </AdminShell>
  );
}

export function loader({ context }: Route.LoaderArgs) {
  const runtime = getRouteRuntime(context);
  return {
    ...createRouteLoaderData(runtime.queryClient, {}),
    user: runtime.session.user,
  };
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  if (isRouteErrorResponse(error) && error.data === 'access-required') {
    return <AdminGateScreen reason="access-required" />;
  }
  if (isRouteErrorResponse(error) && error.data === 'console-disabled') {
    return <AdminGateScreen reason="console-disabled" />;
  }
  throw error;
}

export default function AdminLayoutRoute({ loaderData }: Route.ComponentProps) {
  if (!loaderData.user) return null;
  return (
    <RouteHydrationBoundary state={loaderData.dehydratedState}>
      <AdminLayout user={loaderData.user} />
    </RouteHydrationBoundary>
  );
}
