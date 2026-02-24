import { mutationOptions } from '@tanstack/react-query';
import type { InferResponseType } from 'hono/client';
import { client, jsonOk } from '#frontend/libs/api.js';

export type AccountDeletionResponse = InferResponseType<
  (typeof client.api.user)['$delete'],
  200
>;

export const deleteAccountMutationOptions = mutationOptions({
  mutationFn: async () => {
    const res = await client.api.user.$delete();
    return jsonOk(res);
  },
});
