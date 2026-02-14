import { api, jsonOk } from '@frontend/libs/api';
import { mutationOptions } from '@tanstack/react-query';
import type { InferRequestType, InferResponseType } from 'hono/client';

export type ForgotPasswordParams = InferRequestType<
  (typeof api.api.v1.auth.password.forgot)['$post']
>['json'];

export type ForgotPasswordResponse = InferResponseType<
  (typeof api.api.v1.auth.password.forgot)['$post'],
  200
>;

export const forgotPasswordMutationOptions = mutationOptions({
  mutationFn: async (values: ForgotPasswordParams) => {
    const res = await api.api.v1.auth.password.forgot.$post({
      json: values,
      header: {},
    });
    return jsonOk(res);
  },
});

export type ResetPasswordParams = InferRequestType<
  (typeof api.api.v1.auth.password.reset)['$post']
>['json'];

export type ResetPasswordResponse = InferResponseType<
  (typeof api.api.v1.auth.password.reset)['$post'],
  200
>;

export const resetPasswordMutationOptions = mutationOptions({
  mutationFn: async (values: ResetPasswordParams) => {
    const res = await api.api.v1.auth.password.reset.$post({
      json: values,
    });
    return jsonOk(res);
  },
});
