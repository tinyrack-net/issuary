import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  createMemoryHistory,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';
import type { RenderResult } from 'vitest-browser-react';
import { render } from 'vitest-browser-react';
import i18n from '#frontend/i18n/index.ts';
import type { AppRouterContext } from '#frontend/libs/router.ts';
import type { AppConfigs } from '#frontend/queries/config.ts';
import { appConfigQueryOptions } from '#frontend/queries/config.ts';
import type { SessionUser } from '#frontend/queries/session.ts';
import { routeTree } from '#frontend/routeTree.gen.ts';
import { initTestI18n } from '#frontend/test-utils/i18n.ts';

type RouteTestQueryData = {
  queryKey: readonly unknown[];
  data: unknown;
};

export const routeTestAppConfig = {
  i18n: {
    supported_languages: ['en'],
    default_language: 'en',
    fallback_language: 'en',
  },
  branding: {
    light_theme: 'light',
    dark_theme: 'dark',
    theme_mode: 'system',
    background_url: '',
    icon_url: '',
    title: {},
    subtitle: {},
  },
  registration: {
    public_registration: true,
    email_pattern_filter_enabled: false,
    email_verification_required: true,
    signup_notice: {},
  },
  database: {
    enabled: true,
  },
  email: {
    enabled: true,
  },
  auth: {
    password: {
      enabled: true,
      two_factor: {
        enrollment_required: true,
      },
      totp: {
        enabled: true,
        issuer: 'TinyAuth',
      },
      policy: {
        min_length: 8,
        max_length: 64,
      },
    },
    passkey: {
      enabled: true,
    },
  },
  identity_providers: [],
  account_deletion: {
    enabled: true,
    retention: 'P30D',
  },
} satisfies AppConfigs;

export const routeTestUser = {
  managed_by: 'database',
  sub: 'user-1',
  email: 'alice@example.com',
  email_verified: true,
  email_verification_required: false,
  has_password: true,
  second_factor_required: false,
  totp_registered: false,
  totp_recovery_codes_missing: false,
  passkey_count: 0,
} satisfies SessionUser;

export function appConfigQueryData(
  config: AppConfigs = routeTestAppConfig,
): RouteTestQueryData {
  return {
    queryKey: appConfigQueryOptions.queryKey,
    data: config,
  };
}

type RenderRouteOptions = {
  initialLocation?: string;
  queryClient?: QueryClient;
  queryData?: RouteTestQueryData[];
  user?: SessionUser | null;
};

type RenderRouteResult = {
  queryClient: QueryClient;
  router: ReturnType<typeof createTestRouter>;
  screen: RenderResult;
};

export function createTestQueryClient(): QueryClient {
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

function createTestRouter(context: AppRouterContext, initialLocation: string) {
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

export async function renderRoute({
  initialLocation = '/',
  queryClient = createTestQueryClient(),
  queryData = [],
  user = null,
}: RenderRouteOptions = {}): Promise<RenderRouteResult> {
  initTestI18n();

  for (const seededQuery of queryData) {
    queryClient.setQueryData(seededQuery.queryKey, seededQuery.data);
  }

  const context = {
    queryClient,
    user,
    i18n,
  } satisfies AppRouterContext;
  const router = createTestRouter(context, initialLocation);

  await router.load();

  const screen = await render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider context={context} router={router} />
    </QueryClientProvider>,
  );

  return {
    queryClient,
    router,
    screen,
  };
}
