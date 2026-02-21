import { client, jsonOk } from '@frontend/libs/api';
import { mutationOptions } from '@tanstack/react-query';
import type { InferRequestType } from 'hono/client';

/**
 * Set password for OAuth-only users
 */
export type SetPasswordParams = InferRequestType<
  (typeof client.api.user.password)['$post']
>['json'];

export const setPasswordMutationOptions = mutationOptions({
  mutationFn: async (values: SetPasswordParams) => {
    const res = await client.api.user.password.$post({
      json: values,
    });
    return jsonOk(res);
  },
});

/**
 * Change password for users who already have a password
 */
export type ChangePasswordParams = InferRequestType<
  (typeof client.api.user.password)['$put']
>['json'];

export const changePasswordMutationOptions = mutationOptions({
  mutationFn: async (values: ChangePasswordParams) => {
    const res = await client.api.user.password.$put({
      json: values,
    });
    return jsonOk(res);
  },
});

/**
 * Remove password (only if user has at least one
 * OAuth account linked)
 */
export type RemovePasswordParams = InferRequestType<
  (typeof client.api.user.password)['$delete']
>['json'];

export const removePasswordMutationOptions = mutationOptions({
  mutationFn: async (values: RemovePasswordParams) => {
    const res = await client.api.user.password.$delete({
      json: values,
    });
    return jsonOk(res);
  },
});
