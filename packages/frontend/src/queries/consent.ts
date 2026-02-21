import { client, jsonOk } from '@frontend/libs/api';
import { mutationOptions, queryOptions } from '@tanstack/react-query';
import type { InferRequestType, InferResponseType } from 'hono/client';
import { queryKeys } from './keys';

export type ConsentInfoParams = {
  client_id: string;
  scope?: string;
};

export type ConsentInfoResponse = InferResponseType<
  (typeof client.api.consent)['$get'],
  200
>;

export type ConsentScope = ConsentInfoResponse['scopes'][number];

export const getConsentInfoQueryOptions = (params: ConsentInfoParams) =>
  queryOptions({
    queryKey: queryKeys.consent(params.client_id, params.scope),
    queryFn: async () => {
      const res = await client.api.consent.$get({
        query: {
          client_id: params.client_id,
          scope: params.scope,
        },
      });
      return jsonOk(res);
    },
  });

export type ConsentDecisionParams = InferRequestType<
  (typeof client.api.consent)['$post']
>['json'];

export type ConsentDecisionResponse = InferResponseType<
  (typeof client.api.consent)['$post'],
  200
>;

export const consentDecisionMutationOptions = mutationOptions({
  mutationFn: async (params: ConsentDecisionParams) => {
    const res = await client.api.consent.$post({
      json: params,
    });
    return jsonOk(res);
  },
});
