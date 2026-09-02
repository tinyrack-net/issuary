import { queryOptions } from '@tanstack/react-query';
import type { InferResponseType } from 'hono/client';
import { type ApiClient, client, jsonOk } from '#frontend/libs/api.ts';
import type { SecondFactorMethod } from '#frontend/libs/oauth-search.ts';
import { queryKeys } from './keys';

export type AppConfigs = InferResponseType<
  (typeof client.api.config)['$get'],
  200
>;

export type OAuthAuthenticationMethod =
  AppConfigs['identity_providers'][number];
export type OAuthProviderType = OAuthAuthenticationMethod['type'];

export function createAppConfigQueryOptions(apiClient: ApiClient) {
  return queryOptions({
    queryKey: queryKeys.config(),
    queryFn: async () => {
      const response = await apiClient.api.config.$get();
      return jsonOk(response);
    },
    select: (data) => {
      return {
        ...data,
        available_2fa_setup_methods: (() => {
          const methods: SecondFactorMethod[] = [];
          if (data.auth.password.totp.enabled) methods.push('totp');
          if (data.auth.passkey.enabled) methods.push('passkey');
          return methods;
        })(),
      };
    },
    staleTime: 1000 * 60,
  });
}

export const appConfigQueryOptions = createAppConfigQueryOptions(client);
