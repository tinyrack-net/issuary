import type { QueryClient } from '@tanstack/react-query';
import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
  type ErrorComponentProps,
  type RouterHistory,
} from '@tanstack/react-router';
import type { i18n as I18nInstance } from 'i18next';
import { AccessState } from '#admin/components/access-state.js';
import { AdminLayout } from '#admin/features/layout/admin-layout.js';
import i18n from '#admin/i18n/index.js';
import { parseAdminListSearch } from '#admin/libs/admin-list-search.js';
import {
  adminSessionQueryOptions,
  adminUsersQueryOptions,
  oauthClientsQueryOptions,
  oauthProvidersQueryOptions,
} from '#admin/queries/admin.js';
import { DashboardPage } from '#admin/routes/dashboard.js';
import { OAuthClientsPage } from '#admin/routes/oauth-clients.js';
import { OAuthProvidersPage } from '#admin/routes/oauth-providers.js';
import { UsersPage } from '#admin/routes/users.js';
import { GlobalQueryClient } from './query-client.js';

export type AdminRouterContext = {
  queryClient: QueryClient;
  i18n: I18nInstance;
};

function AdminRouteError({ error }: ErrorComponentProps) {
  if (error instanceof Error && 'status' in error && error.status === 401) {
    return (
      <AccessState
        descriptionKey="auth.loginRequired.description"
        titleKey="auth.loginRequired.title"
      />
    );
  }

  if (error instanceof Error && 'status' in error && error.status === 403) {
    return (
      <AccessState
        descriptionKey="auth.accessDenied.description"
        titleKey="auth.accessDenied.title"
      />
    );
  }

  return (
    <AccessState
      descriptionKey="auth.unavailable.description"
      titleKey="auth.unavailable.title"
    />
  );
}

const rootRoute = createRootRouteWithContext<AdminRouterContext>()({
  component: AdminLayout,
  errorComponent: AdminRouteError,
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(adminSessionQueryOptions);
  },
});

const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: DashboardPage,
});

const usersRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/users',
  validateSearch: parseAdminListSearch,
  loaderDeps: ({ search }) => search,
  loader: async ({ context, deps }) => {
    await context.queryClient.ensureQueryData(adminUsersQueryOptions(deps));
  },
  component: UsersPage,
});

const oauthClientsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/oauth-clients',
  validateSearch: parseAdminListSearch,
  loaderDeps: ({ search }) => search,
  loader: async ({ context, deps }) => {
    await context.queryClient.ensureQueryData(oauthClientsQueryOptions(deps));
  },
  component: OAuthClientsPage,
});

const oauthProvidersRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/oauth-providers',
  validateSearch: parseAdminListSearch,
  loaderDeps: ({ search }) => search,
  loader: async ({ context, deps }) => {
    await context.queryClient.ensureQueryData(oauthProvidersQueryOptions(deps));
  },
  component: OAuthProvidersPage,
});

const routeTree = rootRoute.addChildren([
  dashboardRoute,
  usersRoute,
  oauthProvidersRoute,
  oauthClientsRoute,
]);

type CreateAdminRouterOptions = {
  history?: RouterHistory;
  i18n?: I18nInstance;
  queryClient?: QueryClient;
};

export function createAdminRouter({
  history,
  i18n: i18nInstance = i18n,
  queryClient = GlobalQueryClient,
}: CreateAdminRouterOptions = {}) {
  return createRouter({
    basepath: '/admin',
    context: {
      queryClient,
      i18n: i18nInstance,
    },
    history,
    routeTree,
    scrollRestoration: true,
  });
}

export const AppRouter = createAdminRouter();

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof AppRouter;
  }
}
