import { client, jsonOk } from '@frontend/libs/api';
import type { SecondFactorMethod } from '@frontend/libs/oauth-search';
import { queryOptions } from '@tanstack/react-query';
import type { InferResponseType } from 'hono/client';
import { queryKeys } from './keys';

export type AppConfigs = InferResponseType<
  (typeof client.api.config)['$get'],
  200
>;

export type Theme = AppConfigs['app']['light_theme'];
export type ThemeMode = AppConfigs['app']['theme_mode'];
export type OAuthAuthenticationMethod =
  AppConfigs['identity_providers'][number];
export type OAuthProviderType = OAuthAuthenticationMethod['type'];

export const appConfigQueryOptions = queryOptions({
  queryKey: queryKeys.config(),
  queryFn: async () => {
    const response = await client.api.config.$get();
    return jsonOk(response);
  },
  select: (data) => {
    return {
      ...data,
      available_2fa_setup_methods: (() => {
        const methods: SecondFactorMethod[] = [];
        if (data.auth.password.totp.enabled) {
          methods.push('totp');
        }
        if (data.auth.passkey.enabled) {
          methods.push('passkey');
        }
        return methods;
      })(),
    };
  },
  staleTime: 1000 * 60,
});
