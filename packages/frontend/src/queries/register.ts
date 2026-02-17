import { api, jsonOk } from '@frontend/libs/api';
import { mutationOptions } from '@tanstack/react-query';
import type { InferResponseType } from 'hono/client';
import type { TermsConsentItem } from './terms';

export type RegisterParams = {
  email: string;
  password: string;
  consents?: TermsConsentItem[];
};

export type RegisterResponse = InferResponseType<
  (typeof api.api.auth.register)['$post'],
  200
>;

export const registerMutationOptions = mutationOptions({
  mutationFn: async (values: RegisterParams) => {
    const res = await api.api.auth.register.$post({
      json: values,
      header: {},
    });
    return jsonOk(res);
  },
});
