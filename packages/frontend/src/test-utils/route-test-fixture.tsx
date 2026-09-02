import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TRToast } from '@tinyrack/ui/components/toast';
import type { ReactElement } from 'react';
import { I18nextProvider } from 'react-i18next';
import {
  createRoutesStub,
  type MiddlewareFunction,
  Outlet,
  RouterContextProvider,
  useLocation,
} from 'react-router';
import { getBrowserI18n } from '#frontend/i18n/index.ts';
import { client } from '#frontend/libs/api.ts';
import {
  getRouteRuntime,
  routeRuntimeContext,
} from '#frontend/libs/route-runtime.ts';
import { appConfigQueryOptions } from '#frontend/queries/config.ts';
import {
  getSessionQueryOptions,
  type SessionUser,
} from '#frontend/queries/session.ts';
import * as AuthLayoutRoute from '#frontend/routes/_auth/route.tsx';
import * as AdminLayoutRoute from '#frontend/routes/admin/route.tsx';
import { routeTestAppConfig } from './route-screen-fixtures.ts';

export type RouteTestQueryData = {
  queryKey: readonly unknown[];
  data: unknown;
};

export type RouteScreenRenderOptions = {
  initialLocation?: string;
  language?: string;
  queryClient?: QueryClient;
  queryData?: RouteTestQueryData[];
  user?: SessionUser | null;
};

type RouteScreenRouter = {
  readonly state: {
    location: {
      pathname: string;
      search: Record<string, string>;
    };
  };
};

export type RouteScreenRenderState = {
  content: ReactElement;
  queryClient: QueryClient;
  router: RouteScreenRouter;
};

type StubRoute = Parameters<typeof createRoutesStub>[0][number];

type RouteModule = {
  default: NonNullable<StubRoute['Component']>;
  loader?: StubRoute['loader'];
  ErrorBoundary?: NonNullable<StubRoute['ErrorBoundary']>;
};

function nativeRoute({
  default: Component,
  loader,
  ErrorBoundary,
}: RouteModule): StubRoute {
  return {
    Component,
    ...(ErrorBoundary ? { ErrorBoundary } : {}),
    ...(loader ? { loader } : {}),
  };
}

export type RouteScreenDefinition = {
  family: 'admin' | 'auth' | 'root';
  route: StubRoute;
};

export function defineRouteScreen(
  family: RouteScreenDefinition['family'],
  routeModule: RouteModule,
): RouteScreenDefinition {
  return { family, route: nativeRoute(routeModule) };
}

const adminMiddleware: MiddlewareFunction = async ({ context }, next) => {
  AdminLayoutRoute.assertAdminAccess(getRouteRuntime(context));
  return next();
};

function EmptyRoute() {
  return null;
}

function createTargetRoute(
  route: StubRoute,
  path: string,
  index: boolean,
): StubRoute {
  if (index) return { ...route, index: true };
  return { ...route, path };
}

function createTestRoutes(
  definition: RouteScreenDefinition,
  initialLocation: string,
): StubRoute[] {
  const pathname = new URL(initialLocation, 'http://localhost').pathname;
  const fallback = { Component: EmptyRoute, path: '*' } satisfies StubRoute;

  if (definition.family === 'admin') {
    const isIndex = pathname === '/admin';
    const childPath = pathname.slice('/admin/'.length);
    return [
      {
        ...nativeRoute(AdminLayoutRoute),
        children: [createTargetRoute(definition.route, childPath, isIndex)],
        middleware: [adminMiddleware],
        path: 'admin',
      },
      fallback,
    ];
  }

  const targetPath = pathname === '/' ? '' : pathname.slice(1);
  const target = createTargetRoute(
    definition.route,
    targetPath,
    pathname === '/',
  );
  if (definition.family === 'auth') {
    return [
      {
        ...nativeRoute(AuthLayoutRoute),
        children: [target],
      },
      fallback,
    ];
  }
  return [target, fallback];
}

export function createRouteScreenQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

export async function createRouteScreen(
  definition: RouteScreenDefinition,
  {
    initialLocation = '/',
    language,
    queryClient = createRouteScreenQueryClient(),
    queryData = [],
    user = null,
  }: RouteScreenRenderOptions = {},
): Promise<RouteScreenRenderState> {
  for (const seededQuery of queryData) {
    queryClient.setQueryData(seededQuery.queryKey, seededQuery.data);
  }
  queryClient.setQueryData(getSessionQueryOptions.queryKey, { user });
  const config =
    queryClient.getQueryData(appConfigQueryOptions.queryKey) ??
    routeTestAppConfig;
  queryClient.setQueryData(appConfigQueryOptions.queryKey, config);
  const appI18n = getBrowserI18n(
    {
      supportedLanguages: config.i18n.supported_languages,
      defaultLanguage: config.i18n.default_language,
      fallbackLanguage: config.i18n.fallback_language,
    },
    language ??
      (config.i18n.default_language === 'auto'
        ? config.i18n.fallback_language
        : config.i18n.default_language),
  );

  const context = new RouterContextProvider();
  context.set(routeRuntimeContext, {
    api: client,
    config,
    i18n: appI18n,
    queryClient,
    session: { user },
  });

  let currentLocation = new URL(initialLocation, 'http://localhost');
  function TestRoot() {
    const location = useLocation();
    currentLocation = new URL(
      `${location.pathname}${location.search}`,
      'http://localhost',
    );
    return <Outlet />;
  }
  function TestHydrateFallback() {
    return null;
  }
  const RoutesStub = createRoutesStub(
    [
      {
        Component: TestRoot,
        HydrateFallback: TestHydrateFallback,
        children: createTestRoutes(definition, initialLocation),
      },
    ],
    context,
  );

  const router: RouteScreenRouter = {
    get state() {
      return {
        location: {
          pathname: currentLocation.pathname,
          search: Object.fromEntries(currentLocation.searchParams),
        },
      };
    },
  };

  return {
    content: (
      <I18nextProvider i18n={appI18n}>
        <QueryClientProvider client={queryClient}>
          <TRToast.Provider>
            <RoutesStub initialEntries={[initialLocation]} />
          </TRToast.Provider>
        </QueryClientProvider>
      </I18nextProvider>
    ),
    queryClient,
    router,
  };
}
