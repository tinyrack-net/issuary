import { expect, test } from 'vitest';
import type { AppConfigs } from '#frontend/queries/config.ts';
import { appConfigQueryOptions } from '#frontend/queries/config.ts';
import * as LoginRoute from '#frontend/routes/_auth.login/route.tsx';
import {
  authorizationContextQueryData,
  defineRouteScreen,
  renderRoute,
} from '#frontend/test-utils/route-test-utils.tsx';

const routeDefinition = defineRouteScreen('auth', LoginRoute);

const loginConfig = {
  i18n: {
    supported_languages: ['en', 'ko'],
    default_language: 'en',
    fallback_language: 'en',
  },
  branding: {
    title: {
      en: 'Issuary',
    },
    subtitle: {
      en: 'Nice to meet you!',
    },
    login_method_description: {
      en: "Choose how you'd like to sign in.",
    },
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
  admin: {
    enabled: true,
  },
  auth: {
    password: {
      enabled: true,
      two_factor: {
        enrollment_required: false,
      },
      totp: {
        enabled: false,
        issuer: '',
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

const oauthSearch = {
  client_id: 'client-web',
  redirect_uri: 'https://client.example/callback',
  response_type: 'code',
  scope: 'openid',
};

test('renders a route with seeded query data and preserves the initial search', async () => {
  const initialLocation =
    '/login?client_id=client-web&redirect_uri=https%3A%2F%2Fclient.example%2Fcallback&response_type=code&scope=openid&state=state-123&code_challenge=challenge&code_challenge_method=S256';

  const { queryClient, router, screen } = await renderRoute(routeDefinition, {
    initialLocation,
    queryData: [
      {
        queryKey: appConfigQueryOptions.queryKey,
        data: loginConfig,
      },
      authorizationContextQueryData(oauthSearch),
    ],
  });

  await expect.element(screen.getByText('Issuary')).toBeVisible();

  const passwordLink = screen.getByRole('link', { name: 'Email' });
  await expect.element(passwordLink).toBeVisible();
  expect(passwordLink.element().getAttribute('href')).toContain(
    '/login/password?',
  );
  expect(passwordLink.element().getAttribute('href')).toContain(
    'client_id=client-web',
  );
  expect(router.state.location.pathname).toBe('/login');
  expect(queryClient.getQueryData(appConfigQueryOptions.queryKey)).toEqual(
    loginConfig,
  );
});
