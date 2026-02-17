import { api, jsonOk } from '@frontend/libs/api';
import { mutationOptions } from '@tanstack/react-query';
import type { InferResponseType } from 'hono/client';

export type AccountDeletionResponse = InferResponseType<
  (typeof api.api.user)['$delete'],
  200
>;

export const deleteAccountMutationOptions = mutationOptions({
  mutationFn: async () => {
    const res = await api.api.user.$delete();
    return jsonOk(res);
  },
});
