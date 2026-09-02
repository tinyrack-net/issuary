import { mutationOptions, queryOptions } from '@tanstack/react-query';
import type { InferResponseType } from 'hono/client';
import { type ApiClient, client, jsonOk } from '#frontend/libs/api.ts';
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
export const createOAuthAccountsQueryOptions = (apiClient: ApiClient) =>
  queryOptions({
    queryKey: queryKeys.oauth.accounts(),
    queryFn: async () => {
      const res = await apiClient.api.user['oauth-accounts'].$get();
      return jsonOk(res);
    },
  });

export const oauthAccountsQueryOptions =
  createOAuthAccountsQueryOptions(client);

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
  const search = new URLSearchParams({ mode });
  if (returnUrl) {
    search.set('return_url', returnUrl);
  }
  return `/api/oauth/${encodeURIComponent(providerId)}/authorize?${search.toString()}`;
}
