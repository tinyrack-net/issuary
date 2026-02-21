import { client, jsonOk } from '@frontend/libs/api';
import { mutationOptions } from '@tanstack/react-query';
import type { InferRequestType, InferResponseType } from 'hono/client';

export type LoginParams = InferRequestType<
  (typeof client.api.auth.login)['$post']
>['json'];

export type LoginResponse = InferResponseType<
  (typeof client.api.auth.login)['$post'],
  200
>;

export const loginMutationOptions = mutationOptions({
  mutationFn: async (values: LoginParams) => {
    const res = await client.api.auth.login.$post({
      json: values,
    });
    return jsonOk(res);
  },
});
