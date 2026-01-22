import { mutationOptions, queryOptions } from '@tanstack/react-query';
import { etch } from '@/libs/etch';
import { queryKeys } from './keys';
import type { OkResponse } from './session.js';

/**
 * OAuth provider info for login/register pages
 */
export type OAuthProvider = {
  id: string;
  display_name: string;
  icon_url?: string;
};

/**
 * Linked OAuth account info
 */
export type LinkedOAuthAccount = {
  provider_name: string;
  linked_at: string;
};

/**
 * Provider with linked status for profile page
 */
export type OAuthProviderWithStatus = OAuthProvider & {
  linked: boolean;
};

/**
 * Response from GET /api/v1/oauth/providers
 */
export type OAuthProvidersResponse = {
  providers: OAuthProvider[];
};

/**
 * Response from GET /api/v1/user/oauth-accounts
 */
export type OAuthAccountsResponse = {
  accounts: LinkedOAuthAccount[];
  available_providers: OAuthProviderWithStatus[];
};

/**
 * Query options for fetching available OAuth providers
 */
export const oauthProvidersQueryOptions = queryOptions({
  queryKey: queryKeys.oauth.providers(),
  queryFn: async () => {
    const res = await etch('/api/v1/oauth/providers');
    return (await res.json()) as OAuthProvidersResponse;
  },
});

/**
 * Query options for fetching user's linked OAuth accounts
 */
export const oauthAccountsQueryOptions = queryOptions({
  queryKey: queryKeys.oauth.accounts(),
  queryFn: async () => {
    const res = await etch('/api/v1/user/oauth-accounts');
    return (await res.json()) as OAuthAccountsResponse;
  },
});

/**
 * Mutation options for unlinking an OAuth account
 */
export const unlinkOAuthMutationOptions = mutationOptions({
  mutationFn: async (providerId: string) => {
    const res = await etch(`/api/v1/oauth/${providerId}/link`, {
      method: 'DELETE',
    });
    return (await res.json()) as OkResponse;
  },
});

/**
 * Helper to get OAuth connect URL
 */
export function getOAuthConnectUrl(
  providerId: string,
  mode: 'login' | 'register' | 'link' = 'login',
  returnUrl?: string,
): string {
  const url = new URL(
    `/api/v1/oauth/${providerId}/connect`,
    window.location.origin,
  );
  url.searchParams.set('mode', mode);
  if (returnUrl) {
    url.searchParams.set('return_url', returnUrl);
  }
  return url.toString();
}
