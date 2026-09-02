import { queryOptions } from '@tanstack/react-query';
import type { InferResponseType } from 'hono/client';
import { type ApiClient, client, jsonOk } from '#frontend/libs/api.ts';
import { queryKeys } from './keys';

type SessionGetResponse = InferResponseType<
  (typeof client.api.user.session)['$get'],
  200
>;

export type SessionUser = NonNullable<SessionGetResponse['user']>;

export type AuthResponse = SessionGetResponse;

export type OkResponse = InferResponseType<
  (typeof client.api.auth.logout)['$post'],
  200
>;

export function createSessionQueryOptions(apiClient: ApiClient) {
  return queryOptions({
    queryKey: queryKeys.session(),
    queryFn: async () => {
      const response = await apiClient.api.user.session.$get();
      return jsonOk(response);
    },
  });
}

export const getSessionQueryOptions = createSessionQueryOptions(client);
