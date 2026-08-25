import { mutationOptions } from '@tanstack/react-query';
import type { InferRequestType, InferResponseType } from 'hono/client';
import { client, jsonOk } from '#frontend/libs/api.ts';

export type ForgotPasswordParams = InferRequestType<
  (typeof client.api.auth.password.forgot)['$post']
>['json'];

export type ForgotPasswordResponse = InferResponseType<
  (typeof client.api.auth.password.forgot)['$post'],
  200
>;

export const forgotPasswordMutationOptions = mutationOptions({
  mutationFn: async (values: ForgotPasswordParams) => {
    const res = await client.api.auth.password.forgot.$post({
      json: values,
      header: {},
    });
    return jsonOk(res);
  },
});

export type ResetPasswordParams = InferRequestType<
  (typeof client.api.auth.password.reset)['$post']
>['json'];

export type ResetPasswordResponse = InferResponseType<
  (typeof client.api.auth.password.reset)['$post'],
  200
>;

export const resetPasswordMutationOptions = mutationOptions({
  mutationFn: async (values: ResetPasswordParams) => {
    const res = await client.api.auth.password.reset.$post({
      json: values,
    });
    return jsonOk(res);
  },
});

export type ResetRequiredPasswordParams = InferRequestType<
  (typeof client.api.auth.password)['reset-required']['$post']
>['json'];

export const resetRequiredPasswordMutationOptions = mutationOptions({
  mutationFn: async (values: ResetRequiredPasswordParams) => {
    const res = await client.api.auth.password['reset-required'].$post({
      json: values,
    });
    return jsonOk(res);
  },
});
