import { mutationOptions, queryOptions } from '@tanstack/react-query';
import type { InferRequestType, InferResponseType } from 'hono/client';
import { api, jsonOk } from '@/libs/api';
import { queryKeys } from './keys';

export type ConsentInfoParams = {
  client_id: string;
  scope?: string;
};

export type ConsentInfoResponse = InferResponseType<
  (typeof api.api.v1.consent)['$get'],
  200
>;

export type ConsentScope = ConsentInfoResponse['scopes'][number];

export const getConsentInfoQueryOptions = (params: ConsentInfoParams) =>
  queryOptions({
    queryKey: queryKeys.consent(params.client_id, params.scope),
    queryFn: async () => {
      const res = await api.api.v1.consent.$get({
        query: {
          client_id: params.client_id,
          scope: params.scope,
        },
      });
      return jsonOk(res);
    },
  });

export type ConsentDecisionParams = InferRequestType<
  (typeof api.api.v1.consent)['$post']
>['json'];

export type ConsentDecisionResponse = InferResponseType<
  (typeof api.api.v1.consent)['$post'],
  200
>;

export const consentDecisionMutationOptions = mutationOptions({
  mutationFn: async (params: ConsentDecisionParams) => {
    const res = await api.api.v1.consent.$post({
      json: params,
    });
    return jsonOk(res);
  },
});
