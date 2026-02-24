import { mutationOptions } from '@tanstack/react-query';
import type { InferRequestType, InferResponseType } from 'hono/client';
import { client, jsonOk } from '#frontend/libs/api.js';

export type VerifyEmailParams = InferRequestType<
  (typeof client.api.auth.email.verify)['$post']
>['json'];

export type VerifyEmailResponse = InferResponseType<
  (typeof client.api.auth.email.verify)['$post'],
  200
>;

export const verifyEmailMutationOptions = mutationOptions({
  mutationFn: async (values: VerifyEmailParams) => {
    const res = await client.api.auth.email.verify.$post({
      json: values,
    });
    return jsonOk(res);
  },
});

export type ResendVerificationParams = InferRequestType<
  (typeof client.api.auth.email.resend)['$post']
>['json'];

export type ResendVerificationResponse = InferResponseType<
  (typeof client.api.auth.email.resend)['$post'],
  200
>;

export const resendVerificationMutationOptions = mutationOptions({
  mutationFn: async (values: ResendVerificationParams) => {
    const res = await client.api.auth.email.resend.$post({
      json: values,
      header: {},
    });
    return jsonOk(res);
  },
});
