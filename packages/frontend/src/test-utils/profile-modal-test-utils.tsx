import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TRToast } from '@tinyrack/ui/components/toast';
import type { ReactNode } from 'react';
import type { RenderResult } from 'vitest-browser-react';
import { render } from 'vitest-browser-react';
import type { AppConfigs } from '#frontend/queries/config.ts';
import { appConfigQueryOptions } from '#frontend/queries/config.ts';
import { initTestI18n } from '#frontend/test-utils/i18n.ts';

export const profileTestAppConfig = {
  i18n: {
    supported_languages: ['en'],
    default_language: 'en',
    fallback_language: 'en',
  },
  branding: {
    title: {},
    subtitle: {},
    login_method_description: {},
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
        enrollment_required: true,
      },
      totp: {
        enabled: true,
        issuer: 'Issuary',
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

type RenderProfileModalOptions = {
  queryClient?: QueryClient;
  config?: AppConfigs;
};

export function createProfileModalQueryClient(): QueryClient {
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

export async function renderProfileModal(
  ui: ReactNode,
  {
    queryClient = createProfileModalQueryClient(),
    config = profileTestAppConfig,
  }: RenderProfileModalOptions = {},
): Promise<{ screen: RenderResult; queryClient: QueryClient }> {
  initTestI18n();
  queryClient.setQueryData(appConfigQueryOptions.queryKey, config);

  // Mirrors the provider stack in main.tsx. The recovery-codes step confirms
  // a copy with a toast, so it needs a manager in context.
  const screen = await render(
    <QueryClientProvider client={queryClient}>
      <TRToast.Provider>{ui}</TRToast.Provider>
    </QueryClientProvider>,
  );

  return { screen, queryClient };
}
