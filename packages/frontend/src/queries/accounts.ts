import { mutationOptions, queryOptions } from '@tanstack/react-query';
import type { InferRequestType, InferResponseType } from 'hono/client';
import { client, jsonOk } from '#frontend/libs/api.ts';
import { queryKeys } from './keys';

export type AccountsResponse = InferResponseType<
  (typeof client.api.auth.accounts)['$get'],
  200
>;
export type RememberedAccount = AccountsResponse['accounts'][number];

export function accountsQueryOptions(clientId?: string) {
  return queryOptions({
    queryKey: queryKeys.accounts(clientId),
    queryFn: async () => {
      const res = await client.api.auth.accounts.$get({
        query: clientId ? { client_id: clientId } : {},
      });
      return jsonOk(res);
    },
  });
}

export type SelectAccountParams = InferRequestType<
  (typeof client.api.auth.accounts.select)['$post']
>['json'];

export const selectAccountMutationOptions = mutationOptions({
  mutationFn: async (params: SelectAccountParams) => {
    const res = await client.api.auth.accounts.select.$post({ json: params });
    return jsonOk(res);
  },
});

export type RemoveAccountParams = InferRequestType<
  (typeof client.api.auth.accounts.remove)['$post']
>['json'];

export const removeAccountMutationOptions = mutationOptions({
  mutationFn: async (params: RemoveAccountParams) => {
    const res = await client.api.auth.accounts.remove.$post({ json: params });
    return jsonOk(res);
  },
});
