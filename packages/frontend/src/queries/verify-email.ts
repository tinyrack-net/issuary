import { api, jsonOk } from '@frontend/libs/api';
import { mutationOptions } from '@tanstack/react-query';
import type { InferRequestType, InferResponseType } from 'hono/client';

export type VerifyEmailParams = InferRequestType<
  (typeof api.api.v1.auth.email.verify)['$post']
>['json'];

export type VerifyEmailResponse = InferResponseType<
  (typeof api.api.v1.auth.email.verify)['$post'],
  200
>;

export const verifyEmailMutationOptions = mutationOptions({
  mutationFn: async (values: VerifyEmailParams) => {
    const res = await api.api.v1.auth.email.verify.$post({
      json: values,
    });
    return jsonOk(res);
  },
});

export type ResendVerificationParams = InferRequestType<
  (typeof api.api.v1.auth.email.resend)['$post']
>['json'];

export type ResendVerificationResponse = InferResponseType<
  (typeof api.api.v1.auth.email.resend)['$post'],
  200
>;

export const resendVerificationMutationOptions = mutationOptions({
  mutationFn: async (values: ResendVerificationParams) => {
    const res = await api.api.v1.auth.email.resend.$post({
      json: values,
      header: {},
    });
    return jsonOk(res);
  },
});
