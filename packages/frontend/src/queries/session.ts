import { queryOptions } from '@tanstack/react-query';
import type { InferResponseType } from 'hono/client';
import { api, jsonOk } from '@/libs/api';
import { queryKeys } from './keys';

type SessionGetResponse = InferResponseType<
  (typeof api.api.v1.user.session)['$get'],
  200
>;

export type SessionUser = NonNullable<SessionGetResponse['user']>;

export type AuthResponse = SessionGetResponse;

export type OkResponse = InferResponseType<
  (typeof api.api.v1.auth.logout)['$post'],
  200
>;

export const getSessionQueryOptions = queryOptions({
  queryKey: queryKeys.session(),
  queryFn: async () => {
    const response = await api.api.v1.user.session.$get();
    return jsonOk(response);
  },
});
