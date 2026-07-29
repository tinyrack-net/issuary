import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  createMemoryHistory,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';
import { TRToast } from '@tinyrack/ui/components/toast';
import type { ReactElement } from 'react';
import i18n from '#frontend/i18n/index.ts';
import type { AppRouterContext } from '#frontend/libs/router.ts';
import type { SessionUser } from '#frontend/queries/session.ts';
import { routeTree } from '#frontend/routeTree.gen.ts';

export type RouteTestQueryData = {
  queryKey: readonly unknown[];
  data: unknown;
};

export type RouteScreenRenderOptions = {
  initialLocation?: string;
  queryClient?: QueryClient;
  queryData?: RouteTestQueryData[];
  user?: SessionUser | null;
};

export type RouteScreenRenderState = {
  content: ReactElement;
  queryClient: QueryClient;
  router: ReturnType<typeof createRouteScreenRouter>;
};

export function createRouteScreenQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

function createRouteScreenRouter(
  context: AppRouterContext,
  initialLocation: string,
) {
  const history = createMemoryHistory({
    initialEntries: [initialLocation],
  });

  return createRouter({
    routeTree,
    context,
    history,
    scrollRestoration: false,
  });
}

export async function createRouteScreen({
  initialLocation = '/',
  queryClient = createRouteScreenQueryClient(),
  queryData = [],
  user = null,
}: RouteScreenRenderOptions = {}): Promise<RouteScreenRenderState> {
  for (const seededQuery of queryData) {
    queryClient.setQueryData(seededQuery.queryKey, seededQuery.data);
  }

  const context = {
    queryClient,
    user,
    i18n,
  } satisfies AppRouterContext;
  const router = createRouteScreenRouter(context, initialLocation);

  await router.load();

  return {
    content: (
      <QueryClientProvider client={queryClient}>
        <TRToast.Provider>
          <RouterProvider context={context} router={router} />
        </TRToast.Provider>
      </QueryClientProvider>
    ),
    queryClient,
    router,
  };
}
