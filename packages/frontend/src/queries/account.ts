import { mutationOptions } from '@tanstack/react-query';
import type { InferResponseType } from 'hono/client';
import { api, jsonOk } from '@/libs/api';

export type AccountDeletionResponse = InferResponseType<
  (typeof api.api.v1.user)['$delete'],
  200
>;

export const deleteAccountMutationOptions = mutationOptions({
  mutationFn: async () => {
    const res = await api.api.v1.user.$delete();
    return jsonOk(res);
  },
});
