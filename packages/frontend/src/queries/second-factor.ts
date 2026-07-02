import { queryOptions } from '@tanstack/react-query';
import type { InferResponseType } from 'hono/client';
import { client, jsonOk } from '#frontend/libs/api.ts';
import { queryKeys } from './keys';

export type PendingSecondFactorMethodsResponse = InferResponseType<
  (typeof client.api.auth)['2fa']['methods']['$get'],
  200
>;

export const getPendingSecondFactorMethodsQueryOptions = queryOptions({
  queryKey: queryKeys.pendingSecondFactorMethods(),
  queryFn: async () => {
    const res = await client.api.auth['2fa'].methods.$get();
    return jsonOk(res);
  },
  retry: false,
});
