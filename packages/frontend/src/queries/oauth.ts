import { mutationOptions, queryOptions } from '@tanstack/react-query';
import type { InferResponseType } from 'hono/client';
import { client, jsonOk } from '#frontend/libs/api.js';
import { queryKeys } from './keys';

export type OAuthAccountsResponse = InferResponseType<
  (typeof client.api.user)['oauth-accounts']['$get'],
  200
>;

export type LinkedOAuthAccount = OAuthAccountsResponse['accounts'][number];

export type OAuthProviderWithStatus =
  OAuthAccountsResponse['available_providers'][number];

/**
 * Query options for fetching user's linked OAuth accounts
 */
export const oauthAccountsQueryOptions = queryOptions({
  queryKey: queryKeys.oauth.accounts(),
  queryFn: async () => {
    const res = await client.api.user['oauth-accounts'].$get();
    return jsonOk(res);
  },
});

/**
 * Mutation options for unlinking an OAuth account
 */
export const unlinkOAuthMutationOptions = mutationOptions({
  mutationFn: async (providerId: string) => {
    const res = await client.api.oauth[':provider'].$delete({
      param: { provider: providerId },
    });
    return jsonOk(res);
  },
});

/**
 * Helper to get OAuth authorize URL
 */
export function getOAuthAuthorizeUrl(
  providerId: string,
  mode: 'login' | 'register' | 'link' = 'login',
  returnUrl?: string,
): string {
  const url = new URL(
    `/api/oauth/${providerId}/authorize`,
    window.location.origin,
  );
  url.searchParams.set('mode', mode);
  if (returnUrl) {
    url.searchParams.set('return_url', returnUrl);
  }
  return url.toString();
}
