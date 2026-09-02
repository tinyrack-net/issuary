import { queryOptions } from '@tanstack/react-query';
import type { InferResponseType } from 'hono/client';
import { type ApiClient, client, jsonOk } from '#frontend/libs/api.ts';
import type { AuthorizationContextSearch } from '#frontend/libs/oauth-search.ts';
import { queryKeys } from './keys';

export type AuthorizationContextResponse = InferResponseType<
  (typeof client.api.oauth)['authorization-context']['$get'],
  200
>;

export type AuthorizationContextScope =
  AuthorizationContextResponse['scopes'][number];

export const createAuthorizationContextQueryOptions = (
  apiClient: ApiClient,
  search: AuthorizationContextSearch,
) =>
  queryOptions({
    queryKey: queryKeys.oauth.authorizationContext(
      search.client_id,
      search.redirect_uri,
      search.response_type,
      search.scope,
    ),
    queryFn: async () => {
      const res = await apiClient.api.oauth['authorization-context'].$get({
        query: {
          client_id: search.client_id,
          redirect_uri: search.redirect_uri,
          response_type: search.response_type,
          scope: search.scope,
        },
      });
      return jsonOk(res);
    },
    staleTime: 1000 * 60,
  });

export const getAuthorizationContextQueryOptions = (
  search: AuthorizationContextSearch,
) => createAuthorizationContextQueryOptions(client, search);
