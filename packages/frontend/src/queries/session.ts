import { queryOptions } from '@tanstack/react-query';
import type { InferResponseType } from 'hono/client';
import { client, jsonOk } from '#frontend/libs/api.js';
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

export const getSessionQueryOptions = queryOptions({
  queryKey: queryKeys.session(),
  queryFn: async () => {
    const response = await client.api.user.session.$get();
    return jsonOk(response);
  },
});
